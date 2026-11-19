import type { SupabaseClient } from '@supabase/supabase-js';

export async function authorId(client: SupabaseClient, id: string): Promise<string> {
  const { data, error } = await client.from('authors').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data?.canonical_author_id || id;
}

export function missingFunction(error: { code?: string } | null) {
  return error?.code === 'PGRST202' || error?.code === '42883';
}

const cache = new Map<string, { until: number; promise: Promise<unknown> }>();
export function cached<T>(key: string, load: () => Promise<T>, milliseconds = 30000): Promise<T> {
  const entry = cache.get(key);
  if (entry && entry.until > Date.now()) return entry.promise as Promise<T>;
  const promise = load().catch((reason) => { cache.delete(key); throw reason; });
  if (cache.size >= 500) cache.delete(cache.keys().next().value!);
  cache.set(key, { until: Date.now() + milliseconds, promise });
  return promise;
}
