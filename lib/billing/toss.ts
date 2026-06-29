import { TOSS_API_BASE, getTossServerConfig } from "@/lib/billing/config";

// Toss Payments 자동결제(빌링키) 서버 REST 클라이언트.
// 인증: Authorization: Basic base64(secretKey + ":")
// 모든 호출은 서버에서만 — secretKey는 절대 클라이언트로 나가지 않는다.

export class TossApiError extends Error {
  code: string;
  httpStatus: number;
  constructor(code: string, message: string, httpStatus: number) {
    super(message);
    this.name = "TossApiError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

function authHeader(): string {
  const { secretKey } = getTossServerConfig();
  // 시크릿 키 뒤에 ':' 추가 후 base64 (비밀번호 빈 Basic 인증)
  const token = Buffer.from(`${secretKey}:`).toString("base64");
  return `Basic ${token}`;
}

async function tossFetch(
  path: string,
  body: Record<string, unknown>,
  idempotencyKey?: string,
): Promise<Record<string, unknown>> {
  const headers: Record<string, string> = {
    Authorization: authHeader(),
    "Content-Type": "application/json",
  };
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

  const res = await fetch(`${TOSS_API_BASE}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const code = typeof json.code === "string" ? json.code : "UNKNOWN";
    const message =
      typeof json.message === "string" ? json.message : "결제 처리에 실패했습니다.";
    throw new TossApiError(code, message, res.status);
  }
  return json;
}

export interface IssuedBillingKey {
  billingKey: string;
  customerKey: string;
  cardCompany: string | null;
  cardNumberMasked: string | null;
  cardType: string | null;
}

/** authKey + customerKey → 빌링키 발급. POST /v1/billing/authorizations/issue */
export async function issueBillingKey(
  authKey: string,
  customerKey: string,
): Promise<IssuedBillingKey> {
  const json = await tossFetch("/v1/billing/authorizations/issue", {
    authKey,
    customerKey,
  });
  const card = (json.card ?? {}) as Record<string, unknown>;
  return {
    billingKey: String(json.billingKey),
    customerKey: String(json.customerKey ?? customerKey),
    cardCompany:
      (card.issuerCode as string | undefined) ??
      (card.company as string | undefined) ??
      null,
    cardNumberMasked: (card.number as string | undefined) ?? null,
    cardType: (card.cardType as string | undefined) ?? null,
  };
}

export interface ApproveBillingInput {
  billingKey: string;
  customerKey: string;
  amount: number;
  orderId: string;
  orderName: string;
  customerEmail?: string | null;
  customerName?: string | null;
}

export interface ApprovedPayment {
  paymentKey: string;
  orderId: string;
  status: string;
  approvedAt: string | null;
  totalAmount: number;
  /** 민감정보 제외 정제본 — payment_transaction.raw_response에 저장 */
  sanitized: Record<string, unknown>;
}

/** 빌링키로 결제 승인. POST /v1/billing/{billingKey}. idempotencyKey=orderId 권장. */
export async function approveBilling(
  input: ApproveBillingInput,
): Promise<ApprovedPayment> {
  const { billingKey, ...rest } = input;
  const body: Record<string, unknown> = {
    customerKey: rest.customerKey,
    amount: rest.amount,
    orderId: rest.orderId,
    orderName: rest.orderName,
  };
  if (rest.customerEmail) body.customerEmail = rest.customerEmail;
  if (rest.customerName) body.customerName = rest.customerName;

  const json = await tossFetch(
    `/v1/billing/${encodeURIComponent(billingKey)}`,
    body,
    input.orderId,
  );
  return toApprovedPayment(json);
}

export function toApprovedPayment(
  json: Record<string, unknown>,
): ApprovedPayment {
  return {
    paymentKey: String(json.paymentKey ?? ""),
    orderId: String(json.orderId ?? ""),
    status: String(json.status ?? ""),
    approvedAt: (json.approvedAt as string | undefined) ?? null,
    totalAmount: Number(json.totalAmount ?? 0),
    sanitized: sanitizePaymentResponse(json),
  };
}

/** 결제 취소(환불). POST /v1/payments/{paymentKey}/cancel */
export async function cancelPayment(
  paymentKey: string,
  cancelReason: string,
  idempotencyKey: string,
): Promise<Record<string, unknown>> {
  const json = await tossFetch(
    `/v1/payments/${encodeURIComponent(paymentKey)}/cancel`,
    { cancelReason },
    idempotencyKey,
  );
  return sanitizePaymentResponse(json);
}

/** 빌링키 삭제(베스트 에포트). DELETE /v1/billing/authorizations/{billingKey} */
export async function deleteBillingKey(billingKey: string): Promise<void> {
  const res = await fetch(
    `${TOSS_API_BASE}/v1/billing/authorizations/${encodeURIComponent(billingKey)}`,
    { method: "DELETE", headers: { Authorization: authHeader() } },
  );
  if (!res.ok && res.status !== 404) {
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const message =
      typeof json.message === "string" ? json.message : "빌링키 삭제 실패";
    throw new TossApiError(String(json.code ?? "UNKNOWN"), message, res.status);
  }
}

/** 응답에서 민감/불필요 필드를 제거해 DB(raw_response)에 안전 적재. */
export function sanitizePaymentResponse(
  json: Record<string, unknown>,
): Record<string, unknown> {
  const card = json.card as Record<string, unknown> | undefined;
  return {
    paymentKey: json.paymentKey,
    orderId: json.orderId,
    orderName: json.orderName,
    status: json.status,
    approvedAt: json.approvedAt,
    requestedAt: json.requestedAt,
    totalAmount: json.totalAmount,
    method: json.method,
    // 카드 식별번호 전체는 저장하지 않고 마스킹/유형만 남긴다
    card: card
      ? { number: card.number, cardType: card.cardType, issuerCode: card.issuerCode }
      : undefined,
  };
}
