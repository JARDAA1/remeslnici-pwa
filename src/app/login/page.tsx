"use client";

/**
 * Login / Registration page.
 *
 * Single page with two modes:
 * - Login (email + password)
 * - Register (email + password + confirm password)
 *
 * Redirects to /work on successful auth.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/supabase/AuthProvider";

type Mode = "login" | "register";

export default function LoginPage() {
  const { login, register, user, loading } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Already logged in → redirect
  if (!loading && user) {
    router.replace("/work");
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");

    if (!email.trim() || !password) {
      setError("Vyplňte e-mail a heslo.");
      return;
    }

    if (mode === "register") {
      if (password.length < 6) {
        setError("Heslo musí mít alespoň 6 znaků.");
        return;
      }
      if (password !== passwordConfirm) {
        setError("Hesla se neshodují.");
        return;
      }
    }

    setSubmitting(true);

    if (mode === "login") {
      const { error: err } = await login(email, password);
      if (err) {
        setError(err);
        setSubmitting(false);
      } else {
        router.replace("/work");
      }
    } else {
      const { error: err } = await register(email, password);
      if (err) {
        setError(err);
        setSubmitting(false);
      } else {
        setInfo("Registrace úspěšná. Zkontrolujte e-mail pro potvrzení.");
        setSubmitting(false);
      }
    }
  }

  if (loading) {
    return <p style={{ padding: 32, textAlign: "center" }}>Načítám…</p>;
  }

  return (
    <div style={{ paddingTop: 40 }}>
      <h1 style={{ textAlign: "center" }}>
        {mode === "login" ? "Přihlášení" : "Registrace"}
      </h1>

      {error && <p className="error-message">{error}</p>}
      {info && <p className="success-message">{info}</p>}

      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: 12 }}
      >
        <label>
          E-mail:
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </label>

        <label>
          Heslo:
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
          />
        </label>

        {mode === "register" && (
          <label>
            Heslo znovu:
            <input
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              autoComplete="new-password"
              required
            />
          </label>
        )}

        <button
          type="submit"
          disabled={submitting}
          data-primary=""
          style={{ marginTop: 8 }}
        >
          {submitting
            ? "Čekejte…"
            : mode === "login"
            ? "Přihlásit se"
            : "Zaregistrovat se"}
        </button>
      </form>

      <p style={{ textAlign: "center", marginTop: 16 }}>
        {mode === "login" ? (
          <>
            Nemáte účet?{" "}
            <button
              type="button"
              onClick={() => {
                setMode("register");
                setError("");
                setInfo("");
              }}
              style={{
                background: "none",
                border: "none",
                color: "#0066cc",
                cursor: "pointer",
                textDecoration: "underline",
                width: "auto",
                minHeight: "auto",
                padding: 0,
                fontSize: 16,
              }}
            >
              Zaregistrujte se
            </button>
          </>
        ) : (
          <>
            Máte účet?{" "}
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError("");
                setInfo("");
              }}
              style={{
                background: "none",
                border: "none",
                color: "#0066cc",
                cursor: "pointer",
                textDecoration: "underline",
                width: "auto",
                minHeight: "auto",
                padding: 0,
                fontSize: 16,
              }}
            >
              Přihlaste se
            </button>
          </>
        )}
      </p>
    </div>
  );
}
