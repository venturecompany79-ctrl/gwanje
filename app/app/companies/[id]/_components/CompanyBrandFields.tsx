"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createClient } from "@/lib/supabase/client";
import { IconAlert } from "@/components/ui/icons";
import {
  COMPANY_BRAND_COLORS,
  companyInitial,
  companyLogoUrl,
} from "@/lib/companyBrand";
import { prepareCompanyLogoUpload } from "../actions";

/**
 * 기업 편집 폼의 '브랜드' 섹션 — 로고 이미지 + 기업명 컬러.
 * 로고는 고르는 즉시 스토리지에 올리고 경로만 hidden 필드로 넘긴다(저장 시 반영).
 * ponytail: 업로드 후 저장하지 않고 닫으면 파일이 고아로 남는다 — 쌓이면 tenant/company 경로 기준 정리 잡 추가.
 */
export function CompanyBrandFields({
  companyId,
  name,
  initialColor,
  initialLogoPath,
  demo,
}: {
  companyId: string;
  name: string;
  initialColor: string | null;
  initialLogoPath: string | null;
  demo: boolean;
}) {
  const [color, setColor] = useState(initialColor ?? "");
  const [logoPath, setLogoPath] = useState(initialLogoPath ?? "");
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(
    () => () => {
      if (localPreview) URL.revokeObjectURL(localPreview);
    },
    [localPreview],
  );

  const logoUrl = localPreview ?? (logoPath ? companyLogoUrl(logoPath) : null);
  const previewStyle = {
    "--co-color": color || undefined,
  } as CSSProperties;

  async function handleFile(file: File) {
    setError(null);
    if (demo) {
      setError("데모 모드에서는 로고를 업로드할 수 없습니다.");
      return;
    }
    const supabase = createClient();
    if (!supabase) {
      setError("데모 모드에서는 로고를 업로드할 수 없습니다.");
      return;
    }
    setUploading(true);
    try {
      const prepared = await prepareCompanyLogoUpload(companyId, {
        name: file.name,
        size: file.size,
        type: file.type,
      });
      if (!prepared.ok || !prepared.bucket || !prepared.path || !prepared.contentType) {
        setError(prepared.error ?? "로고 업로드 준비에 실패했습니다.");
        return;
      }
      const { error: uploadError } = await supabase.storage
        .from(prepared.bucket)
        .upload(prepared.path, file, { contentType: prepared.contentType, upsert: false });
      if (uploadError) {
        setError(`로고 업로드에 실패했습니다: ${uploadError.message}`);
        return;
      }
      setLogoPath(prepared.path);
      setLocalPreview(URL.createObjectURL(file));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <fieldset className="brand-fields">
      <legend>브랜드</legend>
      <p className="brand-hint">
        로고와 기업명 컬러는 Task 보드·대시보드·알림 등 기업이 표시되는 모든 화면에 함께 적용됩니다.
      </p>

      <div className="brand-preview" style={previewStyle}>
        <span
          className="co-mark co-mark--lg"
          aria-hidden="true"
          style={
            logoUrl
              ? {
                  background: `#fff url("${logoUrl}") center/78% no-repeat`,
                  borderColor: "transparent",
                  color: "transparent",
                }
              : undefined
          }
        >
          {companyInitial(name || "기업")}
        </span>
        <span className="co-name brand-preview-name">{name || "기업명"}</span>
      </div>

      {error ? (
        <div className="auth-error">
          <IconAlert /> {error}
        </div>
      ) : null}

      <div className="field">
        <span className="brand-label">로고</span>
        <div className="brand-logo-row">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            id="company-logo-file"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
          <label
            htmlFor="company-logo-file"
            className={`btn btn--secondary btn--sm${uploading ? " is-disabled" : ""}`}
            aria-disabled={uploading}
          >
            {uploading ? "업로드 중…" : logoPath ? "로고 변경" : "로고 업로드"}
          </label>
          {logoPath ? (
            <button
              type="button"
              className="filter-reset"
              onClick={() => {
                setLogoPath("");
                setLocalPreview(null);
              }}
            >
              로고 제거
            </button>
          ) : null}
          <span className="brand-hint">PNG·JPG·WebP, 1MB 이하 · 정사각형 권장</span>
        </div>
        <input type="hidden" name="logo_path" value={logoPath} />
      </div>

      <div className="field">
        <span className="brand-label" id="brand-color-label">
          기업명 컬러
        </span>
        <div className="brand-swatches" role="radiogroup" aria-labelledby="brand-color-label">
          <label className="brand-swatch brand-swatch--none" title="기본">
            <input
              type="radio"
              name="brand_color"
              value=""
              checked={color === ""}
              onChange={() => setColor("")}
            />
            <span aria-hidden="true" />
            <b className="sr-only">기본</b>
          </label>
          {COMPANY_BRAND_COLORS.map((option) => (
            <label key={option.value} className="brand-swatch" title={option.label}>
              <input
                type="radio"
                name="brand_color"
                value={option.value}
                checked={color === option.value}
                onChange={() => setColor(option.value)}
              />
              <span aria-hidden="true" style={{ background: option.value }} />
              <b className="sr-only">{option.label}</b>
            </label>
          ))}
        </div>
      </div>
    </fieldset>
  );
}
