"use client";

import type { ChangeEvent, InputHTMLAttributes } from "react";
import { useId, useState } from "react";
import { formatBizNo, formatPhone } from "@/lib/format";

interface InputFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  fieldClassName?: string;
}

export function InputField({
  label,
  error,
  className,
  fieldClassName,
  ...rest
}: InputFieldProps) {
  const id = useId();
  return (
    <div className={["field", fieldClassName].filter(Boolean).join(" ")}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className={["input", error ? "input--error" : null, className]
          .filter(Boolean)
          .join(" ")}
        aria-invalid={error ? true : undefined}
        {...rest}
      />
      {error ? <span className="field-error">{error}</span> : null}
    </div>
  );
}

const MASKERS = {
  bizNo: formatBizNo,
  phone: formatPhone,
} as const;

interface MaskedInputFieldProps extends InputFieldProps {
  /** 입력 중 실시간 하이픈 마스킹 종류 (GWJ-002 / GWJ-003) */
  mask: keyof typeof MASKERS;
}

/**
 * 번호 입력 전용 필드 — 표시값·제출값(FormData)·controlled value 모두 마스킹된 형태로 통일.
 * controlled(value+onChange)·uncontrolled(defaultValue) 양쪽을 지원하며,
 * onChange에는 마스킹된 값을 실은 이벤트를 전달한다(부모 set 핸들러 그대로 동작).
 */
export function MaskedInputField({
  mask,
  value,
  defaultValue,
  onChange,
  inputMode = "numeric",
  ...rest
}: MaskedInputFieldProps) {
  const format = MASKERS[mask];
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState(() =>
    defaultValue != null ? format(String(defaultValue)) : "",
  );
  const display = isControlled ? format(String(value ?? "")) : internal;

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const formatted = format(e.target.value);
    if (!isControlled) setInternal(formatted);
    if (onChange) {
      e.target.value = formatted;
      onChange(e);
    }
  }

  return (
    <InputField
      {...rest}
      inputMode={inputMode}
      value={display}
      onChange={handleChange}
    />
  );
}
