"use client";

import { useState, Suspense, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";

type PublicAgent = { id: string; name: string; username: string | null };

type Screen = "agents" | "pin" | "manual";

function LoginContent() {
  const params = useSearchParams();
  const urlError = params?.get("error");

  const [screen, setScreen] = useState<Screen>("agents");
  const [agents, setAgents] = useState<PublicAgent[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [agentsError, setAgentsError] = useState("");
  const [selected, setSelected] = useState<PublicAgent | null>(null);
  const [password, setPassword] = useState("");
  const [manualUsername, setManualUsername] = useState("");
  const [manualPassword, setManualPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  const pinRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setAgentsLoading(true);
      setAgentsError("");
      try {
        const res = await fetch("/api/agents/public");
        const data = await res.json().catch(() => []);
        if (!res.ok) {
          if (!cancelled) {
            setAgents([]);
            setAgentsError("تعذر تحميل الأسماء — حاول تاني");
          }
          return;
        }
        if (!cancelled && Array.isArray(data)) {
          setAgents(data as PublicAgent[]);
        }
      } catch {
        if (!cancelled) setAgentsError("تعذر تحميل الأسماء — حاول تاني");
      } finally {
        if (!cancelled) setAgentsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (screen === "pin") {
      pinRef.current?.focus();
    }
  }, [screen]);

  const handleSubmit = async () => {
    if (!selected?.id || !password) {
      setLoginError("اختار اسمك وأدخل الرقم السري");
      return;
    }
    setLoading(true);
    setLoginError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: selected.id,
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

  const handleManualSubmit = async () => {
    if (!manualUsername.trim() || !manualPassword) {
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
          username: manualUsername.trim(),
          password: manualPassword,
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

  const goBackToNames = () => {
    setScreen("agents");
    setPassword("");
    setLoginError("");
  };

  const displayError =
    loginError || (urlError ? "حصل خطأ — حاول تاني" : "");

  const initialLetter = (name: string) => {
    const t = name.trim();
    return t ? t.charAt(0).toUpperCase() : "?";
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
          background: var(--surface-card);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-xl);
          padding: 32px 28px;
          box-shadow: 0 8px 40px rgba(0,0,0,0.5);
        }
        .login-logo-wrap {
          display: flex;
          justify-content: center;
          margin-bottom: 8px;
        }
        .login-title {
          font-size: 24px;
          font-weight: 700;
          text-align: center;
          color: var(--text-primary);
          margin-bottom: 8px;
        }
        .login-subtitle {
          font-size: 14px;
          text-align: center;
          color: var(--text-secondary);
          margin-bottom: 24px;
        }
        .agent-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
          max-height: 360px;
          overflow-y: auto;
        }
        @media (min-width: 640px) {
          .agent-grid { grid-template-columns: repeat(3, 1fr); }
        }
        .agent-btn {
          background: var(--surface-card);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          padding: 12px 16px;
          text-align: center;
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
          cursor: pointer;
          transition: all 0.15s;
          font-family: inherit;
        }
        .agent-btn:hover {
          border-color: rgba(191,30,46,0.4);
          background: var(--surface-elevated);
        }
        .agent-btn.selected {
          border-color: var(--brand-red);
          background: rgba(191,30,46,0.08);
          color: var(--brand-red);
        }
        .agents-loading {
          text-align: center;
          color: var(--text-muted);
          font-size: 14px;
          padding: 24px;
        }
        .agents-err {
          text-align: center;
          color: #fca5a5;
          font-size: 13px;
          padding: 16px;
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .step2-wrap {
          animation: fadeUp 0.2s ease;
        }
        .step2-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 24px;
        }
        .step2-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: var(--brand-red);
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          font-weight: 700;
          flex-shrink: 0;
        }
        .step2-meta {
          flex: 1;
          min-width: 0;
        }
        .step2-name {
          font-size: 16px;
          font-weight: 700;
          color: var(--text-primary);
        }
        .step2-change {
          font-size: 12px;
          color: var(--text-muted);
          background: none;
          border: none;
          cursor: pointer;
          font-family: inherit;
          padding: 0;
          text-decoration: underline;
        }
        .step2-change:hover { color: var(--text-secondary); }
        .login-label {
          display: block;
          font-size: 10.5px;
          font-weight: 700;
          color: #64748b;
          margin-bottom: 7px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .login-pin-input {
          width: 100%;
          height: 56px;
          padding: 0 16px;
          background: var(--surface-input);
          border: 1px solid rgba(51,65,100,0.65);
          border-radius: var(--radius-md);
          color: var(--text-primary);
          font-size: 24px;
          letter-spacing: 0.5em;
          text-align: center;
          font-family: inherit;
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.18s, box-shadow 0.18s;
        }
        .login-pin-input:focus {
          border-color: rgba(191,30,46,0.65);
          box-shadow: 0 0 0 3px rgba(191,30,46,0.10);
        }
        .login-btn {
          width: 100%;
          height: 48px;
          margin-top: 20px;
          background: linear-gradient(135deg, #bf1e2e 0%, #8b1420 100%);
          color: #fff;
          border: none;
          border-radius: var(--radius-md);
          font-size: 14.5px;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
          letter-spacing: 0.04em;
          transition: transform 0.12s, box-shadow 0.15s, opacity 0.15s;
          box-shadow: 0 4px 18px rgba(191,30,46,0.30);
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
          background: var(--error-bg);
          border: 1px solid var(--error-border);
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
        .login-text-input {
          width: 100%;
          padding: 13px 16px;
          height: 48px;
          background: var(--surface-input);
          border: 1px solid rgba(51,65,100,0.65);
          border-radius: var(--radius-md);
          color: var(--text-primary);
          font-size: 15px;
          font-family: inherit;
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.18s, box-shadow 0.18s;
        }
        .login-text-input:focus {
          border-color: rgba(191,30,46,0.65);
          box-shadow: 0 0 0 3px rgba(191,30,46,0.10);
        }
        .agents-empty {
          text-align: center;
          color: var(--text-secondary);
          font-size: 14px;
          line-height: 1.6;
          padding: 12px 8px 16px;
        }
        .login-link-btn {
          display: block;
          width: 100%;
          margin-top: 12px;
          padding: 12px;
          background: transparent;
          border: 1px dashed var(--border-default);
          border-radius: var(--radius-md);
          color: var(--text-muted);
          font-size: 13px;
          font-family: inherit;
          cursor: pointer;
          transition: border-color 0.15s, color 0.15s;
        }
        .login-link-btn:hover {
          border-color: rgba(191,30,46,0.35);
          color: var(--text-secondary);
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div className="login-page">
        <div className="login-card">
          <div className="login-logo-wrap">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.svg"
              alt="SupaKoto"
              style={{ width: 120, height: "auto", objectFit: "contain" }}
            />
          </div>

          {screen === "agents" && (
            <>
              <h1 className="login-title">مرحباً 👋</h1>
              <p className="login-subtitle">اختار اسمك</p>

              {displayError && (
                <div className="login-error">{displayError}</div>
              )}

              {agentsLoading && (
                <div className="agents-loading">جاري التحميل…</div>
              )}
              {!agentsLoading && agentsError && (
                <div className="agents-err">{agentsError}</div>
              )}
              {!agentsLoading && !agentsError && agents.length > 0 && (
                <div className="agent-grid">
                  {agents.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      className={
                        "agent-btn" +
                        (selected?.id === a.id ? " selected" : "")
                      }
                      onClick={() => {
                        setSelected(a);
                        setScreen("pin");
                        setLoginError("");
                      }}
                    >
                      {a.name}
                    </button>
                  ))}
                </div>
              )}
              {!agentsLoading && !agentsError && agents.length === 0 && (
                <p className="agents-empty">
                  لم تُحمَّل أي أسماء — إمّا لا يوجد مندوبون مفعّلون، أو إعدادات
                  الخادم تحتاج مراجعة. يمكنك أدناه تسجيل الدخول باسم المستخدم
                  وكلمة المرور.
                </p>
              )}
              {!agentsLoading && (
                <button
                  type="button"
                  className="login-link-btn"
                  onClick={() => {
                    setScreen("manual");
                    setLoginError("");
                  }}
                >
                  أو تسجيل الدخول باسم المستخدم وكلمة المرور
                </button>
              )}
            </>
          )}

          {screen === "manual" && (
            <div className="step2-wrap">
              {displayError && (
                <div className="login-error">{displayError}</div>
              )}
              <h1 className="login-title" style={{ marginBottom: 8 }}>
                تسجيل الدخول
              </h1>
              <p className="login-subtitle" style={{ marginBottom: 20 }}>
                اسم المستخدم كما هو مسجّل في النظام
              </p>
              <div className="field-wrap">
                <label className="login-label" htmlFor="manual-user">
                  اسم المستخدم
                </label>
                <input
                  id="manual-user"
                  type="text"
                  autoComplete="username"
                  className="login-text-input"
                  value={manualUsername}
                  onChange={(e) => setManualUsername(e.target.value)}
                />
              </div>
              <div className="field-wrap" style={{ marginBottom: 8 }}>
                <label className="login-label" htmlFor="manual-pass">
                  كلمة المرور
                </label>
                <input
                  id="manual-pass"
                  type="password"
                  autoComplete="current-password"
                  className="login-text-input"
                  value={manualPassword}
                  onChange={(e) => setManualPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleManualSubmit();
                  }}
                />
              </div>
              <button
                className="login-btn"
                type="button"
                style={{ marginTop: 12 }}
                onClick={handleManualSubmit}
                disabled={loading}
              >
                {loading ? "جاري الدخول..." : "دخول ←"}
              </button>
              <button
                type="button"
                className="step2-change"
                style={{ display: "block", marginTop: 16, width: "100%" }}
                onClick={() => {
                  setScreen("agents");
                  setLoginError("");
                }}
              >
                ← الرجوع لاختيار الاسم من القائمة
              </button>
            </div>
          )}

          {screen === "pin" && selected && (
            <div className="step2-wrap">
              {displayError && <div className="login-error">{displayError}</div>}

              <div className="step2-header">
                <div className="step2-avatar" aria-hidden>
                  {initialLetter(selected.name)}
                </div>
                <div className="step2-meta">
                  <div className="step2-name">{selected.name}</div>
                  <button
                    type="button"
                    className="step2-change"
                    onClick={goBackToNames}
                  >
                    تغيير
                  </button>
                </div>
              </div>

              <div className="field-wrap" style={{ marginBottom: 0 }}>
                <label className="login-label" htmlFor="login-pin">
                  الرقم السري
                </label>
                <input
                  id="login-pin"
                  ref={pinRef}
                  type="password"
                  inputMode="numeric"
                  autoComplete="current-password"
                  maxLength={4}
                  placeholder="••••"
                  className="login-pin-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSubmit();
                  }}
                />
              </div>

              <button
                className="login-btn"
                type="button"
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                    }}
                  >
                    <span
                      style={{
                        width: 14,
                        height: 14,
                        border: "2px solid rgba(255,255,255,0.3)",
                        borderTopColor: "#fff",
                        borderRadius: "50%",
                        display: "inline-block",
                        animation: "spin 0.75s linear infinite",
                      }}
                    />
                    جاري الدخول...
                  </span>
                ) : (
                  "دخول ←"
                )}
              </button>
            </div>
          )}

          <p className="login-footer">SupaKoto Internal Tool · Authorized Use Only</p>
        </div>
      </div>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh" }} />}>
      <LoginContent />
    </Suspense>
  );
}
