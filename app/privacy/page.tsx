import type { Metadata } from "next";
import { LegalDoc } from "@/components/legal/LegalDoc";

export const metadata: Metadata = { title: "개인정보 처리방침" };

// ⚠️ 초안 — 정식 오픈 전 법률 검토를 거쳐 문안을 확정할 것.
export default function PrivacyPage() {
  return (
    <LegalDoc title="개인정보 처리방침" effective="시행일: 2026-07-01 (초안)">
      <h2>1. 수집하는 개인정보</h2>
      <ul>
        <li>
          가입 시(Google 계정 인증): 이름, 이메일 주소, 프로필 기본정보
        </li>
        <li>가입 후 이용자가 입력: 직함/소속, 연락처, 발신자 정보</li>
        <li>
          서비스 이용 과정에서 이용자가 등록하는 고객사 정보(기업명, 담당자
          연락처 등)는 이용자가 처리 책임을 지는 위탁 데이터로 취급합니다.
        </li>
      </ul>

      <h2>2. 이용 목적</h2>
      <ul>
        <li>회원 식별, 워크스페이스 제공 및 운영</li>
        <li>만료/마감 알림 등 서비스 핵심 기능 제공</li>
        <li>서비스 관련 공지 및 문의 대응</li>
      </ul>

      <h2>3. 보관 기간</h2>
      <p>
        회원 탈퇴(워크스페이스 삭제) 시 지체 없이 파기합니다. 단, 관련 법령이
        보존을 요구하는 정보는 해당 기간 동안 보관합니다.
      </p>

      <h2>4. 처리 위탁</h2>
      <ul>
        <li>Supabase Inc. — 데이터베이스·인증 인프라</li>
        <li>Vercel Inc. — 서비스 호스팅</li>
        <li>Cloudinary Ltd. — 파일 저장</li>
      </ul>

      <h2>5. 이용자의 권리</h2>
      <p>
        이용자는 언제든지 자신의 개인정보에 대한 열람·정정·삭제·처리정지를
        요구할 수 있습니다. 요청은 아래 문의처로 접수해 주세요.
      </p>

      <h2>6. 문의처</h2>
      <p>
        개인정보 보호책임자: <a href="mailto:venturecompany79@gmail.com">venturecompany79@gmail.com</a>
      </p>
    </LegalDoc>
  );
}
