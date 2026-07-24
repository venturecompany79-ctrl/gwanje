"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface ToastState {
  message: string;
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
}

export interface ToastOptions {
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
  durationMs?: number;
}

/** 저장 토스트 — 일반 메시지는 2.4초, 액션이 있으면 기본 5초 뒤 사라진다. */
export function useToast(): {
  toast: ToastState | null;
  showToast: (message: string, options?: ToastOptions) => void;
} {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, options?: ToastOptions) => {
    setToast({
      message,
      actionLabel: options?.actionLabel,
      onAction: options?.onAction,
    });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(
      () => setToast(null),
      options?.durationMs ?? (options?.onAction ? 5000 : 2400),
    );
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return { toast, showToast };
}

export function Toast({
  message,
}: {
  message: ToastState | string | null;
}) {
  if (!message) return null;
  const toast =
    typeof message === "string" ? { message } satisfies ToastState : message;
  return (
    <div className="toast" role="status" aria-live="polite">
      <span>{toast.message}</span>
      {toast.actionLabel && toast.onAction ? (
        <button type="button" onClick={() => void toast.onAction?.()}>
          {toast.actionLabel}
        </button>
      ) : null}
    </div>
  );
}
