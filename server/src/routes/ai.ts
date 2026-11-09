import { Router } from 'express';
import { getSupabaseClient } from '../storage/database/supabase-client';
import { generateBio, generateContent, HeaderUtils } from '../ai/llm';

const router: Router = Router();
const client = getSupabaseClient();

// 简易并发去重：同一目标同时只生成一次（单进程内有效）
const inflight = new Map<string, Promise<any>>();

async function runOnce<T>(key: string, fn: () => Promise<T>): Promise<T> {
  if (inflight.has(key)) return inflight.get(key) as Promise<T>;
  const p = fn().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

// 生成诗人生平并写回 authors.bio
router.post('/ai/bio', async (req, res) => {
  const headers = HeaderUtils.extractForwardHeaders(req.headers as unknown as Record<string, string>);
  try {
    const { author_id } = req.body || {};
    if (!author_id) return res.status(400).json({ error: '缺少 author_id' });

    const { data: author } = await client
      .from('authors').select('id, name, dynasty, bio').eq('id', author_id).maybeSingle();
    if (!author) return res.status(404).json({ error: '作者不存在' });
    if (author.bio && author.bio.trim()) return res.json({ ok: true, cached: true, bio: author.bio });

    const extra = `在有可靠史料的前提下，可结合其代表作类型书写；朝代：${author.dynasty}。`;
    const bio = await runOnce(`bio:${author_id}`, () =>
      generateBio(author.name, author.dynasty || '不详', extra, headers));

    const trimmed = bio.trim();
    await client.from('authors').update({ bio: trimmed }).eq('id', author_id);
    res.json({ ok: true, cached: false, bio: trimmed });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 生成诗文注解/翻译/赏析并写回 poems
router.post('/ai/analysis', async (req, res) => {
  const headers = HeaderUtils.extractForwardHeaders(req.headers as unknown as Record<string, string>);
  try {
    const { poem_id } = req.body || {};
    if (!poem_id) return res.status(400).json({ error: '缺少 poem_id' });

    const { data: poem } = await client
      .from('poems')
      .select('id, title, dynasty, genre, content, annotation, translation, appreciation, authors(name)')
      .eq('id', poem_id).maybeSingle();
    if (!poem) return res.status(404).json({ error: '诗文不存在' });
    if (poem.annotation && poem.translation && poem.appreciation) {
      return res.json({ ok: true, cached: true, annotation: poem.annotation, translation: poem.translation, appreciation: poem.appreciation });
    }

    const result = await runOnce(`analysis:${poem_id}`, () =>
      generateContent(poem.title, poem.authors?.[0]?.name || '佚名', poem.dynasty, poem.content, headers));

    const annotation = result.annotation || null;
    const translation = result.translation || null;
    const appreciation = result.appreciation || null;
    await client.from('poems').update({ annotation, translation, appreciation }).eq('id', poem_id);
    res.json({ ok: true, cached: false, annotation, translation, appreciation });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;