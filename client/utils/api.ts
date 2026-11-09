import { getLocalContent } from '@/data/localContent';

/**
 * 后端 API 基础地址
 * - 运行时由平台注入 EXPO_PUBLIC_BACKEND_BASE_URL
 */
export const API_BASE = (process.env.EXPO_PUBLIC_BACKEND_BASE_URL ?? '').replace(/\/$/, '');

// Coze and deployments use the original API by default. Only local previews opt in to selected readings.
export const hasBackend = !!API_BASE || process.env.EXPO_PUBLIC_USE_LOCAL_CONTENT !== '1';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    let msg = `请求失败(${res.status})`;
    try {
      const body = await res.json();
      msg = body?.error || msg;
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export const Api = {
  get<T>(path: string): Promise<T> {
    return hasBackend ? request<T>(path) : Promise.resolve().then(() => getLocalContent(path) as T);
  },
  post<T>(path: string, body?: unknown): Promise<T> {
    return hasBackend ? request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) }) : Promise.resolve(undefined as T);
  },
};

export interface AuthorSummary {
  id: string; name: string; name_traditional?: string | null; dynasty: string;
  avatar_emoji?: string | null; bio?: string | null; poem_count?: number;
}

export interface WorkSummary {
  id: string; name: string; era?: string | null; description?: string | null;
  cover_emoji?: string | null; author_id?: string | null; author_name?: string | null; poem_count?: number;
}

export interface Paged<T> { list: T[]; page: number; pageSize: number; total: number; totalPages: number; }

export interface PoemSummary {
  id: string; title: string; dynasty: string; genre: string; content: string;
  cover_emoji?: string | null; background_hint?: string | null;
  author_id?: string | null; author_name?: string | null; author_emoji?: string | null;
  work_id?: string | null; work_name?: string | null;
}

export interface PinyinChar { c: string; p: string }

export interface PoemDetail extends PoemSummary {
  content_traditional?: string | null;
  pinyin?: PinyinChar[][];
  annotation?: string | null;
  translation?: string | null;
  appreciation?: string | null;
  read_count?: number;
  creation_background?: string | null;
}

export interface Relationship {
  id: string; relation: string; note?: string | null;
  related_author_id?: string | null;
  related_author?: { name?: string; avatar_emoji?: string | null; dynasty?: string | null } | null;
}

export interface AuthorDetail extends AuthorSummary {
  works: WorkSummary[];
  poems: PoemSummary[];
  relationships: Relationship[];
}
