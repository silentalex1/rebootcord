import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Lock, Mail, User } from "lucide-react";
import { Logo } from "../components/Logo";
import { api } from "../lib/api";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (!done) return;
    if (countdown <= 0) {
      navigate("/login");
      return;
    }
    const t = window.setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [done, countdown]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !username.trim() || !password.trim()) {
      setError("All fields are required.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await api.resetPassword({
        email: email.trim(),
        username: username.trim(),
        newPassword: password,
      });
      if (res.success) {
        setDone(true);
      } else {
        setError(res.message || "Could not reset password.");
      }
    } catch {
      setError("Server error. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-10">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 45% at 50% -5%, rgba(239,70,85,0.12), transparent 60%)",
        }}
      />
      <div className="relative z-10 w-full max-w-[400px]">
        <button
          onClick={() => navigate("/login")}
          className="mb-6 flex items-center gap-1.5 text-[13px] font-semibold text-text-dim transition hover:text-text"
        >
          <ArrowLeft size={14} />
          Go back
        </button>

        <div className="mb-8 text-center">
          <div className="mb-2 flex justify-center">
            <Logo size="lg" spaced />
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-6 text-center shadow-2xl shadow-black/30">
          {done ? (
            <>
              <h1 className="mb-2 text-[16px] font-bold tracking-tight">
                Redirecting you to login... [{countdown}s]
              </h1>
              <p className="text-[13px] text-text-dim">Check your email.</p>
            </>
          ) : (
            <form onSubmit={submit} className="space-y-3.5 text-left">
              <h1 className="mb-1 text-center text-[16px] font-bold tracking-tight">
                Reset your password
              </h1>
              <Field label="Your email" icon={<Mail size={14} />} type="email" value={email} onChange={setEmail} placeholder="you@example.com" />
              <Field label="Your username" icon={<User size={14} />} value={username} onChange={setUsername} placeholder="Discord username" />
              <Field label="New password" icon={<Lock size={14} />} type="password" value={password} onChange={setPassword} placeholder="At least 8 characters" />
              {error && (
                <p className="rounded-lg border border-red/30 bg-red-soft px-3 py-2.5 text-center text-[12px] text-red">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-red py-2.5 text-[13px] font-bold text-white transition hover:bg-red-dark disabled:opacity-70"
              >
                {submitting && <Loader2 size={14} className="animate-spin" />}
                {submitting ? "Resetting..." : "Reset password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  icon,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-text-mute">
        {label}
      </span>
      <div className="flex items-center gap-2.5 rounded-lg border border-border bg-surface-2 px-3 py-2.5 transition focus-within:border-red focus-within:bg-surface">
        <span className="text-text-mute">{icon}</span>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          id={`reset-${label.toLowerCase().replace(/\s+/g, "-")}`}
          name={label.toLowerCase().replace(/\s+/g, "-")}
          className="w-full bg-transparent text-[13px] text-text outline-none placeholder:text-text-mute"
        />
      </div>
    </label>
  );
}
