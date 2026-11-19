import type { SupabaseClient } from '@supabase/supabase-js';
import type { GenContent } from './llm';
import { missingFunction } from '../data/databaseCapabilities';

export async function saveMissingAnalysis(client: SupabaseClient, id: string, generated: GenContent) {
  const atomic = await client.rpc('guanwen_fill_analysis', { target_id: id, generated });
  if (!atomic.error) return atomic.data as GenContent;
  if (!missingFunction(atomic.error)) throw atomic.error;
  const { data: current, error } = await client.from('poems')
    .select('annotation,translation,appreciation').eq('id', id).single();
  if (error) throw error;
  for (const field of ['annotation', 'translation', 'appreciation'] as const) {
    if (current[field]?.trim()) continue;
    const value = generated[field]?.trim();
    if (!value) throw new Error('生成内容不完整，请重试');
    let update = client.from('poems').update({ [field]: value }).eq('id', id);
    // Compare the field again at write time so concurrent editorial changes win.
    update = current[field] === null ? update.is(field, null) : update.eq(field, current[field]);
    const { error: writeError } = await update;
    if (writeError) throw writeError;
  }
  const { data: saved, error: readError } = await client.from('poems')
    .select('annotation,translation,appreciation').eq('id', id).single();
  if (readError) throw readError;
  return saved as GenContent;
}
