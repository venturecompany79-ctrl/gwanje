"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Toast, useToast } from "@/components/ui/Toast";
import { IconCard, IconAlert, IconCheck } from "@/components/ui/icons";
import { formatKstDate } from "@/lib/datetime";
import {
  prepareCardRegistration,
  cancelSubscription,
} from "@/lib/actions/billing";
import type {
  BillingOverview,
  SubscriptionStatus,
  PaymentStatus,
} from "@/lib/billing/data";

const TOSS_SDK_URL = "https://js.tosspayments.com/v2/standard";

interface TossPaymentInstance {
  requestBillingAuth(opts: {
    method: "CARD";
    successUrl: string;
    failUrl: string;
  }): Promise<void>;
}
interface TossInstance {
  payment(opts: { customerKey: string }): TossPaymentInstance;
}
declare global {
  interface Window {
    TossPayments?: (clientKey: string) => TossInstance;
  }
}

const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  trialing: "체험 중",
  active: "이용 중",
  past_due: "결제 실패",
  canceled: "해지 예약",
  expired: "만료됨",
};
const STATUS_BADGE: Record<SubscriptionStatus, string> = {
  trialing: "badge--attention",
  active: "badge--success",
  past_due: "badge--warning",
  canceled: "badge--neutral",
  expired: "badge--critical",
};
const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  pending: "대기",
  succeeded: "완료",
  failed: "실패",
  canceled: "취소",
};

function formatKRW(amount: number, currency: string): string {
  if (currency === "KRW") return `${amount.toLocaleString("ko-KR")}원`;
  return `${amount.toLocaleString()} ${currency}`;
}

function loadTossScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.TossPayments) return resolve();
    const script = document.createElement("script");
    script.src = TOSS_SDK_URL;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("결제 모듈을 불러오지 못했습니다."));
    document.head.appendChild(script);
  });
}

export function BillingView({ data }: { data: BillingOverview }) {
  const { toast, showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();

  const sub = data.subscription;
  const status = sub?.status ?? null;
  const hasCard = Boolean(data.paymentMethod);

  async function openBillingAuth(flow: "register" | "change") {
    if (!data.clientKey) {
      showToast("결제 설정이 준비되지 않았습니다.");
      return;
    }
    setBusy(true);
    try {
      const prepared = await prepareCardRegistration();
      if (!prepared.ok || !prepared.customerKey) {
        showToast(prepared.error ?? "준비에 실패했습니다.");
        setBusy(false);
        return;
      }
      await loadTossScript();
      const toss = window.TossPayments!(data.clientKey);
      const payment = toss.payment({ customerKey: prepared.customerKey });
      const origin = window.location.origin;
      await payment.requestBillingAuth({
        method: "CARD",
        successUrl: `${origin}/billing/success?flow=${flow}`,
        failUrl: `${origin}/billing/fail`,
      });
      // 성공 시 Toss가 successUrl로 리다이렉트하므로 이 아래는 실행되지 않는다.
    } catch (err) {
      const message = err instanceof Error ? err.message : "결제창을 열지 못했습니다.";
      showToast(message);
      setBusy(false);
    }
  }

  function onCancel() {
    if (
      !window.confirm(
        "구독을 해지하시겠어요? 다음 결제일까지는 계속 이용할 수 있습니다.",
      )
    )
      return;
    startTransition(async () => {
      const res = await cancelSubscription();
      showToast(res.ok ? "구독 해지가 예약되었습니다." : res.error ?? "해지 실패");
    });
  }

  // 결제 비활성(피처 플래그 OFF) — 준비 중 안내
  if (!data.enabled) {
    return (
      <div className="panel">
        <div className="sp-head">
          <h2>구독 결제</h2>
          <p>결제 기능을 준비 중입니다. 활성화되면 이 화면에서 카드 등록과 구독 관리를 할 수 있습니다.</p>
        </div>
        <div className="sp-body">
          <div className="bill-soon">
            <IconCard />
            <div>
              <b>{data.plan.name}</b>
              <span>
                {formatKRW(data.plan.amount, data.plan.currency)} / 월 (예정)
              </span>
            </div>
            <span className="badge badge--neutral">준비 중</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bill-grid">
      {/* 현재 구독 상태 */}
      <div className="panel">
        <div className="sp-head">
          <h2>구독 상태</h2>
          <p>현재 워크스페이스의 구독 상태와 다음 결제일입니다.</p>
        </div>
        <div className="sp-body">
          <div className="bill-status">
            <span
              className={`badge ${status ? STATUS_BADGE[status] : "badge--critical"}`}
            >
              {status ? STATUS_LABEL[status] : "미구독"}
            </span>
            {status === "past_due" ? (
              <span className="bill-hint">
                <IconAlert /> 결제에 실패했습니다. 결제수단을 확인해 주세요.
              </span>
            ) : null}
          </div>
          <dl className="bill-meta">
            <div>
              <dt>요금제</dt>
              <dd>
                {data.plan.name} · {formatKRW(data.plan.amount, data.plan.currency)} / 월
              </dd>
            </div>
            <div>
              <dt>다음 결제일</dt>
              <dd>
                {sub?.currentPeriodEnd
                  ? formatKstDate(sub.currentPeriodEnd)
                  : "—"}
              </dd>
            </div>
            {sub?.canceledAt ? (
              <div>
                <dt>해지 예약</dt>
                <dd>다음 결제일 이후 자동 해지됩니다.</dd>
              </div>
            ) : null}
          </dl>
        </div>
        {status === "active" && !sub?.canceledAt ? (
          <div className="sp-foot">
            <Button variant="ghost-danger" size="sm" onClick={onCancel} disabled={pending}>
              구독 해지
            </Button>
          </div>
        ) : null}
      </div>

      {/* 결제수단 */}
      <div className="panel">
        <div className="sp-head">
          <h2>결제수단</h2>
          <p>국내 카드로 매월 자동 결제됩니다. 카드 정보는 토스페이먼츠가 안전하게 보관합니다.</p>
        </div>
        <div className="sp-body">
          {hasCard ? (
            <div className="bill-card">
              <IconCard />
              <div>
                <b>{data.paymentMethod!.cardCompany ?? "등록된 카드"}</b>
                <span>
                  {data.paymentMethod!.cardNumberMasked ?? "•••• ••••"}
                  {data.paymentMethod!.cardType
                    ? ` · ${data.paymentMethod!.cardType}`
                    : ""}
                </span>
              </div>
              <span className="bill-card-ok">
                <IconCheck /> 등록됨
              </span>
            </div>
          ) : (
            <p className="bill-empty">등록된 결제수단이 없습니다.</p>
          )}
        </div>
        <div className="sp-foot">
          {hasCard ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => openBillingAuth("change")}
              disabled={busy}
            >
              {busy ? "여는 중…" : "카드 변경"}
            </Button>
          ) : (
            <Button onClick={() => openBillingAuth("register")} disabled={busy}>
              {busy ? "여는 중…" : "카드 등록하고 구독 시작"}
            </Button>
          )}
        </div>
      </div>

      {/* 최근 결제 내역 */}
      <div className="panel bill-span">
        <div className="sp-head">
          <h2>최근 결제 내역</h2>
          <p>최근 10건의 결제·환불 기록입니다.</p>
        </div>
        <div className="sp-body">
          {data.transactions.length === 0 ? (
            <p className="bill-empty">아직 결제 내역이 없습니다.</p>
          ) : (
            <table className="bill-table">
              <thead>
                <tr>
                  <th>일시</th>
                  <th>내용</th>
                  <th className="num">금액</th>
                  <th>상태</th>
                </tr>
              </thead>
              <tbody>
                {data.transactions.map((t) => (
                  <tr key={t.id}>
                    <td>{formatKstDate(t.createdAt)}</td>
                    <td>
                      {t.orderName ?? "구독 결제"}
                      {t.kind === "refund" ? " (환불)" : ""}
                    </td>
                    <td className="num">{formatKRW(t.amount, t.currency)}</td>
                    <td>
                      <span
                        className={`badge ${
                          t.status === "succeeded"
                            ? "badge--success"
                            : t.status === "failed"
                              ? "badge--critical"
                              : "badge--neutral"
                        }`}
                      >
                        {PAYMENT_LABEL[t.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Toast message={toast} />
    </div>
  );
}
