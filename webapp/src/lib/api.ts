import type {
  ApiKey,
  Changelog,
  EmailSystemConfig,
  FileNode,
  InboxMessage,
  Me,
  Project,
} from "./types";

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: "include",
    headers: init?.body
      ? { "Content-Type": "application/json", ...(init.headers || {}) }
      : init?.headers,
    ...init,
  });
  if (!res.ok && res.status >= 500) {
    throw new Error(`Request to ${url} failed with ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function post<T>(url: string, body?: unknown): Promise<T> {
  return req<T>(url, { method: "POST", body: body ? JSON.stringify(body) : undefined });
}

export const api = {
  me: () => req<Me>("/api/me"),

  register: (payload: { username: string; password: string; invite: string; email?: string }) =>
    post<{ success: boolean; message?: string }>("/register", {
      username: payload.username,
      discordUsername: payload.username,
      password: payload.password,
      invite: payload.invite,
      email: payload.email || undefined,
    }),

  login: (payload: { username: string; password: string }) =>
    post<{ success: boolean; message?: string }>("/login", payload),

  logout: () => post<{ success: boolean }>("/logout"),

  projects: {
    list: () => req<{ success: boolean; projects: Project[] }>("/api/projects"),
    saveAll: (projects: Project[]) =>
      post<{ success: boolean }>("/api/projects", { projects }),
    remove: (id: number) =>
      post<{ success: boolean }>(`/api/projects/${id}/delete`),
    start: (id: number) =>
      post<{ success: boolean; message?: string }>(`/api/projects/${id}/start`),
    stop: (id: number) =>
      post<{ success: boolean }>(`/api/projects/${id}/stop`),
    restart: (id: number) =>
      post<{ success: boolean; message?: string }>(`/api/projects/${id}/restart`),
    kill: (id: number) =>
      post<{ success: boolean }>(`/api/projects/${id}/kill`),
    dir: (id: number) =>
      req<{ success: boolean; files: FileNode[]; needsPassword?: boolean }>(
        `/api/projects/${id}/dir`,
      ),
    readFile: (id: number, name: string) =>
      req<{ success: boolean; content?: string }>(
        `/api/projects/${id}/file?name=${encodeURIComponent(name)}`,
      ),
    saveFile: (id: number, name: string, content: string) =>
      post<{ success: boolean }>(`/api/projects/${id}/savefile`, { name, content }),
    deleteFile: (id: number, name: string) =>
      post<{ success: boolean }>(`/api/projects/${id}/deleteFile`, { name }),
    mkdir: (id: number, name: string) =>
      post<{ success: boolean }>(`/api/projects/${id}/mkdir`, { name }),
    touch: (id: number, name: string) =>
      post<{ success: boolean }>(`/api/projects/${id}/touch`, { name }),
    terminal: (id: number, command: string) =>
      post<{ success: boolean; output: string }>(`/api/projects/${id}/terminal`, {
        command,
      }),
  },

  inbox: {
    list: () => req<{ success: boolean; messages: InboxMessage[] }>("/api/inbox"),
    markRead: (id: number) => post<{ success: boolean }>("/api/inbox/read", { id }),
    remove: (id: number) => post<{ success: boolean }>("/api/inbox/delete", { id }),
    send: (title: string, body: string) =>
      post<{ success: boolean; message?: string }>("/api/inbox/send", { title, body }),
  },

  changelogs: {
    list: () =>
      req<{ success: boolean; changelogs: Changelog[] }>("/api/changelogs"),
    create: (title: string, body: string, generateLink: boolean) =>
      post<{ success: boolean; message?: string }>("/api/changelogs", {
        title,
        body,
        generateLink,
        ts: Date.now(),
      }),
    like: (id: number) =>
      post<{ success: boolean; likes: string[] }>(`/api/changelogs/${id}/like`),
    remove: (id: number) =>
      post<{ success: boolean }>(`/api/changelogs/${id}/delete`),
  },

  apiKeys: {
    list: () => req<{ success: boolean; keys: ApiKey[] }>("/api/v1/apikeys"),
    create: () =>
      post<{ success: boolean; key: string; id: string; masked: string }>(
        "/api/v1/apikeys",
      ),
  },

  emailSystem: {
    get: () =>
      req<{ success: boolean; config: EmailSystemConfig }>(
        "/api/email-system/config",
      ),
    save: (config: EmailSystemConfig) =>
      post<{ success: boolean; message?: string; config?: EmailSystemConfig }>(
        "/api/email-system/config",
        config,
      ),
    test: (to: string, name: string) =>
      post<{ success: boolean; message: string }>("/api/email-system/test", {
        to,
        name,
      }),
  },
};
