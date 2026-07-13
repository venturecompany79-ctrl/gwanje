"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  IconAlert,
  IconCheck,
  IconFile,
  IconPlus,
  IconSend,
  IconSparkle,
  IconX,
} from "@/components/ui/icons";
import type { DashboardFile, DashboardScope } from "@/lib/data/dashboard";

interface AssistantSource {
  id: string;
  kind: string;
  label: string;
  href?: string | null;
}

interface AssistantAction {
  id: string;
  type: string;
  title: string;
  summary: string;
  targetType?: string | null;
  targetId?: string | null;
  payload?: Record<string, unknown> | null;
  preview?: Record<string, unknown> | null;
  status: string;
  href?: string | null;
  error?: string | null;
  createdAt?: string | null;
}

interface AssistantMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  sources?: AssistantSource[];
  actions?: AssistantAction[];
  pending?: boolean;
  error?: boolean;
  createdAt?: string | null;
}

interface ConversationSummary {
  id: string;
  title: string;
  scope: unknown;
  lastMessageAt: string;
  createdAt: string;
}

const WELCOME_MESSAGE: AssistantMessage = {
  id: "assistant-welcome",
  role: "assistant",
  text: "안녕하세요. 관제 현황을 근거로 오늘 우선할 업무를 정리하고, 과제나 기업 메모의 실행 초안까지 준비해 드릴게요.",
};

const SUGGESTIONS = [
  "오늘 먼저 처리할 업무를 브리핑해 줘",
  "기한이 지난 항목의 조치 순서를 알려 줘",
  "미배정 과제를 담당자별로 정리해 줘",
];

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeConversation(value: unknown): ConversationSummary | null {
  if (!isRecord(value) || typeof value.id !== "string") return null;
  return {
    id: value.id,
    title:
      typeof value.title === "string" && value.title.trim()
        ? value.title
        : "제목 없는 대화",
    scope: value.scope,
    lastMessageAt:
      typeof value.last_message_at === "string" ? value.last_message_at : "",
    createdAt: typeof value.created_at === "string" ? value.created_at : "",
  };
}

function conversationMatchesScope(
  conversation: ConversationSummary,
  scope: DashboardScope,
  consultantId: string | null,
): boolean {
  if (!isRecord(conversation.scope) || conversation.scope.mode !== scope) return false;
  if (scope === "mine") return true;
  const storedConsultantId =
    typeof conversation.scope.consultantId === "string"
      ? conversation.scope.consultantId
      : null;
  return storedConsultantId === consultantId;
}

function normalizeConversations(
  values: unknown[],
  scope: DashboardScope,
  consultantId: string | null,
): ConversationSummary[] {
  return values
    .map(normalizeConversation)
    .filter((item): item is ConversationSummary => {
      return !!item && conversationMatchesScope(item, scope, consultantId);
    });
}

function normalizeSource(value: unknown): AssistantSource | null {
  if (!isRecord(value)) return null;
  const id = typeof value.id === "string" ? value.id : createId("source");
  const label = typeof value.label === "string" ? value.label : null;
  if (!label) return null;
  return {
    id,
    label,
    kind: typeof value.kind === "string" ? value.kind : "record",
    href: typeof value.href === "string" ? value.href : null,
  };
}

function normalizeAction(value: unknown): AssistantAction | null {
  if (!isRecord(value) || typeof value.id !== "string") return null;
  return {
    id: value.id,
    type: typeof value.type === "string" ? value.type : "action",
    title: typeof value.title === "string" ? value.title : "실행 제안",
    summary:
      typeof value.summary === "string"
        ? value.summary
        : "변경 내용을 확인한 뒤 승인해 주세요.",
    targetType: typeof value.targetType === "string" ? value.targetType : null,
    targetId: typeof value.targetId === "string" ? value.targetId : null,
    payload: isRecord(value.payload) ? value.payload : null,
    preview: isRecord(value.preview) ? value.preview : null,
    status: typeof value.status === "string" ? value.status : "proposed",
    href: typeof value.href === "string" ? value.href : null,
    error: typeof value.error === "string" ? value.error : null,
    createdAt:
      typeof value.createdAt === "string"
        ? value.createdAt
        : typeof value.created_at === "string"
          ? value.created_at
          : null,
  };
}

const ACTION_FIELD_LABEL: Record<string, string> = {
  title: "제목",
  content: "내용",
  memo: "메모",
  dueDate: "기한",
  stage: "단계",
  assigneeId: "담당자",
  companyId: "기업",
  companyName: "기업명",
  campaignName: "안내 제목",
  recipientCount: "대상 수",
};

function previewValue(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "예" : "아니요";
  if (value === null) return "없음";
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
    return value.join(", ");
  }
  return undefined;
}

function actionChanges(action: AssistantAction): Array<{
  label: string;
  before?: string;
  after?: string;
}> {
  const displayData = action.preview ?? action.payload;
  const changes = displayData?.changes;
  if (Array.isArray(changes)) {
    return changes.flatMap((change) => {
      if (!isRecord(change)) return [];
      const label =
        typeof change.label === "string"
          ? change.label
          : typeof change.field === "string"
            ? change.field
            : null;
      if (!label) return [];
      return [
        {
          label,
          before: previewValue(change.before),
          after: previewValue(change.after),
        },
      ];
    });
  }

  if (!displayData) return [];
  const hiddenFields = new Set([
    "tenantId",
    "userId",
    "conversationId",
    "companyId",
    "companyIds",
    "taskId",
    "title",
    "summary",
  ]);
  return Object.entries(displayData)
    .filter(([key]) => !hiddenFields.has(key) && key !== "changes")
    .flatMap(([key, value]) => {
      const direct = previewValue(value);
      if (direct !== undefined) {
        return [{ label: ACTION_FIELD_LABEL[key] ?? key, after: direct }];
      }
      if (!isRecord(value)) return [];
      return Object.entries(value).flatMap(([nestedKey, nestedValue]) => {
        const nested = previewValue(nestedValue);
        if (nested === undefined || hiddenFields.has(nestedKey)) return [];
        return [
          {
            label: ACTION_FIELD_LABEL[nestedKey] ?? nestedKey,
            after: nested,
          },
        ];
      });
    })
    .slice(0, 5);
}

function actionStatusLabel(status: string): string {
  switch (status) {
    case "approved":
    case "completed":
    case "executed":
      return "승인 및 실행 완료";
    case "rejected":
      return "제안 거절됨";
    case "approving":
    case "executing":
      return "실행 중";
    case "rejecting":
      return "거절 처리 중";
    case "failed":
      return "실행 실패";
    default:
      return "승인 대기";
  }
}

export function AssistantPanel({
  scope,
  consultantId,
  configured,
  documents,
}: {
  scope: DashboardScope;
  consultantId: string | null;
  configured: boolean;
  documents: DashboardFile[];
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([WELCOME_MESSAGE]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const chatAbortRef = useRef<AbortController | null>(null);
  const historyAbortRef = useRef<AbortController | null>(null);
  const scopeGenerationRef = useRef(0);

  useEffect(() => {
    scopeGenerationRef.current += 1;
    chatAbortRef.current?.abort();
    historyAbortRef.current?.abort();
    const controller = new AbortController();
    setConversationId(null);
    setMessages([WELCOME_MESSAGE]);
    setSelectedDocumentIds([]);
    setConversations([]);
    setSending(false);
    setHistoryLoading(false);
    async function loadConversationList() {
      try {
        const response = await fetch("/api/assistant/conversations", {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        if (!response.ok) return;
        const result = (await response.json()) as { conversations?: unknown[] };
        if (!controller.signal.aborted && Array.isArray(result.conversations)) {
          setConversations(normalizeConversations(result.conversations, scope, consultantId));
        }
      } catch {
        // 기록 목록을 불러오지 못해도 새 대화는 계속 사용할 수 있다.
      }
    }
    void loadConversationList();
    return () => {
      controller.abort();
    };
  }, [consultantId, scope]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [messages]);

  const closePanel = useCallback(() => {
    setOpen(false);
    if (window.matchMedia("(max-width: 1100px)").matches) {
      window.setTimeout(() => launcherRef.current?.focus(), 0);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePanel();
        return;
      }
      if (event.key !== "Tab" || !window.matchMedia("(max-width: 1100px)").matches) {
        return;
      }
      const focusable = Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), select:not([disabled]), textarea:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => element.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) {
        event.preventDefault();
        panelRef.current?.focus();
      } else if (!panelRef.current?.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 120);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.clearTimeout(timer);
    };
  }, [closePanel, open]);

  function patchMessage(id: string, patch: Partial<AssistantMessage>) {
    setMessages((current) =>
      current.map((message) => (message.id === id ? { ...message, ...patch } : message)),
    );
  }

  function appendDelta(id: string, text: string) {
    setMessages((current) =>
      current.map((message) =>
        message.id === id ? { ...message, text: `${message.text}${text}` } : message,
      ),
    );
  }

  function appendAction(id: string, action: AssistantAction) {
    setMessages((current) =>
      current.map((message) =>
        message.id === id
          ? {
              ...message,
              actions: [...(message.actions ?? []).filter((item) => item.id !== action.id), action],
            }
          : message,
      ),
    );
  }

  function patchAction(
    messageId: string,
    actionId: string,
    patch: Partial<AssistantAction>,
  ) {
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId
          ? {
              ...message,
              actions: message.actions?.map((action) =>
                action.id === actionId ? { ...action, ...patch } : action,
              ),
            }
          : message,
      ),
    );
  }

  async function fetchStoredAction(actionId: string): Promise<AssistantAction | null> {
    if (!conversationId) return null;
    const response = await fetch(`/api/assistant/conversations/${conversationId}`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    const result = (await response.json().catch(() => null)) as {
      actions?: unknown[];
    } | null;
    if (!Array.isArray(result?.actions)) return null;
    return (
      result.actions
        .map(normalizeAction)
        .find((action): action is AssistantAction => action?.id === actionId) ?? null
    );
  }

  async function pollStoredAction(actionId: string): Promise<AssistantAction | null> {
    let stored: AssistantAction | null = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      stored = await fetchStoredAction(actionId);
      if (!stored || stored.status !== "executing") return stored;
      await new Promise<void>((resolve) => window.setTimeout(resolve, 800 + attempt * 300));
    }
    return stored;
  }

  async function refreshAction(messageId: string, actionId: string) {
    patchAction(messageId, actionId, { error: null });
    const stored = await pollStoredAction(actionId).catch(() => null);
    if (stored) {
      patchAction(messageId, actionId, {
        ...stored,
        error:
          stored.error ??
          (stored.status === "executing"
            ? "서버에서 계속 처리 중입니다. 잠시 후 상태를 다시 확인해 주세요."
            : null),
      });
      return;
    }
    patchAction(messageId, actionId, {
      error: "현재 상태를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    });
  }

  async function consumeStream(
    response: Response,
    assistantMessageId: string,
    generation: number,
  ) {
    if (!response.body) throw new Error("AI 응답 스트림을 열 수 없습니다.");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    const handleFrame = (frame: string) => {
      if (generation !== scopeGenerationRef.current) return;
      let eventName = "message";
      const dataLines: string[] = [];
      for (const line of frame.split(/\r?\n/)) {
        if (line.startsWith("event:")) eventName = line.slice(6).trim();
        if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
      }
      if (dataLines.length === 0) return;
      const raw = dataLines.join("\n");
      const data: unknown = JSON.parse(raw);
      if (!isRecord(data)) return;

      if (eventName === "meta" && typeof data.conversationId === "string") {
        setConversationId(data.conversationId);
      } else if (eventName === "delta" && typeof data.text === "string") {
        appendDelta(assistantMessageId, data.text);
      } else if (eventName === "sources" && Array.isArray(data.sources)) {
        patchMessage(assistantMessageId, {
          sources: data.sources.map(normalizeSource).filter((item): item is AssistantSource => !!item),
        });
      } else if (eventName === "action") {
        const action = normalizeAction(data.action);
        if (action) appendAction(assistantMessageId, action);
      } else if (eventName === "error") {
        throw new Error(typeof data.message === "string" ? data.message : "AI 응답에 실패했습니다.");
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (generation !== scopeGenerationRef.current) {
        await reader.cancel();
        return;
      }
      buffer += decoder.decode(value, { stream: !done });
      const frames = buffer.split(/\r?\n\r?\n/);
      buffer = frames.pop() ?? "";
      frames.forEach(handleFrame);
      if (done) break;
    }
    if (buffer.trim()) handleFrame(buffer);
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const userMessage: AssistantMessage = {
      id: createId("user"),
      role: "user",
      text: trimmed,
    };
    const assistantMessageId = createId("assistant");
    const assistantMessage: AssistantMessage = {
      id: assistantMessageId,
      role: "assistant",
      text: "",
      pending: true,
    };
    setMessages((current) => [...current, userMessage, assistantMessage]);
    setInput("");
    setSending(true);
    const generation = scopeGenerationRef.current;
    const controller = new AbortController();
    chatAbortRef.current?.abort();
    chatAbortRef.current = controller;

    try {
      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: conversationId ?? undefined,
          message: trimmed,
          scope: {
            mode: scope,
            consultantId: scope === "team" && consultantId ? consultantId : undefined,
          },
          documentIds: selectedDocumentIds.length > 0 ? selectedDocumentIds : undefined,
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const detail = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(detail?.error ?? "AI 비서에 연결하지 못했습니다.");
      }
      await consumeStream(response, assistantMessageId, generation);
      if (generation !== scopeGenerationRef.current) return;
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantMessageId
            ? {
                ...message,
                pending: false,
                text: message.text || "분석 결과를 생성하지 못했습니다. 질문을 조금 바꿔 다시 시도해 주세요.",
              }
            : message,
        ),
      );
      void fetch("/api/assistant/conversations", {
        headers: { Accept: "application/json" },
      })
        .then((result) => (result.ok ? result.json() : null))
        .then((result: { conversations?: unknown[] } | null) => {
          if (
            generation !== scopeGenerationRef.current ||
            !Array.isArray(result?.conversations)
          ) return;
          setConversations(normalizeConversations(result.conversations, scope, consultantId));
        })
        .catch(() => undefined);
    } catch (error) {
      if (controller.signal.aborted || generation !== scopeGenerationRef.current) return;
      patchMessage(assistantMessageId, {
        pending: false,
        error: true,
        text: error instanceof Error ? error.message : "AI 응답에 실패했습니다.",
      });
    } finally {
      if (chatAbortRef.current === controller) chatAbortRef.current = null;
      if (generation === scopeGenerationRef.current) setSending(false);
    }
  }

  async function decideAction(
    messageId: string,
    actionId: string,
    decision: "approve" | "reject",
  ) {
    const interimStatus = decision === "approve" ? "approving" : "rejecting";
    patchAction(messageId, actionId, { status: interimStatus, error: null });

    try {
      const response = await fetch(`/api/assistant/actions/${actionId}/${decision}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const result = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        action?: unknown;
      } | null;
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error ?? "실행 요청을 처리하지 못했습니다.");
      }
      const returned = isRecord(result.action) ? result.action : null;
      const returnedStatus =
        returned && typeof returned.status === "string" ? returned.status : null;
      const returnedHref = returned && typeof returned.href === "string" ? returned.href : null;
      patchAction(messageId, actionId, {
        status: returnedStatus ?? (decision === "approve" ? "approved" : "rejected"),
        href: returnedHref,
        error: null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "실행에 실패했습니다.";
      const stored = await pollStoredAction(actionId).catch(() => null);
      if (stored) {
        patchAction(messageId, actionId, {
          ...stored,
          error:
            stored.error ??
            (stored.status === "pending"
              ? message
              : stored.status === "executing"
                ? "서버에서 계속 처리 중입니다. 잠시 후 상태를 다시 확인해 주세요."
                : null),
        });
      } else {
        patchAction(messageId, actionId, {
          status: "pending",
          error: `${message} 요청 결과를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.`,
        });
      }
    }
  }

  function resetConversation() {
    scopeGenerationRef.current += 1;
    chatAbortRef.current?.abort();
    historyAbortRef.current?.abort();
    chatAbortRef.current = null;
    historyAbortRef.current = null;
    setConversationId(null);
    setMessages([WELCOME_MESSAGE]);
    setSelectedDocumentIds([]);
    setSending(false);
    setHistoryLoading(false);
  }

  async function loadConversation(id: string) {
    if (!id || id === conversationId || historyLoading || sending) return;
    const generation = scopeGenerationRef.current;
    const controller = new AbortController();
    historyAbortRef.current?.abort();
    historyAbortRef.current = controller;
    setHistoryLoading(true);
    try {
      const response = await fetch(`/api/assistant/conversations/${id}`, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      const result = (await response.json().catch(() => null)) as {
        ok?: boolean;
        conversation?: unknown;
        messages?: unknown[];
        actions?: unknown[];
      } | null;
      if (!response.ok || !result?.ok || !Array.isArray(result.messages)) {
        throw new Error("대화 기록을 불러오지 못했습니다.");
      }
      if (generation !== scopeGenerationRef.current) return;
      const storedConversation = normalizeConversation(result.conversation);
      if (!storedConversation || !conversationMatchesScope(storedConversation, scope, consultantId)) {
        throw new Error("현재 관제 범위와 다른 대화입니다.");
      }

      const restored = result.messages.flatMap((value): AssistantMessage[] => {
        if (!isRecord(value) || typeof value.id !== "string") return [];
        if (value.role !== "user" && value.role !== "assistant") return [];
        return [
          {
            id: value.id,
            role: value.role,
            text: typeof value.content === "string" ? value.content : "",
            createdAt: typeof value.created_at === "string" ? value.created_at : null,
            sources: Array.isArray(value.sources)
              ? value.sources
                  .map(normalizeSource)
                  .filter((item): item is AssistantSource => !!item)
              : undefined,
          },
        ];
      });
      const restoredActions = Array.isArray(result.actions)
        ? result.actions
            .map(normalizeAction)
            .filter((item): item is AssistantAction => !!item)
        : [];
      if (restoredActions.length > 0) {
        const assistantIndexes = restored.flatMap((message, index) =>
          message.role === "assistant" ? [index] : [],
        );
        for (const action of restoredActions) {
          const actionTime = action.createdAt ? Date.parse(action.createdAt) : Number.NaN;
          const targetIndex =
            assistantIndexes.find((index) => {
              const messageTime = restored[index].createdAt
                ? Date.parse(restored[index].createdAt!)
                : Number.NaN;
              return Number.isFinite(actionTime) && messageTime >= actionTime;
            }) ?? assistantIndexes.at(-1);
          if (targetIndex !== undefined) {
            restored[targetIndex] = {
              ...restored[targetIndex],
              actions: [...(restored[targetIndex].actions ?? []), action],
            };
          }
        }
      }
      setConversationId(id);
      setMessages(restored.length > 0 ? restored : [WELCOME_MESSAGE]);
      setSelectedDocumentIds([]);
    } catch (error) {
      if (controller.signal.aborted || generation !== scopeGenerationRef.current) return;
      setMessages((current) => [
        ...current,
        {
          id: createId("assistant-error"),
          role: "assistant",
          text: error instanceof Error ? error.message : "대화 기록을 불러오지 못했습니다.",
          error: true,
        },
      ]);
    } finally {
      if (historyAbortRef.current === controller) historyAbortRef.current = null;
      if (generation === scopeGenerationRef.current) setHistoryLoading(false);
    }
  }

  function toggleDocument(id: string) {
    setSelectedDocumentIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : current.length < 3
          ? [...current, id]
          : current,
    );
  }

  return (
    <>
      <button
        ref={launcherRef}
        type="button"
        className="assistant-launcher"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="consultant-assistant"
      >
        <IconSparkle /> AI 비서
      </button>

      {open ? (
        <button
          type="button"
          className="assistant-backdrop"
          onClick={closePanel}
          aria-label="AI 비서 닫기"
        />
      ) : null}

      <aside
        ref={panelRef}
        id="consultant-assistant"
        className={`assistant-panel${open ? " is-open" : ""}`}
        aria-label="컨설턴트 AI 비서"
        role={open ? "dialog" : undefined}
        aria-modal={open || undefined}
        tabIndex={-1}
      >
        <header className="assistant-head">
          <span className="assistant-mark">
            <IconSparkle />
          </span>
          <div>
            <h2>컨설턴트 AI 비서</h2>
            <p>
              <span className={configured ? "assistant-online" : "assistant-offline"} />
              {configured ? "Gemini 연결됨" : "Gemini 설정 필요"} ·{" "}
              {scope === "team" ? "팀 관제" : "내 관제"}
            </p>
          </div>
          <button
            type="button"
            className="assistant-head-button assistant-clear"
            onClick={resetConversation}
            aria-label="새 대화 시작"
            title="새 대화 시작"
          >
            <IconPlus /> <span>새 대화</span>
          </button>
          <button
            type="button"
            className="assistant-head-button assistant-close"
            onClick={closePanel}
            aria-label="AI 비서 닫기"
          >
            <IconX />
          </button>
        </header>

        {conversations.length > 0 ? (
          <div className="assistant-history">
            <label htmlFor="assistant-conversation-select">최근 대화</label>
            <select
              id="assistant-conversation-select"
              value={conversationId ?? ""}
              onChange={(event) => {
                if (event.target.value) void loadConversation(event.target.value);
                else resetConversation();
              }}
              disabled={historyLoading || sending}
            >
              <option value="">새 대화</option>
              {conversations.map((conversation) => (
                <option key={conversation.id} value={conversation.id}>
                  {conversation.title}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="assistant-log" role="log" aria-live="polite" aria-relevant="additions text">
          {messages.map((message) => (
            <article
              key={message.id}
              className={`assistant-message assistant-message--${message.role}${
                message.error ? " assistant-message--error" : ""
              }`}
            >
              {message.role === "assistant" ? (
                <span className="assistant-message-avatar" aria-hidden="true">
                  <IconSparkle />
                </span>
              ) : null}
              <div className="assistant-message-body">
                <p>
                  {message.text}
                  {message.pending ? <span className="assistant-typing" aria-label="답변 작성 중" /> : null}
                </p>
                {message.sources && message.sources.length > 0 ? (
                  <div className="assistant-sources" aria-label="답변 근거">
                    <span>근거</span>
                    {message.sources.map((source) =>
                      source.href ? (
                        <a key={source.id} href={source.href}>
                          {source.label}
                        </a>
                      ) : (
                        <span key={source.id} className="assistant-source-chip">
                          {source.label}
                        </span>
                      ),
                    )}
                  </div>
                ) : null}
                {message.actions?.map((action) => {
                  const changes = actionChanges(action);
                  const isPendingAction = ["proposed", "pending", "pending_approval"].includes(
                    action.status,
                  );
                  return (
                    <section className="assistant-action" key={action.id}>
                      <div className="assistant-action-head">
                        <IconAlert />
                        <div>
                          <span>실행 전 승인 필요</span>
                          <strong>{action.title}</strong>
                        </div>
                      </div>
                      <p>{action.summary}</p>
                      {isPendingAction && action.error ? (
                        <p className="assistant-action-error" role="alert">
                          {action.error}
                        </p>
                      ) : null}
                      {changes.length > 0 ? (
                        <dl className="assistant-changes">
                          {changes.map((change) => (
                            <div key={change.label}>
                              <dt>{change.label}</dt>
                              <dd>
                                {change.before ? <del>{change.before}</del> : null}
                                {change.after ? <ins>{change.after}</ins> : null}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      ) : null}
                      {isPendingAction ? (
                        <div className="assistant-action-buttons">
                          <button
                            type="button"
                            className="assistant-action-reject"
                            onClick={() => decideAction(message.id, action.id, "reject")}
                          >
                            거절
                          </button>
                          <button
                            type="button"
                            className="assistant-action-approve"
                            onClick={() => decideAction(message.id, action.id, "approve")}
                          >
                            <IconCheck /> 검토 후 승인
                          </button>
                        </div>
                      ) : (
                        <div className={`assistant-action-status assistant-action-status--${action.status}`}>
                          {action.status === "failed" ? (
                            <IconAlert />
                          ) : action.status === "executing" ? (
                            <IconSparkle />
                          ) : (
                            <IconCheck />
                          )}
                          {actionStatusLabel(action.status)}
                          {action.error ? <span>{action.error}</span> : null}
                          {action.status === "executing" ? (
                            <button
                              type="button"
                              onClick={() => void refreshAction(message.id, action.id)}
                            >
                              상태 다시 확인
                            </button>
                          ) : null}
                          {action.href ? <a href={action.href}>결과 보기</a> : null}
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
            </article>
          ))}

          {messages.length === 1 ? (
            <div className="assistant-suggestions" aria-label="추천 질문">
              <span>추천 질문</span>
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => sendMessage(suggestion)}
                  disabled={!configured}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          ) : null}
          <div ref={logEndRef} />
        </div>

        <form
          className="assistant-composer"
          onSubmit={(event) => {
            event.preventDefault();
            void sendMessage(input);
          }}
        >
          {documents.length > 0 ? (
            <details className="assistant-documents">
              <summary>
                <IconFile /> 참조 자료 선택
                {selectedDocumentIds.length > 0 ? (
                  <span>{selectedDocumentIds.length}개 선택</span>
                ) : (
                  <span>최대 3개</span>
                )}
              </summary>
              <div>
                {documents.slice(0, 5).map((document) => (
                  <label key={document.id}>
                    <input
                      type="checkbox"
                      checked={selectedDocumentIds.includes(document.id)}
                      disabled={
                        selectedDocumentIds.length >= 3 &&
                        !selectedDocumentIds.includes(document.id)
                      }
                      onChange={() => toggleDocument(document.id)}
                    />
                    <span>
                      <strong>{document.name}</strong>
                      <small>{document.companyName}</small>
                    </span>
                  </label>
                ))}
              </div>
            </details>
          ) : null}
          <div className="assistant-input-wrap">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  void sendMessage(input);
                }
              }}
              rows={2}
              placeholder={
                configured
                  ? "관제 현황에 대해 질문하세요"
                  : "GEMINI_API_KEY 설정 후 사용할 수 있습니다"
              }
              aria-label="AI 비서에게 보낼 메시지"
              disabled={sending || !configured}
            />
            <button
              type="submit"
              disabled={!configured || sending || input.trim().length === 0}
            >
              <IconSend />
              <span className="sr-only">메시지 보내기</span>
            </button>
          </div>
          <p className="assistant-disclaimer">
            {configured
              ? "AI 제안은 검토 후 승인해야 실제 데이터에 반영됩니다."
              : "서버 환경변수 GEMINI_API_KEY를 설정하면 개인 AI 비서가 활성화됩니다."}
          </p>
        </form>
      </aside>
    </>
  );
}
