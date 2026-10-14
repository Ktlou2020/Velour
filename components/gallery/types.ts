export interface GalleryPhoto {
  id: string;
  url: string;
  thumbnailUrl?: string | null;
  caption?: string | null;
  isProfile: boolean;
  isPrivate: boolean;
  albumId?: string | null;
  order: number;
  createdAt: string;
}

export interface AlbumSummary {
  id: string;
  name: string;
  description?: string | null;
  isPrivate: boolean;
  coverPhotoId?: string | null;
  coverUrl: string | null;
  photoCount: number;
  grantedCount?: number;
  pendingCount?: number;
}

export interface PersonSummary {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface SharedAlbum extends AlbumSummary {
  owner: PersonSummary;
  grantedAt: string;
}

export interface AccessEntry extends PersonSummary {
  status: 'GRANTED' | 'REQUESTED';
  since: string;
}

export async function api<T = Record<string, unknown>>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(url, {
    ...rest,
    headers: json !== undefined ? { 'Content-Type': 'application/json', ...(rest.headers ?? {}) } : rest.headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const data = await res.json().catch(() => ({})) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
