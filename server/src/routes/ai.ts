import { Router } from 'express';
import { authorId } from '../data/databaseCapabilities';
import { saveMissingAnalysis } from '../ai/saveAnalysis';
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
    const requestedId = req.body?.author_id;
    if (!requestedId) return res.status(400).json({ error: '缺少 author_id' });
    const author_id = await authorId(client, requestedId);

    const { data: author, error: readError } = await client
      .from('authors').select('id, name, dynasty, bio').eq('id', author_id).maybeSingle();
    if (readError) throw readError;
    if (!author) return res.status(404).json({ error: '作者不存在' });
    if (author.bio && author.bio.trim()) return res.json({ ok: true, cached: true, bio: author.bio });

    const extra = `在有可靠史料的前提下，可结合其代表作类型书写；朝代：${author.dynasty}。`;
    const bio = await runOnce(`bio:${author_id}`, async () => {
      const generated = (await generateBio(author.name, author.dynasty || '不详', extra, headers)).trim();
      if (!generated) throw new Error('生平生成结果为空，请重试');
      let write = client.from('authors').update({ bio: generated }).eq('id', author_id);
      write = author.bio === null ? write.is('bio', null) : write.eq('bio', author.bio);
      const { error: writeError } = await write;
      if (writeError) throw writeError;
      const { data: saved, error: savedError } = await client.from('authors').select('bio').eq('id', author_id).single();
      if (savedError) throw savedError;
      return saved.bio;
    });
    res.json({ ok: true, cached: false, bio });
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

    const { data: poem, error: readError } = await client
      .from('poems')
      .select('id, title, dynasty, genre, content, annotation, translation, appreciation, authors(name)')
      .eq('id', poem_id).maybeSingle();
    if (readError) throw readError;
    if (!poem) return res.status(404).json({ error: '诗文不存在' });
    if (poem.annotation?.trim() && poem.translation?.trim() && poem.appreciation?.trim()) {
      return res.json({ ok: true, cached: true, annotation: poem.annotation, translation: poem.translation, appreciation: poem.appreciation });
    }

    const result = await runOnce(`analysis:${poem_id}`, async () => {
      const author = Array.isArray(poem.authors) ? poem.authors[0] : poem.authors;
      const generated = await generateContent(poem.title, author?.name || '佚名', poem.dynasty, poem.content, headers);
      return saveMissingAnalysis(client, poem_id, generated);
    });
    res.json({ ok: true, cached: false, ...result });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;