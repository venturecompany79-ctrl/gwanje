import type { Metadata } from "next";
import { LegalDoc } from "@/components/legal/LegalDoc";

export const metadata: Metadata = { title: "이용약관" };

// ⚠️ 초안 — 정식 오픈 전 법률 검토를 거쳐 문안을 확정할 것.
export default function TermsPage() {
  return (
    <LegalDoc title="이용약관" effective="시행일: 2026-07-01 (초안)">
      <h2>제1조 (목적)</h2>
      <p>
        본 약관은 관제(이하 &ldquo;서비스&rdquo;)가 제공하는 중소기업
        인증·정부지원·융자 관리 SaaS의 이용 조건과 절차, 서비스와 이용자의
        권리·의무를 정합니다.
      </p>

      <h2>제2조 (계정)</h2>
      <ul>
        <li>
          가입은 Google 계정 인증으로 이루어지며, 가입 시 컨설턴트
          워크스페이스가 생성됩니다.
        </li>
        <li>
          계정과 워크스페이스 데이터의 관리 책임은 계정 소유자에게 있으며,
          제3자에게 계정을 양도·대여할 수 없습니다.
        </li>
      </ul>

      <h2>제3조 (서비스 이용)</h2>
      <ul>
        <li>
          서비스는 고객사 자격·과제·일정의 만료/마감 관제, 관리포인트 추천,
          일괄안내 기능을 제공합니다.
        </li>
        <li>
          이용자는 관련 법령과 본 약관을 준수해야 하며, 서비스를 이용해 수집한
          고객사 정보를 목적 외로 사용해서는 안 됩니다.
        </li>
      </ul>

      <h2>제4조 (서비스 변경 및 중단)</h2>
      <p>
        서비스는 운영상·기술상 필요에 따라 기능을 변경하거나 중단할 수 있으며,
        중대한 변경은 사전에 공지합니다.
      </p>

      <h2>제5조 (책임의 제한)</h2>
      <p>
        서비스는 만료/마감 정보의 참고용 관제 도구이며, 최종 신청·갱신 기한의
        준수 책임은 이용자에게 있습니다. 천재지변 등 불가항력으로 인한 손해에
        대해서는 책임을 지지 않습니다.
      </p>

      <h2>제6조 (문의)</h2>
      <p>
        약관에 대한 문의: <a href="mailto:venturecompany79@gmail.com">venturecompany79@gmail.com</a>
      </p>
    </LegalDoc>
  );
}
