import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bot, Server, Zap, ShieldCheck, ArrowRight, Clock } from "lucide-react";
import { Logo } from "../components/Logo";
import { Avatar } from "../components/Avatar";
import { ProfileModal } from "../components/ProfileModal";
import { useSession } from "../lib/session";

export function HomePage() {
  const navigate = useNavigate();
  const { me } = useSession();
  const [showWelcome, setShowWelcome] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  useEffect(() => {
    if (!me?.username) return;
    const key = `rc_welcome_shown_${me.username}`;
    if (!sessionStorage.getItem(key)) {
      setShowWelcome(true);
      sessionStorage.setItem(key, "1");
    }
  }, [me?.username]);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 45% at 50% -5%, rgba(239,70,85,0.14), transparent 60%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "linear-gradient(to right, #ffffff05 1px, transparent 1px), linear-gradient(to bottom, #ffffff05 1px, transparent 1px)",
          backgroundSize: "42px 42px",
        }}
      />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Logo size="sm" />
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/our-api")}
            className="rounded-lg px-4 py-2 text-[13px] font-semibold text-text-dim transition hover:text-text"
          >
            Our API
          </button>
          {me?.loggedIn && me.username ? (
            <>
              <button
                onClick={() => navigate("/dashboard")}
                className="rounded-lg bg-red px-4 py-2 text-[13px] font-bold text-white transition hover:bg-red-dark"
              >
                Dashboard
              </button>
              <Avatar username={me.username} color={me.avatarColor} onClick={() => setShowProfile(true)} />
            </>
          ) : (
            <>
              <button
                onClick={() => navigate("/login")}
                className="rounded-lg px-4 py-2 text-[13px] font-semibold text-text-dim transition hover:text-text"
              >
                Login
              </button>
              <button
                onClick={() => navigate("/account-setup")}
                className="rounded-lg bg-red px-4 py-2 text-[13px] font-bold text-white transition hover:bg-red-dark"
              >
                Create account
              </button>
            </>
          )}
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-3xl px-6 pb-24 pt-16 text-center">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border-bright bg-surface-2 px-3.5 py-1.5 font-mono text-[11px] tracking-wide text-text-dim">
          <Zap size={12} className="text-red" />
          Official beta release
        </div>

        <h1 className="mb-5 text-[40px] font-extrabold leading-tight tracking-tight sm:text-[52px]">
          Host your Discord bot.
          <br />
          <span className="text-red">Free. Always on.</span>
        </h1>

        <p className="mx-auto mb-9 max-w-xl text-[15px] leading-relaxed text-text-dim">
          Reboot Cord keeps your Discord bot running 24/7, so it never goes
          offline. Just upload your code, hit start, and we take care of the
          rest.
        </p>

        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          {me?.loggedIn ? (
            <button
              onClick={() => navigate("/dashboard")}
              className="flex items-center gap-2 rounded-xl bg-red px-6 py-3.5 text-[14px] font-bold text-white transition hover:bg-red-dark"
            >
              Go to dashboard
              <ArrowRight size={16} />
            </button>
          ) : (
            <>
              <button
                onClick={() => navigate("/account-setup")}
                className="flex items-center gap-2 rounded-xl bg-red px-6 py-3.5 text-[14px] font-bold text-white transition hover:bg-red-dark"
              >
                Create your account
                <ArrowRight size={16} />
              </button>
              <button
                onClick={() => navigate("/login")}
                className="rounded-xl border border-border-bright bg-surface-2 px-6 py-3.5 text-[14px] font-bold text-text transition hover:bg-surface-3"
              >
                I already have an account
              </button>
            </>
          )}
        </div>
      </main>

      <section className="relative z-10 mx-auto max-w-5xl px-6 pb-24 [container-type:inline-size]">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon={<Bot size={20} />}
            title="Discord bots, 24/7"
            desc="Upload your bot's code and Reboot Cord keeps it online around the clock, even while you sleep."
            live
          />
          <FeatureCard
            icon={<Server size={20} />}
            title="Minecraft hosting"
            desc="24/7 Minecraft server hosting is coming soon. Same easy setup, always-on uptime."
            live={false}
          />
          <FeatureCard
            icon={<Clock size={20} />}
            title="Zero downtime setup"
            desc={
              <>
                No servers to manage. Create a project, click{" "}
                <Code>install all dependencies</Code> and click <Code>start</Code>{" "}
                that's it.
              </>
            }
            live
          />
        </div>

        <div className="mt-14 rounded-2xl border border-border bg-surface p-8 text-center sm:p-10">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-surface-3 text-red">
            <ShieldCheck size={20} />
          </div>
          <h2 className="mb-2 text-[20px] font-bold tracking-tight">
            Simple, honest hosting
          </h2>
          <p className="mx-auto mb-6 max-w-md text-[13.5px] leading-relaxed text-text-dim">
            No confusing dashboards. No hidden fees. Just a place to keep your
            Discord bot running, with Minecraft server hosting on the way.
          </p>
          <button
            onClick={() => navigate(me?.loggedIn ? "/dashboard" : "/account-setup")}
            className="rounded-lg bg-red px-5 py-2.5 text-[13px] font-bold text-white transition hover:bg-red-dark"
          >
            {me?.loggedIn ? "Go to dashboard" : "Get started for free"}
          </button>
        </div>
      </section>

      <footer className="relative z-10 border-t border-border py-8 text-center">
        <p className="font-mono text-[11px] text-text-mute">
          Reboot Cord &middot; Official beta release
        </p>
      </footer>

      {showWelcome && me?.username && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 text-center shadow-2xl shadow-black/50">
            <div className="mb-4 flex justify-center">
              <Avatar username={me.username} color={me.avatarColor} size={48} />
            </div>
            <h2 className="mb-5 text-[18px] font-bold">Welcome {me.username}</h2>
            <button
              onClick={() => setShowWelcome(false)}
              className="w-full rounded-lg bg-red py-2.5 text-[13px] font-bold text-white transition hover:bg-red-dark"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md bg-surface-3 px-1.5 py-0.5 font-mono text-[12px] text-text-dim">
      {children}
    </span>
  );
}

function FeatureCard({
  icon,
  title,
  desc,
  live,
}: {
  icon: React.ReactNode;
  title: string;
  desc: React.ReactNode;
  live: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-6 text-left transition hover:border-border-bright">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-3 text-red">
          {icon}
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
            live ? "bg-green-soft text-green" : "bg-amber-soft text-amber"
          }`}
        >
          {live ? "Available" : "Coming soon"}
        </span>
      </div>
      <h3 className="mb-1.5 text-[15px] font-bold tracking-tight">{title}</h3>
      <p className="text-[13px] leading-relaxed text-text-dim">{desc}</p>
    </div>
  );
}
