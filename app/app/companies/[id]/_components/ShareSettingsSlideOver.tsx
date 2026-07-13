"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button, LinkButton } from "@/components/ui/Button";
import { SlideOver } from "@/components/ui/SlideOver";
import { IconAlert, IconArrow, IconLink, IconX } from "@/components/ui/icons";
import type { CompanyShareSettings } from "@/lib/data/company-share";
import {
  disableCompanyShare,
  enableCompanyShare,
  resetSharePassword,
  rotateShareLink,
} from "../share-actions";

// 기업별 공유 대시보드 제어 — 공유 on/off · 링크 복사 · 재발급 · 비밀번호 초기화.
// 상태 변경 후 router.refresh()로 서버에서 최신 share prop을 다시 받는다.
export function ShareSettingsButton({
  companyId,
  share,
  shareConfigured,
  demo,
  showToast,
}: {
  companyId: string;
  share: CompanyShareSettings | null;
  shareConfigured: boolean;
  demo: boolean;
  showToast: (message: string) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState<"rotate" | "reset" | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  function close() {
    setOpen(false);
    setError(null);
    setConfirming(null);
  }

  function run(
    action: () => Promise<{ ok: boolean; error: string | null }>,
    successMessage: string,
  ) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      setConfirming(null);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      showToast(successMessage);
      router.refresh();
    });
  }

  const token = share?.token ?? (demo ? "demo" : null);
  const shareUrl = token ? `${origin}/share/${token}` : null;
  const isActive = Boolean(share?.enabled) || (demo && !share);
  // 데모(share 없음)에서는 실제 액션이 모두 DEMO_ERROR이므로 CTA를 숨기고 링크 확인만
  const showEnableCta = (!share || !share.enabled) && !(demo && !share);

  async function copyLink() {
    if (!token) return;
    try {
      // origin state가 아직 비어 있어도 항상 절대 URL을 복사
      await navigator.clipboard.writeText(
        `${window.location.origin}/share/${token}`,
      );
      showToast("링크를 복사했습니다");
    } catch {
      showToast("복사에 실패했습니다. 링크를 직접 선택해 복사해 주세요.");
    }
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <IconLink /> 공유
      </Button>

      {open ? (
        <SlideOver ariaLabel="기업 공유 대시보드 설정" onClose={close}>
          <div className="slideover-head">
            <h2>진행현황 공유</h2>
            <button
              type="button"
              className="icon-btn"
              onClick={close}
              aria-label="닫기"
            >
              <IconX />
            </button>
          </div>

          <div className="slideover-body">
            {demo ? (
              <div className="auth-notice">
                <b>데모 모드</b> — 아래 링크로 데모 대시보드 화면을 확인할 수
                있습니다. 실제 공유 설정은 Supabase 연결 후 가능합니다.
              </div>
            ) : null}
            {!demo && !shareConfigured ? (
              <div className="auth-notice">
                <b>서버 설정 필요</b> — SHARE_COOKIE_SECRET /
                SUPABASE_SERVICE_ROLE_KEY 환경변수가 설정되지 않아 대표님이
                링크에 접속해도 화면이 열리지 않습니다.
              </div>
            ) : null}
            {error ? (
              <div className="auth-error">
                <IconAlert /> {error}
              </div>
            ) : null}

            <p className="share-settings-desc">
              고객사 대표님이 로그인 없이 <b>관리포인트 진행현황과 성과 지표</b>
              를 볼 수 있는 전용 링크입니다. 로그인한 컨설턴트는 비밀번호 없이
              조회할 수 있으며, 대표님은 첫 접속 때 직접 비밀번호를 설정합니다.
              링크와 비밀번호를 아는 사람은 누구나 볼 수 있으니 대표님께만 전달해
              주세요.
            </p>

            <div className="share-settings-status">
              <span className="k">공유 상태</span>
              <Badge tone={isActive ? "success" : "neutral"}>
                {isActive ? "공유 중" : "중지됨"}
              </Badge>
              {share ? (
                <>
                  <span className="k">비밀번호</span>
                  <Badge tone={share.hasPassword ? "success" : "attention"}>
                    {share.hasPassword ? "설정됨" : "대표 설정 대기"}
                  </Badge>
                </>
              ) : null}
            </div>

            {isActive && shareUrl ? (
              <div className="field">
                <label htmlFor="share-url">공유 링크</label>
                <div className="share-link-row">
                  <input
                    id="share-url"
                    className="input"
                    readOnly
                    value={shareUrl}
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  <Button variant="secondary" size="sm" onClick={copyLink}>
                    복사
                  </Button>
                  <LinkButton
                    variant="secondary"
                    size="sm"
                    href={shareUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <IconArrow /> 조회
                  </LinkButton>
                </div>
              </div>
            ) : null}

            {!share || !share.enabled ? (
              showEnableCta ? (
                <Button
                  variant="cta"
                  full
                  disabled={pending}
                  onClick={() =>
                    run(
                      () => enableCompanyShare(companyId),
                      share ? "공유를 다시 시작했습니다" : "공유 링크를 만들었습니다",
                    )
                  }
                >
                  {pending
                    ? "처리 중…"
                    : share
                      ? "공유 다시 시작"
                      : "공유 링크 만들기"}
                </Button>
              ) : null
            ) : (
              <div className="share-settings-actions">
                {confirming === "rotate" ? (
                  <div className="share-confirm">
                    <p>
                      기존 링크가 <b>즉시 무효화</b>되고 새 링크가 발급됩니다.
                      대표님께 새 링크를 다시 전달해야 합니다.
                    </p>
                    <div className="share-confirm-btns">
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={pending}
                        onClick={() =>
                          run(
                            () => rotateShareLink(companyId),
                            "새 링크를 발급했습니다",
                          )
                        }
                      >
                        {pending ? "발급 중…" : "재발급 확인"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() => setConfirming(null)}
                      >
                        취소
                      </Button>
                    </div>
                  </div>
                ) : confirming === "reset" ? (
                  <div className="share-confirm">
                    <p>
                      대표님의 비밀번호가 초기화되고 로그인 상태가 모두
                      해제됩니다. 다음 접속 때 새 비밀번호를 설정하게 됩니다.
                    </p>
                    <div className="share-confirm-btns">
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={pending}
                        onClick={() =>
                          run(
                            () => resetSharePassword(companyId),
                            "비밀번호를 초기화했습니다",
                          )
                        }
                      >
                        {pending ? "초기화 중…" : "초기화 확인"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() => setConfirming(null)}
                      >
                        취소
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={pending}
                      onClick={() => setConfirming("rotate")}
                    >
                      링크 재발급
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={pending || !share.hasPassword}
                      onClick={() => setConfirming("reset")}
                    >
                      비밀번호 초기화
                    </Button>
                    <span className="spacer" />
                    <Button
                      variant="ghost-danger"
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        run(
                          () => disableCompanyShare(companyId),
                          "공유를 중지했습니다",
                        )
                      }
                    >
                      공유 중지
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="slideover-foot">
            <Button variant="ghost" type="button" onClick={close}>
              닫기
            </Button>
          </div>
        </SlideOver>
      ) : null}
    </>
  );
}
