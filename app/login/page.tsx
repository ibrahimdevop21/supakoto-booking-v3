"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function LoginContent() {
  const params = useSearchParams();
  const error = params?.get("error");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  const handleLogin = async () => {
    if (!username.trim() || !password) {
      setLoginError("ادخل اسم المستخدم وكلمة المرور");
      return;
    }
    setLoading(true);
    setLoginError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLoginError(
          typeof data?.error === "string" ? data.error : "حصل خطأ — حاول تاني"
        );
        setLoading(false);
        return;
      }
      window.location.href = "/booking";
    } catch {
      setLoginError("حصل خطأ — حاول تاني");
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px 16px;
          position: relative;
          direction: rtl;
        }
        .login-card {
          width: 100%;
          max-width: 420px;
          margin: 0 auto;
          background: rgba(13, 20, 38, 0.82);
          border: 1px solid rgba(51, 65, 100, 0.7);
          border-radius: 20px;
          padding: 40px 36px 32px;
          backdrop-filter: blur(20px);
          box-shadow: 0 24px 64px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.05) inset;
          position: relative;
          overflow: hidden;
        }
        .login-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 2px;
          background: linear-gradient(to right, transparent, rgba(191,30,46,0.7), transparent);
        }
        .login-logo-wrap {
          display: flex;
          justify-content: center;
          margin-bottom: 10px;
        }
        .login-tagline {
          text-align: center;
          font-size: 11px;
          font-weight: 600;
          color: #475569;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          margin-bottom: 32px;
        }
        .login-divider {
          height: 1px;
          background: linear-gradient(to right, transparent, rgba(51,65,100,0.8), transparent);
          margin: 0 0 28px;
        }
        .login-label {
          display: block;
          font-size: 10.5px;
          font-weight: 700;
          color: #64748b;
          margin-bottom: 7px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .login-select, .login-input {
          width: 100%;
          padding: 13px 16px;
          background: rgba(8, 14, 28, 0.75);
          border: 1px solid rgba(51,65,100,0.65);
          border-radius: 10px;
          color: #e2e8f0;
          font-size: 14px;
          font-family: inherit;
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.18s, box-shadow 0.18s;
          -webkit-appearance: none;
        }
        .login-select:focus, .login-input:focus {
          border-color: rgba(191,30,46,0.65);
          box-shadow: 0 0 0 3px rgba(191,30,46,0.10);
        }
        .login-select.filled, .login-input.filled {
          border-color: rgba(191,30,46,0.45);
        }
        .login-select option { background: #1e293b; }
        .login-pin {
          font-size: 28px;
          text-align: center;
          letter-spacing: 14px;
          padding: 13px 16px 13px 28px;
        }
        .login-btn {
          width: 100%;
          padding: 14px;
          background: linear-gradient(135deg, #bf1e2e 0%, #8b1420 100%);
          color: #fff;
          border: none;
          border-radius: 10px;
          font-size: 14.5px;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
          letter-spacing: 0.04em;
          transition: transform 0.12s, box-shadow 0.15s, opacity 0.15s;
          box-shadow: 0 4px 18px rgba(191,30,46,0.30);
          margin-top: 4px;
        }
        .login-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 24px rgba(191,30,46,0.40);
        }
        .login-btn:active:not(:disabled) { transform: translateY(0); }
        .login-btn:disabled {
          background: #1e293b;
          color: #475569;
          cursor: not-allowed;
          box-shadow: none;
        }
        .login-error {
          background: rgba(191,30,46,0.10);
          border: 1px solid rgba(191,30,46,0.35);
          border-radius: 9px;
          padding: 11px 14px;
          margin-bottom: 20px;
          color: #fca5a5;
          font-size: 13px;
          text-align: center;
        }
        .login-footer {
          text-align: center;
          font-size: 10.5px;
          color: #334155;
          margin-top: 24px;
          letter-spacing: 0.04em;
        }
        .field-wrap { margin-bottom: 18px; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div className="login-page">
        <div className="login-card">

          {/* Logo */}
          <div className="login-logo-wrap">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="SupaKoto" style={{ width: 186, height: 80, objectFit: "contain" }} />
          </div>

          <p className="login-tagline">نظام حجز المواعيد الداخلي</p>
          <div className="login-divider" />

          {(error || loginError) && (
            <div className="login-error">
              {loginError || "حصل خطأ — حاول تاني"}
            </div>
          )}

          {/* Username */}
          <div className="field-wrap">
            <label className="login-label">اسم المستخدم</label>
            <input
              type="text"
              autoComplete="username"
              placeholder="اسم المستخدم"
              className={`login-input${username ? " filled" : ""}`}
              value={username}
              onChange={e => setUsername(e.target.value)}
            />
          </div>

          {/* Password */}
          <div className="field-wrap" style={{ marginBottom: 26 }}>
            <label className="login-label">كلمة المرور</label>
            <input
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              className={`login-input${password ? " filled" : ""}`}
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
            />
          </div>

          {/* Button */}
          <button
            className="login-btn"
            onClick={handleLogin}
            disabled={loading}
          >
            {loading
              ? <span style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                  <span style={{ width:14, height:14, border:"2px solid rgba(255,255,255,0.3)",
                    borderTopColor:"#fff", borderRadius:"50%", display:"inline-block",
                    animation:"spin 0.75s linear infinite" }} />
                  جاري الدخول...
                </span>
              : "دخول ←"
            }
          </button>

          <p className="login-footer">SupaKoto Internal Tool · Authorized Use Only</p>
        </div>
      </div>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight:"100vh" }} />}>
      <LoginContent />
    </Suspense>
  );
}
