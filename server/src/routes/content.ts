import { Router } from 'express';
import { getSupabaseClient } from '../storage/database/supabase-client';

const router: Router = Router();
const client = getSupabaseClient();

const dayIndex = () => Math.floor(Date.now() / 86400000);

interface PoemSummary {
  id: string; title: string; dynasty: string; genre: string; content: string;
  cover_emoji: string; background_hint: string;
  author_name?: string; author_id?: string; author_emoji?: string;
  work_name?: string; work_id?: string;
}

interface PoemPage {
  list: PoemSummary[]; page: number; pageSize: number; total: number; totalPages: number;
}

async function listPoems(query: {
  author_id?: string; work_id?: string; q?: string; limit?: number; offset?: number;
}): Promise<PoemPage> {
  let qb = client
    .from('poems')
    .select('id, title, dynasty, genre, content, cover_emoji, background_hint, author_id, work_id, authors(name, avatar_emoji), works(name)');
  let cnt = client.from('poems').select('*', { count: 'exact', head: true });

  if (query.author_id) { qb = qb.eq('author_id', query.author_id); cnt = cnt.eq('author_id', query.author_id); }
  if (query.work_id) { qb = qb.eq('work_id', query.work_id); cnt = cnt.eq('work_id', query.work_id); }
  if (query.q) { qb = qb.ilike('title', `%${query.q}%`); cnt = cnt.ilike('title', `%${query.q}%`); }

  const limit = Math.min(Math.max(query.limit || 50, 1), 60);
  const offset = Math.max(query.offset || 0, 0);
  const page = Math.floor(offset / limit) + 1;
  const { count: total, error: ce } = await cnt;
  if (ce) throw new Error(`统计诗文失败: ${ce.message}`);
  const { data, error } = await qb.order('created_at', { ascending: true }).order('id', { ascending: true }).range(offset, offset + limit - 1);
  if (error) throw new Error(`查询诗文失败: ${error.message}`);
  const list = (data as any[]).map((r) => ({
    id: r.id, title: r.title, dynasty: r.dynasty, genre: r.genre,
    content: r.content, cover_emoji: r.cover_emoji, background_hint: r.background_hint,
    author_id: r.author_id,
    author_name: r.authors?.name, author_emoji: r.authors?.avatar_emoji,
    work_id: r.work_id, work_name: r.works?.name,
  }));
  return { list, page, pageSize: limit, total: total ?? 0, totalPages: Math.ceil((total ?? 0) / limit) };
}

// ============ 人物 / 作品 ============

// 人物列表（分页；可选搜索）
router.get('/authors', async (req, res) => {
  try {
    const q = (req.query.q as string || '').trim();
    const limit = Math.min(Math.max(Number(req.query.limit) || 60, 1), 60);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const page = Math.floor(offset / limit) + 1;

    let qb = client
      .from('authors')
      .select('id, name, name_traditional, dynasty, avatar_emoji, bio');
    let cnt = client.from('authors').select('*', { count: 'exact', head: true });
    if (q) { qb = qb.ilike('name', `%${q}%`); cnt = cnt.ilike('name', `%${q}%`); }

    const { count: total, error: ce } = await cnt;
    const { data, error } = await qb
      .order('dynasty', { ascending: true })
      .order('name', { ascending: true })
      .range(offset, offset + limit - 1);
    if (ce) throw new Error(ce.message);
    if (error) throw new Error(error.message);

    const withCounts = await Promise.all((data || []).map(async (a: any) => {
      const { count } = await client
        .from('poems').select('*', { count: 'exact', head: true }).eq('author_id', a.id);
      return { ...a, poem_count: count ?? 0 };
    }));
    res.json({ list: withCounts, page, pageSize: limit, total: total ?? 0, totalPages: Math.ceil((total ?? 0) / limit) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 人物详情（生平、作品集、人际关系、诗文）
router.get('/authors/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data: author, error: ae } = await client
      .from('authors').select('*').eq('id', id).maybeSingle();
    if (ae) throw new Error(ae.message);
    if (!author) return res.status(404).json({ error: '未找到该作者' });

    const { data: works, error: we } = await client
      .from('works').select('*').eq('author_id', id);
    if (we) throw new Error(we.message);

    const { data: rels, error: re } = await client
      .from('relationships')
      .select('id, relation, note, related_author_id, authors!relationships_related_author_id_authors_id_fk(name, avatar_emoji, dynasty)')
      .eq('author_id', id);
    if (re) throw new Error(re.message);

    const { data: poems, error: pe } = await client
      .from('poems').select('id, title, dynasty, genre, content, cover_emoji, background_hint, work_id, works(name)')
      .eq('author_id', id).order('created_at', { ascending: true }).limit(500);
    if (pe) throw new Error(pe.message);

    // 语料作者无人工简介时，按朝代与存诗量生成一段兜底生平
    let poemCount = (poems || []).length;
    if (!author.bio || !String(author.bio).trim()) {
      const { count, error: ce } = await client
        .from('poems').select('*', { count: 'exact', head: true }).eq('author_id', id);
      if (!ce && count != null && count > poemCount) poemCount = count;
      const d = String(author.dynasty || '');
      const src = d.includes('宋') || d.includes('词') ? '《全宋词》' : d.includes('唐') ? '《全唐诗》' : '古籍';
      author.bio = `${d}诗人。据${src}等古籍辑录，存世篇目约 ${poemCount} 篇。本页生平尚待精编，作品如下。`;
    }

    res.json({
      ...author,
      poemCount,
      works: works || [],
      poems: (poems || []).map((p: any) => ({ ...p, work_name: p.works?.name })),
      relationships: (rels || []).map((r: any) => ({
        id: r.id, relation: r.relation, note: r.note,
        related_author_id: r.related_author_id,
        related_author: r.authors,
      })),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 作品集列表
router.get('/works', async (_req, res) => {
  try {
    const { data, error } = await client
      .from('works')
      .select('*, authors(name, dynasty)');
    if (error) throw new Error(error.message);
    const withCounts = await Promise.all((data || []).map(async (w: any) => {
      const { count } = await client
        .from('poems').select('*', { count: 'exact', head: true }).eq('work_id', w.id);
      return { ...w, author_name: w.authors?.name, poem_count: count ?? 0 };
    }));
    res.json(withCounts);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ============ 诗文 ============

// 诗文列表（可筛选人物 / 作品）
router.get('/poems', async (req, res) => {
  try {
    const poems = await listPoems({
      author_id: req.query.author_id as string | undefined,
      work_id: req.query.work_id as string | undefined,
      q: req.query.q as string | undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      offset: req.query.offset ? Number(req.query.offset) : undefined,
    });
    res.json(poems);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 诗文详情
router.get('/poems/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await client
      .from('poems')
      .select('*, authors(name, dynasty, avatar_emoji), works(name)')
      .eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return res.status(404).json({ error: '未找到该诗文' });
    res.json({ ...data, author_name: data.authors?.name, work_name: data.works?.name });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 全局搜索（人物 / 作品 / 诗文）
router.get('/search', async (req, res) => {
  try {
    const q = (req.query.q as string || '').trim();
    if (!q) return res.json({ authors: [], works: [], poems: [] });
    const kw = `%${q}%`;

    const [authorsR, worksR, poemsR] = await Promise.all([
      client.from('authors').select('id, name, dynasty, avatar_emoji').ilike('name', kw).limit(10),
      client.from('works').select('id, name, era, cover_emoji, author_id').ilike('name', kw).limit(10),
      client
        .from('poems')
        .select('id, title, dynasty, genre, cover_emoji, background_hint, author_id, authors(name, avatar_emoji)')
        .ilike('title', kw).limit(20),
    ]);
    if (authorsR.error) throw new Error(authorsR.error.message);
    if (worksR.error) throw new Error(worksR.error.message);
    if (poemsR.error) throw new Error(poemsR.error.message);
    res.json({
      authors: authorsR.data || [],
      works: worksR.data || [],
      poems: (poemsR.data || []).map((p: any) => ({
        ...p, author_name: p.authors?.name, author_emoji: p.authors?.avatar_emoji,
      })),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ============ 阅读习惯 & 每日推荐 ============

// 记录阅读
router.post('/history', async (req, res) => {
  try {
    const { device_id, poem_id } = req.body || {};
    if (!device_id || !poem_id) return res.status(400).json({ error: '缺少 device_id 或 poem_id' });

    const { data: poem, error: pErr } = await client
      .from('poems').select('author_id').eq('id', poem_id).maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!poem) return res.status(404).json({ error: '诗文不存在' });
    if (!poem.author_id) return res.status(400).json({ error: '该诗文缺少作者' });

    const { error: he } = await client.from('reading_logs').insert({
      device_id, poem_id, author_id: poem.author_id, action: 'read',
    });
    if (he) throw new Error(he.message);

    // 累加阅读量
    const { data: cur } = await client.from('poems').select('read_count').eq('id', poem_id).maybeSingle();
    await client.from('poems').update({ read_count: (cur?.read_count || 0) + 1 }).eq('id', poem_id);

    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 记录搜索
router.post('/search-log', async (req, res) => {
  try {
    const { device_id, keyword, author_id } = req.body || {};
    if (!device_id || !keyword) return res.status(400).json({ error: '缺少参数' });
    if (author_id) {
      const { error } = await client.from('reading_logs').insert({
        device_id, keyword, author_id, action: 'search',
      });
      if (error) throw new Error(error.message);
    }
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 阅读历史 & 统计（按时间倒序去重）
router.get('/history', async (req, res) => {
  try {
    const device_id = (req.query.device_id as string || '').trim();
    if (!device_id) return res.status(400).json({ error: '缺少 device_id' });
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 60);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    let all: any[] = [];
    let start = 0;
    for (;;) {
      const { data, error } = await client
        .from('reading_logs')
        .select('id, created_at, poem_id, author_id, authors(name), poems(id, title, dynasty, genre, work_id, works(name))')
        .eq('device_id', device_id)
        .eq('action', 'read')
        .order('created_at', { ascending: false })
        .range(start, start + 999);
      if (error) throw new Error(error.message);
      const rows = data || [];
      all = all.concat(rows);
      if (rows.length < 1000) break;
      start += 1000;
    }

    const seen = new Set<string>();
    const deduped: any[] = [];
    const authorSet = new Set<string>();
    let read_count = 0;
    for (const l of all) {
      read_count++;
      if (l.author_id) authorSet.add(l.author_id);
      if (l.poem_id && !seen.has(l.poem_id)) { seen.add(l.poem_id); deduped.push(l); }
    }

    const total = deduped.length;
    const page = Math.floor(offset / limit) + 1;
    const list = deduped.slice(offset, offset + limit).map((l) => ({
      id: l.id, poem_id: l.poem_id,
      title: l.poems?.title ?? '', dynasty: l.poems?.dynasty ?? null, genre: l.poems?.genre ?? null,
      work_id: l.poems?.work_id ?? null, work_name: l.poems?.works?.name ?? null,
      author_id: l.author_id, author_name: l.authors?.name ?? '佚名',
      created_at: l.created_at,
    }));

    res.json({ total, read_count, author_count: authorSet.size, page, pageSize: limit, totalPages: Math.ceil(total / limit), list });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 每日推荐（依据阅读/搜索习惯个性化；无习惯则按日期轮换经典）
router.get('/recommend/daily', async (req, res) => {
  try {
    const device_id = (req.query.device_id as string || 'unknown');

    // 1) 统计该设备的作者偏好
    const { data: logs, error: le } = await client
      .from('reading_logs').select('author_id').eq('device_id', device_id);
    if (le) throw new Error(le.message);

    let reason = '';
    let poemRows: any[] | null = null;

    if (logs && logs.length > 0) {
      const freq = new Map<string, number>();
      for (const l of logs) {
        const a = l.author_id as string;
        freq.set(a, (freq.get(a) || 0) + 1);
      }
      const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]);
      const topAuthorId = sorted[0][0];

      const { data: author } = await client
        .from('authors').select('name').eq('id', topAuthorId).maybeSingle();
      reason = author ? `基于你的阅读偏好，今天为你带来「${author.name}」的一首诗 ✨` : '基于你的阅读偏好，为你精选一首古诗 ✨';

      // 从 topAuthor 的诗文中按当日轮选
      const { data: p } = await client
        .from('poems')
        .select('id, title, dynasty, genre, content, cover_emoji, background_hint, author_id, works(name)')
        .eq('author_id', topAuthorId).limit(2000);
      if (p && p.length > 0) {
        poemRows = p;
      }
    }

    // 2) 无偏好或无该作者诗文 → 全局按日轮换
    if (!poemRows || poemRows.length === 0) {
      const { data: all } = await client
        .from('poems')
        .select('id, title, dynasty, genre, content, cover_emoji, background_hint, author_id, works(name)')
        .order('created_at', { ascending: true }).limit(3000);
      poemRows = all || [];
      if (poemRows.length === 0) return res.status(404).json({ error: '暂无诗文' });
      reason = reason || '今日为你分享一首经典古诗 🌟';
    }

    const idx = dayIndex() % poemRows.length;
    const pick = poemRows[idx];

    const { data: detail, error: de } = await client
      .from('poems')
      .select('*, authors(name, dynasty, avatar_emoji), works(name)')
      .eq('id', pick.id).maybeSingle();
    if (de) throw new Error(de.message);

    res.json({ reason, poem: { ...detail, author_name: detail.authors?.name, work_name: detail.works?.name } });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 为你推荐：按阅读量取热门诗文列表
// 服务端文件：server/src/routes/content.ts
// 接口：GET /api/v1/recommend/list ；Query 参数：limit?: number
router.get('/recommend/list', async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit || 5), 1), 10);
    const { data, error } = await client
      .from('poems')
      .select('id, title, dynasty, genre, cover_emoji, background_hint, author_id, authors(name, avatar_emoji)')
      .order('read_count', { ascending: false })
      .range(0, limit - 1);
    if (error) throw new Error(error.message);
    res.json((data || []).map((p: any) => ({
      ...p, author_name: p.authors?.name, author_emoji: p.authors?.avatar_emoji,
    })));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;