"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconCheck, IconAlert } from "@/components/ui/icons";

type Phase = "processing" | "done" | "error";

export function BillingSuccess({
  flow,
  customerKey,
  authKey,
}: {
  flow: "register" | "change";
  customerKey: string | null;
  authKey: string | null;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("processing");
  const [message, setMessage] = useState("결제를 확인하고 있습니다…");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return; // StrictMode 이중 호출 방지
    ran.current = true;

    if (!customerKey || !authKey) {
      setPhase("error");
      setMessage("인증 정보가 누락되었습니다. 다시 시도해 주세요.");
      return;
    }

    const endpoint =
      flow === "change" ? "/api/billing/change-card" : "/api/billing/confirm";

    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authKey, customerKey }),
    })
      .then(async (res) => {
        const json = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
        };
        if (res.ok && json.ok) {
          setPhase("done");
          setMessage(
            flow === "change"
              ? "결제수단이 변경되었습니다."
              : "구독이 시작되었습니다. 감사합니다!",
          );
          setTimeout(() => router.replace("/app/billing"), 1400);
        } else {
          setPhase("error");
          setMessage(json.error ?? "결제 처리에 실패했습니다.");
        }
      })
      .catch(() => {
        setPhase("error");
        setMessage("네트워크 오류로 결제 처리에 실패했습니다.");
      });
  }, [flow, customerKey, authKey, router]);

  return (
    <div className="bill-result">
      <div className={`bill-result-card is-${phase}`}>
        <div className="bill-result-icon">
          {phase === "error" ? (
            <IconAlert />
          ) : phase === "done" ? (
            <IconCheck />
          ) : (
            <div className="bill-spinner" aria-hidden />
          )}
        </div>
        <h1>
          {phase === "processing"
            ? "결제 처리 중"
            : phase === "done"
              ? "완료되었습니다"
              : "처리 실패"}
        </h1>
        <p>{message}</p>
        {phase === "error" ? (
          <div className="bill-result-actions">
            <Link className="btn btn--cta" href="/app/billing">
              결제 화면으로
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
