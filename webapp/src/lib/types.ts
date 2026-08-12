export type ProjectType = "discord" | "minecraft";

export interface Project {
  id: number;
  name: string;
  type: ProjectType;
  lang: string;
  version?: string;
  serverType?: string;
  ip?: string;
  port?: number;
  running: boolean;
  files?: Record<string, string>;
}

export interface FileNode {
  name: string;
  rel: string;
  isDir: boolean;
  size: number;
  children?: FileNode[];
}

export interface InboxMessage {
  id: number;
  title: string;
  body: string;
  ts: number;
  read: boolean;
  sender?: string;
  rank?: string;
  variant?: string;
  linkText?: string;
  linkUrl?: string;
}

export interface Changelog {
  id: number;
  title: string;
  body: string;
  author: string;
  ts: number;
  likes: string[];
  hasLink?: boolean;
  slug?: string;
}

export interface ApiKey {
  id: string;
  created: string;
  masked: string;
}

export interface EmailSystemConfig {
  fromName: string;
  subject: string;
  message: string;
  enabled: boolean;
  updated?: string;
}

export interface Me {
  loggedIn: boolean;
  username?: string;
  isAdmin?: boolean;
}
