"use client";

import type { ReactNode } from "react";
import { IconCheck } from "./icons";

interface CheckboxProps {
  checked: boolean;
  onChange?: (next: boolean) => void;
  disabled?: boolean;
  /** 약관 동의처럼 여러 줄 라벨일 때 상단 정렬 */
  agree?: boolean;
  children: ReactNode;
}

// 커스텀 체크박스 — 선택 상태는 폼 활성 토큰(fb-blue) 사용
export function Checkbox({
  checked,
  onChange,
  disabled,
  agree,
  children,
}: CheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      className={[
        "chk",
        checked ? "is-on" : null,
        agree ? "chk--agree" : null,
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={() => onChange?.(!checked)}
    >
      <span className="box">
        <IconCheck />
      </span>
      <span>{children}</span>
    </button>
  );
}
