import type { Metadata } from "next";
import type { ReactNode } from "react";
import Image from "next/image";
import LandingNav from "@/components/landing/LandingNav";
import { LinkButton } from "@/components/ui/Button";
import {
  IconAlert,
  IconBell,
  IconBuilding,
  IconChat,
  IconLayers,
  IconSend,
  IconTarget,
} from "@/components/ui/icons";

export const metadata: Metadata = { title: "관제 — 컨설턴트 통합 관제 데스크" };

const CONTACT_EMAIL = "help@gwanje.co.kr";

const PROBLEMS: { icon: ReactNode; text: string }[] = [
  {
    icon: <IconChat />,
    text: "카톡방마다 기업별 자료를 일일이 주고받느라 흩어지는 히스토리",
  },
  {
    icon: <IconLayers />,
    text: "기업마다 다른 인증·지원사업 — 무엇을 챙겨야 하는지 매번 재확인",
  },
  {
    icon: <IconAlert />,
    text: "10개사만 넘어가도 폭증하는 만료·마감, 놓치면 곧 사고",
  },
  {
    icon: <IconSend />,
    text: "공통 공지를 방마다 복붙해 보내고 응답을 수기로 취합",
  },
];

const FEATURES: {
  icon: ReactNode;
  img: { src: string; width: number; height: number };
  title: string;
  desc: string;
}[] = [
  {
    icon: <IconBell />,
    img: { src: "/landing/featDeadlines.png", width: 1012, height: 569 },
    title: "만료·마감 통합 관제",
    desc: "모든 기업의 D-day를 한 화면에 모아 임박 순으로. D-7·D-3·D-1 사전 알림으로 놓치기 전에 챙깁니다.",
  },
  {
    icon: <IconTarget />,
    img: { src: "/landing/featPoints.png", width: 1280, height: 980 },
    title: "컨디션 기반 관리포인트 추천",
    desc: "기업 프로파일에 맞는 인증·정부지원·융자를 자동 매칭해 다음에 할 일을 제안합니다.",
  },
  {
    icon: <IconSend />,
    img: { src: "/landing/featBroadcast.png", width: 1280, height: 940 },
    title: "조건별 일괄 안내",
    desc: "세그먼트로 대상 기업을 추려 알림톡으로 한 번에 발송하고, 수신·응답을 자동 집계합니다.",
  },
  {
    icon: <IconBuilding />,
    img: { src: "/landing/featCompany.png", width: 1280, height: 960 },
    title: "기업별 통합 관리",
    desc: "자격·과제·일정·자료를 기업 단위로 한 곳에 모아 어디서든 맥락을 잃지 않습니다.",
  },
];

const STEPS = [
  {
    title: "기업 등록·컨디션 입력",
    desc: "고객사를 등록하고 업종·매출·보유 자격 등 컨디션을 입력합니다.",
  },
  {
    title: "관리포인트·일정 자동 정리",
    desc: "프로파일에 맞는 관리포인트가 추천되고 만료·마감이 D-day로 정렬됩니다.",
  },
  {
    title: "알림·일괄안내로 운영",
    desc: "사전 알림으로 챙기고, 공통 안내는 세그먼트로 한 번에 발송합니다.",
  },
];

const PLAN = {
  name: "관제 베이직",
  priceLabel: "49,000원",
  features: [
    "관리 기업 수 제한 없음",
    "만료·마감 통합 관제 + 사전 알림",
    "관리포인트 추천 · 조건별 일괄안내",
    "국내 카드 자동결제 · 언제든 해지",
  ],
};

function Logo() {
  return (
    <div className="lp-logo">
      <span className="brand-mark">관</span>관제
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="lp">
      <LandingNav />

      {/* Hero */}
      <section className="lp-hero">
        <div className="lp-hero-in">
          <div>
            <span className="lp-eyebrow">
              <span className="d" />
              중소기업 인증·지원·융자 통합 관제
            </span>
            <h1>수십 개 기업의 인증·지원사업 마감, 한 화면에서 놓치지 않게</h1>
            <p className="sub">
              컨설턴트 한 명이 10~20개 이상의 중소기업을 — 만료·마감 통합
              관제부터 컨디션 맞춤 관리포인트 추천, 조건별 일괄 안내까지 한
              곳에서.
            </p>
            <div className="lp-hero-cta">
              {/* 마케팅 1차 CTA만 검정 pill (Meta DS 규칙) */}
              <LinkButton variant="primary" href="/login">
                서비스 이용하기
              </LinkButton>
              <LinkButton variant="secondary" href="/login">
                로그인
              </LinkButton>
            </div>
            <div className="lp-hero-trust">
              1분 설정 · 안전한 국내 카드 결제 · 데스크톱 최적화
            </div>
          </div>
          <Image
            className="lp-mock"
            src="/landing/heroDashboard.png"
            width={1280}
            height={940}
            sizes="(max-width: 820px) 100vw, 480px"
            priority
            alt="통합 대시보드 화면 미리보기"
          />
        </div>
      </section>

      {/* 문제 4카드 */}
      <section className="lp-section">
        <div className="lp-wrap">
          <div className="lp-sec-head">
            <div className="lp-kicker">왜 필요한가</div>
            <h2>관리 기업이 늘수록, 관제는 사람의 기억으로 감당되지 않습니다</h2>
          </div>
          <div className="lp-prob-grid">
            {PROBLEMS.map((p) => (
              <div key={p.text} className="lp-prob">
                <div className="pic">{p.icon}</div>
                <p>{p.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 기능 4카드 */}
      <section className="lp-section soft" id="features">
        <div className="lp-wrap">
          <div className="lp-sec-head">
            <div className="lp-kicker">핵심 기능</div>
            <h2>흩어진 관제 업무를 하나의 운영 체계로</h2>
            <p>기억과 메신저에 의존하던 일을, 한 화면의 시스템으로 옮깁니다.</p>
          </div>
          <div className="lp-feat-grid">
            {FEATURES.map((f) => (
              <div key={f.title} className="lp-feat">
                <div className="ic">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
                <Image
                  className="lp-mock"
                  src={f.img.src}
                  width={f.img.width}
                  height={f.img.height}
                  sizes="(max-width: 820px) 100vw, 500px"
                  alt={`${f.title} 화면 미리보기`}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 작동방식 3스텝 */}
      <section className="lp-section" id="how">
        <div className="lp-wrap">
          <div className="lp-sec-head">
            <div className="lp-kicker">작동 방식</div>
            <h2>세 단계면 충분합니다</h2>
          </div>
          <div className="lp-steps">
            {STEPS.map((s, i) => (
              <div key={s.title} className="lp-step">
                <div className="n num">{i + 1}</div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 사회증명 — 검수 전 플레이스홀더 */}
      <section className="lp-section soft">
        <div className="lp-wrap">
          <div className="lp-sec-head">
            <span className="lp-review-flag">
              <IconAlert /> 검수 필요 — 실제 수치·후기로 교체 예정
            </span>
            <h2>현장 컨설턴트의 운영 방식을 바꿉니다</h2>
          </div>
          <div className="lp-metrics">
            <div className="lp-metric">
              <div className="v num">197+</div>
              <div className="k">누적 컨설팅 사례</div>
            </div>
            <div className="lp-metric">
              <div className="v num">
                14<small>개사</small>
              </div>
              <div className="k">1인당 평균 관리 기업</div>
            </div>
            <div className="lp-metric">
              <div className="v num">
                0<small>건</small>
              </div>
              <div className="k">도입 후 마감 누락(목표)</div>
            </div>
          </div>
          <div className="lp-quotes">
            <div className="lp-quote">
              <p>
                &ldquo;기업마다 흩어져 있던 마감이 한 화면에 모이니, 아침에
                5분이면 오늘 할 일이 정리됩니다.&rdquo;
              </p>
              <div className="who">
                <span className="av">김</span>
                <div>
                  <b>김○○ 컨설턴트</b>
                  <span>경영지도사 · 플레이스홀더</span>
                </div>
              </div>
            </div>
            <div className="lp-quote">
              <p>
                &ldquo;카톡방을 돌며 보내던 공지를 세그먼트로 한 번에.
                응답까지 자동으로 집계돼요.&rdquo;
              </p>
              <div className="who">
                <span className="av">박</span>
                <div>
                  <b>박○○ 대표</b>
                  <span>컨설팅펌 · 플레이스홀더</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 요금 — 월간 단일 플랜 */}
      <section className="lp-section" id="pricing">
        <div className="lp-wrap">
          <div className="lp-sec-head">
            <div className="lp-kicker">요금</div>
            <h2>간단한 단일 요금제</h2>
            <p>관리 기업 수 제한 없이, 모든 기능을 하나의 월정액으로.</p>
          </div>
          <div className="lp-price-grid">
            <div className="lp-tier is-featured">
              <div className="tn">{PLAN.name}</div>
              <div className="tp">
                <b className="num">{PLAN.priceLabel}</b>
                <span> / 월 (VAT 별도)</span>
              </div>
              <ul className="lp-plan-feats">
                {PLAN.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="lp-price-note">
            <a className="btn btn--primary" href="/login">
              지금 시작하기
            </a>
            <a className="lp-price-contact" href={`mailto:${CONTACT_EMAIL}`}>
              도입 문의
            </a>
          </div>
        </div>
      </section>

      {/* CTA 밴드 — 어두운 배경이라 cobalt CTA 사용 (와이어프레임 기준) */}
      <section className="lp-section">
        <div className="lp-wrap">
          <div className="lp-band">
            <h2>지금 바로 시작하세요</h2>
            <p>설정은 1분이면 충분합니다. 첫 기업을 등록하면 마감이 자동으로 모입니다.</p>
            <div className="row">
              <LinkButton variant="cta" href="/login">
                서비스 이용하기
              </LinkButton>
              <LinkButton variant="ghost" href="/login">
                로그인
              </LinkButton>
            </div>
          </div>
        </div>
      </section>

      {/* 푸터 */}
      <footer className="lp-footer" id="contact">
        <div className="lp-foot-in">
          <div className="lp-foot-brand">
            <Logo />
            <p>
              중소기업의 인증·정부지원·융자 마감을 한 곳에서 관제하는 컨설턴트
              백오피스.
            </p>
          </div>
          <div className="lp-foot-col">
            <h4>제품</h4>
            <a href="#features">기능</a>
            <a href="#how">작동 방식</a>
            <a href="#pricing">요금</a>
          </div>
          <div className="lp-foot-col">
            <h4>회사</h4>
            {/* 소개·블로그 페이지는 준비 전 — 링크 미연결 */}
            <span>소개</span>
            <span>블로그</span>
            <a href={`mailto:${CONTACT_EMAIL}`}>문의</a>
          </div>
          <div className="lp-foot-col">
            <h4>문의</h4>
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
            <span>02-0000-0000</span>
            <span>평일 10:00–18:00</span>
          </div>
        </div>
        <div className="lp-foot-bottom">
          <span>© 2026 관제 · Compliance Desk</span>
          <span className="spacer" />
          {/* 약관·방침 문서는 준비 전 — 링크 미연결 */}
          <span>이용약관</span>
          <span>개인정보처리방침</span>
        </div>
      </footer>
    </div>
  );
}
