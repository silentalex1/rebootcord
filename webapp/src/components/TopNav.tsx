import { NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Inbox, LogOut, ScrollText, Terminal, ShieldCheck } from "lucide-react";
import { Logo } from "./Logo";
import { Avatar } from "./Avatar";
import { ProfileModal } from "./ProfileModal";
import { useSession } from "../lib/session";
import { api } from "../lib/api";
import { useToast } from "../lib/toast";

const navItems = [
  { to: "/dashboard", label: "Projects", icon: Terminal, end: true },
  { to: "/dashboard/changelogs", label: "Changelogs", icon: ScrollText, end: false },
  { to: "/dashboard/inbox", label: "Inbox", icon: Inbox, end: false },
];

export function TopNav() {
  const { me, refresh } = useSession();
  const navigate = useNavigate();
  const { push } = useToast();
  const [showProfile, setShowProfile] = useState(false);

  const handleLogout = async () => {
    await api.logout();
    await refresh();
    push("Logged out", "info");
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <NavLink to="/" viewTransition>
            <Logo size="sm" />
          </NavLink>
          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => (
              <NavLink
                viewTransition
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }: { isActive: boolean }) =>
                  `flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold transition ${
                    isActive
                      ? "bg-surface-2 text-text"
                      : "text-text-dim hover:bg-surface-2 hover:text-text"
                  }`
                }
              >
                <item.icon size={14} />
                {item.label}
              </NavLink>
            ))}
            {me?.isAdmin && (
              <NavLink
                viewTransition
                to="/dashboard/admin"
                className={({ isActive }: { isActive: boolean }) =>
                  `flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold transition ${
                    isActive
                      ? "bg-surface-2 text-text"
                      : "text-text-dim hover:bg-surface-2 hover:text-text"
                  }`
                }
              >
                <ShieldCheck size={14} />
                Admin
              </NavLink>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {me?.username && (
            <div className="hidden items-center gap-2 sm:flex">
              <span className="text-[13px] font-semibold text-text">
                {me.username}
              </span>
              {me.isAdmin && (
                <span className="rounded-md bg-red-soft px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red">
                  admin
                </span>
              )}
            </div>
          )}
          {me?.username && (
            <Avatar username={me.username} color={me.avatarColor} onClick={() => setShowProfile(true)} />
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 rounded-lg border border-border-bright bg-surface-2 px-3 py-2 text-[13px] font-semibold text-text-dim transition hover:border-red/40 hover:text-red"
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
    </header>
  );
}
