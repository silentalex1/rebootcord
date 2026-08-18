import { useState } from "react";
import type { FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Lock, KeyRound, User, Mail } from "lucide-react";
import { Logo } from "../components/Logo";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { useToast } from "../lib/toast";

type Tab = "register" | "login";

export function AuthPage() {
  const location = useLocation();
  const tab: Tab = location.pathname === "/login" ? "login" : "register";
  const navigate = useNavigate();
  const { refresh } = useSession();
  const { push } = useToast();

  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regInvite, setRegInvite] = useState("");
  const [regEmail, setRegEmail] = useState("");

  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const goToDashboard = async () => {
    await refresh();
    navigate("/dashboard");
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    if (!regUsername.trim() || !regPassword.trim() || !regInvite.trim()) {
      setMessage({ text: "All fields are required.", ok: false });
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await api.register({
        username: regUsername.trim(),
        password: regPassword,
        invite: regInvite.trim(),
        email: regEmail.trim(),
      });
      if (res.success) {
        setMessage({ text: "Account created. Redirecting...", ok: true });
        push(`${regUsername.trim()} has created their account.`, "success");
        setTimeout(goToDashboard, 600);
      } else {
        setMessage({ text: res.message || "Could not create account.", ok: false });
        setSubmitting(false);
      }
    } catch {
      setMessage({ text: "Server error. Try again.", ok: false });
      setSubmitting(false);
    }
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!loginUsername.trim() || !loginPassword.trim()) {
      setMessage({ text: "All fields are required.", ok: false });
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await api.login({
        username: loginUsername.trim(),
        password: loginPassword,
      });
      if (res.success) {
        setMessage({ text: "Welcome back. Redirecting...", ok: true });
        push(`${loginUsername.trim()} has logged in.`, "success");
        setTimeout(goToDashboard, 600);
      } else {
        setMessage({ text: res.message || "Could not log in.", ok: false });
        setSubmitting(false);
      }
    } catch {
      setMessage({ text: "Server error. Try again.", ok: false });
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
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(to right, #ffffff05 1px, transparent 1px), linear-gradient(to bottom, #ffffff05 1px, transparent 1px)",
          backgroundSize: "42px 42px",
        }}
      />

      <div className="relative z-10 w-full max-w-[400px]">
        <button
          onClick={() => navigate("/")}
          className="mb-6 flex items-center gap-1.5 text-[13px] font-semibold text-text-dim transition hover:text-text"
        >
          <ArrowLeft size={14} />
          Go back
        </button>

        <div className="mb-8 text-center">
          <div className="mb-2 flex justify-center">
            <Logo size="lg" spaced />
          </div>
          <p className="font-mono text-[11px] tracking-wider text-text-mute">
            Official beta release
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-6 shadow-2xl shadow-black/30">
          <div className="mb-6 flex gap-1 rounded-xl bg-surface-2 p-1">
            <TabButton active={tab === "register"} onClick={() => { navigate("/account-setup"); setMessage(null); }}>
              Create account
            </TabButton>
            <TabButton active={tab === "login"} onClick={() => { navigate("/login"); setMessage(null); }}>
              Login
            </TabButton>
          </div>

          {tab === "register" ? (
            <form onSubmit={handleRegister} className="space-y-3.5">
              <h1 className="mb-1 text-[16px] font-bold tracking-tight">
                Create your account
              </h1>
              <Field
                label="Discord username"
                icon={<User size={14} />}
                value={regUsername}
                onChange={setRegUsername}
                placeholder="Enter your Discord username"
                autoComplete="username"
              />
              <Field
                label="Email (optional)"
                icon={<Mail size={14} />}
                type="email"
                value={regEmail}
                onChange={setRegEmail}
                placeholder="you@example.com"
                autoComplete="email"
              />
              <Field
                label="Password"
                icon={<Lock size={14} />}
                type="password"
                value={regPassword}
                onChange={setRegPassword}
                placeholder="At least 8 characters"
                autoComplete="new-password"
              />
              <div>
                <Field
                  label="Invite code"
                  icon={<KeyRound size={14} />}
                  value={regInvite}
                  onChange={setRegInvite}
                  placeholder="rebootcord-xxxxx-xxxxxxx"
                />
                <p className="mt-1.5 font-mono text-[10px] text-text-mute">
                  Format: rebootcord-xxxxx-xxxxxxx
                </p>
              </div>
              <SubmitButton submitting={submitting} idleLabel="Create account" busyLabel="Creating..." />
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-3.5">
              <h1 className="mb-1 text-[16px] font-bold tracking-tight">
                Login to your account
              </h1>
              <Field
                label="Discord username"
                icon={<User size={14} />}
                value={loginUsername}
                onChange={setLoginUsername}
                placeholder="Enter your Discord username"
                autoComplete="username"
              />
              <Field
                label="Password"
                icon={<Lock size={14} />}
                type="password"
                value={loginPassword}
                onChange={setLoginPassword}
                placeholder="Enter your password"
                autoComplete="current-password"
              />
              <SubmitButton submitting={submitting} idleLabel="Login" busyLabel="Logging in..." />
              <button
                type="button"
                onClick={() => navigate("/reset-password")}
                className="w-full text-center text-[12px] font-semibold text-red transition hover:text-red-dark"
              >
                Forgot your password?
              </button>
            </form>
          )}

          {message && (
            <p
              className={`mt-3 rounded-lg border px-3 py-2.5 text-center text-[12px] ${
                message.ok
                  ? "border-green/30 bg-green-soft text-green"
                  : "border-red/30 bg-red-soft text-red"
              }`}
            >
              {message.text}
            </p>
          )}
        </div>

        <p className="mt-5 text-center font-mono text-[11px] text-text-mute">
          Reboot Cord beta &nbsp;·&nbsp; Invite only
        </p>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-lg py-2 text-[12px] font-bold transition ${
        active ? "bg-surface-3 text-text" : "text-text-mute hover:text-text-dim"
      }`}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  icon,
  value,
  onChange,
  placeholder,
  type = "text",
  autoComplete,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
  autoComplete?: string;
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
          autoComplete={autoComplete}
          id={`auth-${label.toLowerCase().replace(/\s+/g, "-")}`}
          name={label.toLowerCase().replace(/\s+/g, "-")}
          className="w-full bg-transparent text-[13px] text-text outline-none placeholder:text-text-mute"
        />
      </div>
    </label>
  );
}

function SubmitButton({
  submitting,
  idleLabel,
  busyLabel,
}: {
  submitting: boolean;
  idleLabel: string;
  busyLabel: string;
}) {
  return (
    <button
      type="submit"
      disabled={submitting}
      className="flex w-full items-center justify-center gap-2 rounded-lg bg-red py-2.5 text-[13px] font-bold text-white transition hover:bg-red-dark disabled:opacity-70"
    >
      {submitting && <Loader2 size={14} className="animate-spin" />}
      {submitting ? busyLabel : idleLabel}
    </button>
  );
}
