import type { InputHTMLAttributes } from "react";
import { useId } from "react";

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
