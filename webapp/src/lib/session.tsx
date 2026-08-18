import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { api } from "./api";
import { rcSocket } from "./socket";
import type { Me } from "./types";

interface SessionContextValue {
  me: Me | null;
  loading: boolean;
  refresh: () => Promise<void>;
  setAvatarColor: (color: string) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const res = await api.me();
      setMe(res);
    } catch {
      setMe({ loggedIn: false });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (me?.loggedIn) {
      rcSocket.connect();
    } else {
      rcSocket.disconnect();
    }
  }, [me?.loggedIn]);

  const setAvatarColor = (color: string) => {
    setMe((prev) => (prev ? { ...prev, avatarColor: color } : prev));
  };

  return (
    <SessionContext.Provider value={{ me, loading, refresh, setAvatarColor }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
