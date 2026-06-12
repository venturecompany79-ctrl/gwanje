"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** 저장 토스트 — show("저장되었습니다") 호출 후 2.4초 뒤 자동 사라짐 */
export function useToast(): {
  toast: string | null;
  showToast: (message: string) => void;
} {
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 2400);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return { toast, showToast };
}

export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="toast" role="status">
      {message}
    </div>
  );
}
