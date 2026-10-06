import { companyInitial } from "@/lib/companyBrand";

// 기업 아이콘 — 로고가 있으면 로고, 없으면 이니셜. 색·로고는 CompanyBrandStyle 이 data-co 로 입힌다.
export function CompanyMark({
  id,
  name,
  size = "sm",
}: {
  id: string | null | undefined;
  name: string;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <span
      className={`co-mark co-mark--${size}`}
      data-co={id ?? undefined}
      aria-hidden="true"
    >
      {companyInitial(name)}
    </span>
  );
}

// 기업명 텍스트 — 지정한 브랜드 컬러로 표시
export function CompanyName({
  id,
  name,
  withMark = false,
}: {
  id: string | null | undefined;
  name: string;
  withMark?: boolean;
}) {
  if (!withMark) {
    return (
      <span className="co-name" data-co={id ?? undefined}>
        {name}
      </span>
    );
  }
  return (
    <span className="co-label">
      <CompanyMark id={id} name={name} />
      <span className="co-name" data-co={id ?? undefined}>
        {name}
      </span>
    </span>
  );
}
