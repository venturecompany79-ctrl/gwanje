import { createHmac, randomUUID } from "node:crypto";
import { SOLAPI_API_BASE } from "@/lib/alimtalk/config";

// Solapi(카카오 알림톡 공식 딜러사) HTTP 클라이언트.
// SDK를 쓰지 않고 native fetch + HMAC 서명으로 직접 호출한다(하우스 스타일).
//
// 자격증명은 전역 env가 아니라 테넌트별 DB에서 온다 — 발송 요금이 각 컨설팅사의
// Solapi 계정에서 차감되기 때문. 그래서 모든 함수가 cred를 인자로 받는다.

/** 테넌트별 Solapi 연동 정보(복호화된 상태). */
export interface SolapiCredential {
  apiKey: string;
  apiSecret: string;
  pfId: string;
  senderPhone: string;
  smsFallback: boolean;
}

export interface SolapiMessage {
  to: string;
  from: string;
  /** 알림톡 실패 시 SMS/LMS 대체발송에 쓰일 본문. */
  text: string;
  kakaoOptions: {
    pfId: string;
    templateId: string;
    variables: Record<string, string>;
    disableSms: boolean;
  };
  /** 발송 결과를 수신자 행에 되돌려 매핑하기 위한 앵커. */
  customFields: Record<string, string>;
}

export interface SolapiSendOutcome {
  recipientId: string | null;
  ok: boolean;
  messageId: string | null;
  statusCode: string | null;
  statusMessage: string | null;
}

export interface SolapiSendResult {
  groupId: string | null;
  outcomes: SolapiSendOutcome[];
}

/** 접수 성공 코드. 그 외는 모두 실패로 간주한다. */
const ACCEPTED_CODE = "2000";
/** 수신 성공(단말 도달) 코드. */
const DELIVERED_CODE = "4000";

function authHeader(cred: SolapiCredential): string {
  const date = new Date().toISOString();
  const salt = randomUUID().replace(/-/g, "");
  const signature = createHmac("sha256", cred.apiSecret)
    .update(date + salt)
    .digest("hex");
  return `HMAC-SHA256 apiKey=${cred.apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
}

async function request(
  cred: SolapiCredential,
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<unknown> {
  const response = await fetch(`${SOLAPI_API_BASE}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: authHeader(cred),
      "Content-Type": "application/json",
    },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`Solapi ${response.status}: ${raw.slice(0, 240)}`);
  }
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new Error(`Solapi 응답을 해석할 수 없습니다: ${raw.slice(0, 240)}`);
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asText(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return null;
}

/**
 * 응답의 메시지 목록을 배열로 펴낸다.
 * Solapi는 성공/실패 목록을 배열로도, id를 키로 하는 객체로도 돌려줄 수 있어
 * 두 형태를 모두 받아들인다.
 */
function collectEntries(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.map(asRecord).filter((item): item is Record<string, unknown> => item !== null);
  }
  const record = asRecord(value);
  if (!record) return [];
  return Object.values(record)
    .map(asRecord)
    .filter((item): item is Record<string, unknown> => item !== null);
}

function readOutcome(entry: Record<string, unknown>): SolapiSendOutcome {
  const customFields = asRecord(entry.customFields);
  const statusCode = asText(entry.statusCode);
  return {
    recipientId: customFields ? asText(customFields.recipientId) : null,
    ok: statusCode === ACCEPTED_CODE,
    messageId: asText(entry.messageId),
    statusCode,
    statusMessage: asText(entry.statusMessage) ?? asText(entry.reason),
  };
}

/**
 * 여러 건을 한 번에 발송한다(건별 내용이 달라 send-many/detail 사용).
 * 반환된 outcome은 요청 messages와 같은 순서를 보장하지 않으므로
 * 반드시 recipientId로 매핑할 것 — 전화번호는 기업이 겹치면 중복될 수 있다.
 */
export async function sendMany(
  cred: SolapiCredential,
  messages: SolapiMessage[],
): Promise<SolapiSendResult> {
  const payload = await request(cred, "/messages/v4/send-many/detail", {
    method: "POST",
    body: { messages },
  });

  const root = asRecord(payload);
  const groupInfo = root ? asRecord(root.groupInfo) : null;
  const groupId =
    (groupInfo ? asText(groupInfo.groupId) : null) ??
    (root ? asText(root.groupId) : null);

  const entries = [
    ...collectEntries(root?.messageList),
    ...collectEntries(root?.failedMessageList),
  ];

  // 건별 결과가 없으면(스펙 변형) 전건 접수 실패로 보는 편이 안전하다 —
  // 성공으로 낙관하면 실제로 안 간 메시지가 "발송됨"으로 남는다.
  if (entries.length === 0) {
    return {
      groupId,
      outcomes: messages.map((message) => ({
        recipientId: asText(message.customFields.recipientId),
        ok: false,
        messageId: null,
        statusCode: null,
        statusMessage: "Solapi 응답에서 발송 결과를 찾지 못했습니다.",
      })),
    };
  }

  return { groupId, outcomes: entries.map(readOutcome) };
}

export interface SolapiMessageStatus {
  messageId: string | null;
  recipientId: string | null;
  statusCode: string | null;
  statusMessage: string | null;
  /** 단말 도달 확인. */
  delivered: boolean;
}

/** 발송 그룹의 건별 최종 상태 조회 — 도달 확인 폴링용. */
export async function listGroupMessages(
  cred: SolapiCredential,
  groupId: string,
): Promise<SolapiMessageStatus[]> {
  const payload = await request(
    cred,
    `/messages/v4/list?groupId=${encodeURIComponent(groupId)}&limit=500`,
  );
  const root = asRecord(payload);
  const entries = collectEntries(root?.messageList ?? payload);

  return entries.map((entry) => {
    const customFields = asRecord(entry.customFields);
    const statusCode = asText(entry.statusCode);
    return {
      messageId: asText(entry.messageId),
      recipientId: customFields ? asText(customFields.recipientId) : null,
      statusCode,
      statusMessage: asText(entry.statusMessage) ?? asText(entry.reason),
      delivered: statusCode === DELIVERED_CODE,
    };
  });
}

/**
 * 잔액 조회. 설정 화면의 잔액 표시와 연동 저장 시 자격증명 검증을 겸한다
 * (잘못된 키면 여기서 에러가 나므로 저장 전에 걸러낼 수 있다).
 */
export async function getBalance(cred: SolapiCredential): Promise<number | null> {
  const payload = await request(cred, "/cash/v1/balance");
  const root = asRecord(payload);
  if (!root) return null;
  const balance = root.balance ?? root.point;
  return typeof balance === "number" ? balance : null;
}

/** 접수/도달 실패가 되돌릴 수 없는 상태인지(재시도 무의미). */
export function isTerminalFailure(statusCode: string | null): boolean {
  if (!statusCode) return false;
  // 2000=접수, 3000번대=처리중. 그 외 4000 이외의 4000번대/그 이상은 종결 실패.
  if (statusCode === ACCEPTED_CODE || statusCode === DELIVERED_CODE) return false;
  return !statusCode.startsWith("3");
}
