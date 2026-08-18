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
  owner?: string;
  locked?: boolean;
  perms?: SharePerms;
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
  popupVariant?: string;
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
  apiKeyId?: string | null;
  updated?: string;
}

export interface Me {
  loggedIn: boolean;
  username?: string;
  isAdmin?: boolean;
  avatarColor?: string;
}

export interface SharePerms {
  editFiles: boolean;
  changeName: boolean;
  fullAccess: boolean;
}

export interface SharedUser {
  username: string;
  perms: SharePerms;
}

export interface ProjectAccess {
  success: boolean;
  isOwner?: boolean;
  isShared?: boolean;
  perms?: SharePerms;
  locked?: boolean;
  hasPassword?: boolean;
  private?: boolean;
  name?: string;
  password?: string;
  shared?: SharedUser[];
  notFound?: boolean;
  removed?: boolean;
}

export interface ShareInvite {
  id: string;
  recipient: string;
  sender: string;
  projectId: number;
  projectName: string;
  ts: number;
  seen: boolean;
}
