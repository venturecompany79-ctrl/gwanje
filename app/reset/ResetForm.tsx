"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { InputField } from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";

export function ResetForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase) return;
    setLoading(true);
    await supabase.auth.resetPasswordForEmail(email);
    setSent(true);
    setLoading(false);
  }

  return (
    <form className="auth-card" onSubmit={handleSubmit}>
      <div>
        <h1>비밀번호 재설정</h1>
        <p className="auth-sub">
          가입한 이메일로 재설정 링크를 보내드립니다.
        </p>
      </div>
      {!supabase ? (
        <div className="auth-notice">
          Supabase 연결 후 사용할 수 있습니다 (.env.local 설정 필요).
        </div>
      ) : sent ? (
        <div className="auth-notice">
          재설정 링크를 보냈습니다. 메일함을 확인해 주세요.
        </div>
      ) : (
        <>
          <InputField
            label="이메일"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button variant="cta" full type="submit" disabled={loading}>
            {loading ? "처리 중…" : "재설정 링크 받기"}
          </Button>
        </>
      )}
    </form>
  );
}
