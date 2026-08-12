import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useSession } from "../lib/session";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { me, loading } = useSession();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-text-mute">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  if (!me?.loggedIn) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
