import { Router } from 'express';
import { authorId, cached, missingFunction } from '../data/databaseCapabilities';
import { authorContexts, workContexts } from '../data/readingEditorial';
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
  if (query.author_id) query.author_id = await authorId(client, query.author_id);
  if (query.work_id) {
    const limit = Math.min(Math.max(query.limit || 40, 1), 60);
    const offset = Math.max(query.offset || 0, 0);
    const { data, count, error } = await client.from('collection_entries')
      .select('id,entry_title,volume,sort_order,poems(*,authors(name,avatar_emoji))', { count: 'exact' })
      .eq('work_id', query.work_id).order('sort_order').order('id').range(offset, offset + limit - 1);
    if (error) throw error;
    if (count) {
      const list = (data || []).map((entry: any) => ({
        ...entry.poems, title: entry.entry_title || entry.poems.title,
        author_name: entry.poems.authors?.name, volume: entry.volume, sort_order: entry.sort_order,
      }));
      return { list, page: Math.floor(offset / limit) + 1, pageSize: limit, total: count, totalPages: Math.ceil(count / limit) };
    }
  }
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
      .select('*');
    let cnt = client.from('authors').select('*', { count: 'exact', head: true });
    const capability = await cached('canonical-authors', async () => {
      const probe = await client.from('authors').select('canonical_author_id').limit(0);
      if (probe.error && probe.error.code !== '42703' && probe.error.code !== 'PGRST204') throw probe.error;
      return !probe.error;
    });
    if (capability) { qb = qb.is('canonical_author_id', null); cnt = cnt.is('canonical_author_id', null); }
    if (q) { qb = qb.ilike('name', `%${q}%`); cnt = cnt.ilike('name', `%${q}%`); }

    const { count: total, error: ce } = await cnt;
    const { data, error } = await qb
      .order('dynasty', { ascending: true })
      .order('name', { ascending: true })
      .range(offset, offset + limit - 1);
    if (ce) throw new Error(ce.message);
    if (error) throw new Error(error.message);

    const withCounts = await cached('authors-counts:' + JSON.stringify((data || []).map((item: any) => item.id)), async () => {
      const ids = (data || []).map((item: any) => item.id);
      const aggregate = await client.rpc('guanwen_author_counts', { author_ids: ids });
      if (aggregate.error && !missingFunction(aggregate.error)) throw aggregate.error;
      const counts: Record<string, number> = {};
      if (!aggregate.error) for (const item of aggregate.data || []) counts[item.author_id] = Number(item.poem_count);
      else {
        await Promise.all(ids.map(async (id: string) => {
          const { count, error } = await client.from('poems').select('id', { count: 'exact', head: true }).eq('author_id', id);
          if (error) throw error;
          counts[id] = count ?? 0;
        }));
      }
      return (data || []).map((item: any) => ({ ...item, poem_count: counts[item.id] ?? 0 }));
    });
    res.json({ list: withCounts, page, pageSize: limit, total: total ?? 0, totalPages: Math.ceil((total ?? 0) / limit) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 人物详情（生平、作品集、人际关系、诗文）
router.get('/authors/:id', async (req, res) => {
  try {
    const id = await authorId(client, req.params.id);
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

    const poemPage = await listPoems({ author_id: id, limit: 20 });
    const poemCount = poemPage.total;

    res.json({
      ...authorContexts[id],
      ...author,
      poemCount,
      works: works || [],
      poems: poemPage.list,
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

router.get('/authors/:id/poems', async (req, res) => {
  try {
    res.json(await listPoems({
      author_id: req.params.id,
      limit: Number(req.query.limit) || 40,
      offset: Number(req.query.offset) || 0,
    }));
  } catch (reason: any) {
    res.status(500).json({ error: reason.message });
  }
});

// 作品集列表
router.get('/works', async (_req, res) => {
  try {
    const { data, error } = await client
      .from('works')
      .select('*, authors(name, dynasty)');
    if (error) throw new Error(error.message);
    const withCounts = await cached('works-with-counts', async () => {
      const ids = (data || []).map((work: any) => work.id);
      const aggregate = await client.rpc('guanwen_work_counts', { work_ids: ids });
      if (aggregate.error && !missingFunction(aggregate.error)) throw aggregate.error;
      const counts: Record<string, number> = {};
      if (!aggregate.error) for (const row of aggregate.data || []) counts[row.work_id] = Number(row.poem_count);
      else await Promise.all(ids.map(async (id: string) => {
        const entries = await client.from('collection_entries').select('id',{ count: 'exact',head: true }).eq('work_id',id);
        if (entries.error) throw entries.error;
        if (entries.count) counts[id] = entries.count;
        else {
          const poems = await client.from('poems').select('id',{ count:'exact',head:true }).eq('work_id',id);
          if (poems.error) throw poems.error;
          counts[id] = poems.count ?? 0;
        }
      }));
      return (data || []).map((work: any) => ({ ...work,author_name:work.authors?.name,poem_count:counts[work.id] ?? 0 }));
    });
    res.json(withCounts);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ============ 诗文 ============

// 诗文列表（可筛选人物 / 作品）
const catalogCache = new Map<string, { at: number; vols: { volume: string; count: number }[] }>();
router.get('/works/:id/catalog', async (req, res) => {
  try {
    const { id } = req.params;
    const cached = catalogCache.get(id);
    if (cached && Date.now() - cached.at < 60000) {
      res.json({ catalog: cached.vols });
      return;
    }
    const agg = new Map<string, { volume: string; count: number; first: number }>();
    let from = 0;
    const PAGE = 1000;
    for (;;) {
      const { data, error } = await client
        .from('collection_entries')
        .select('volume, sort_order')
        .eq('work_id', id)
        .order('sort_order', { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) break;
      for (const r of data) {
        const key = r.volume || '未分卷';
        const cur = agg.get(key) ?? { volume: key, count: 0, first: Infinity };
        cur.count += 1;
        cur.first = Math.min(cur.first, r.sort_order);
        agg.set(key, cur);
      }
      if (data.length < PAGE) break;
      from += PAGE;
    }
    const vols = Array.from(agg.values()).sort((a, b) => a.first - b.first);
    catalogCache.set(id, { at: Date.now(), vols });
    res.json({ catalog: vols });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 按文集目录条目返回文集内容（分卷 + 篇次 + 版本篇名）
router.get('/works/:id/entries', async (req, res) => {
  try {
    const { id } = req.params;
    const limit = Math.min(500, Math.max(1, Math.floor(Number(req.query.limit) || 200)));
    const offset = Math.max(0,Math.floor(Number(req.query.offset) || 0));
    const volume = req.query.volume as string | undefined;
    let qb = client
      .from('collection_entries')
      .select('id, volume, sort_order, entry_title, poem_id, poems(id, title, dynasty, genre, cover_emoji, background_hint, author_id)', { count: 'exact' })
      .eq('work_id', id)
      .order('sort_order', { ascending: true }).order('id');
    if (volume) qb = volume === '未分卷' ? qb.or('volume.is.null,volume.eq.') : qb.eq('volume', volume);
    const { data, count, error } = await qb.range(offset, offset + limit - 1);
    if (error) throw new Error(error.message);
    res.json({ entries: data || [], total: count ?? 0 });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ============ 折子戏 / 杂剧 ============

// 某部杂剧（折子戏）的各 "折" 聚合：按目录条目 sort_order 排序返回
// 前端从任一折的 poem 可拿到 base title（去 "・楔子/第X折" 后缀），再查整部
// 也支持按任一折 poem_id 反查所属作品
router.get('/dramas/by-poem/:poemId', async (req, res) => {
  try {
    const { poemId } = req.params;
    const { data: poem, error: pe } = await client
      .from('poems')
      .select('title, author_id, work_id, genre, dynasty')
      .eq('id', poemId).maybeSingle();
    if (pe) throw new Error(pe.message);
    if (!poem) return res.status(404).json({ error: '未找到该诗文' });

    // 从标题剥离折标记获取基础标题
    const base = String(poem.title || '').replace(/・(楔子|第[一二三四五六七八九十百\d]+折)$/u, '');
    if (!base) return res.status(400).json({ error: '该作品不是折子戏' });

    // 同一作品（work_id + title 前缀）下所有折
    let qb = client
      .from('poems')
      .select('*, authors(id, name, dynasty, avatar_emoji), works(name)')
      .eq('work_id', poem.work_id)
      .ilike('title', `${base}・%`);
    if (poem.genre === '杂剧' || poem.genre === '曲') {
      // 兼容 genre 标记缺失：仍按前缀匹配即可
    }

    // 用目录条目确认排序
    const { data: entries, error: ee } = await client
      .from('collection_entries')
      .select('poem_id, sort_order')
      .ilike('entry_title', `${base}%`)
      .order('sort_order', { ascending: true });
    if (ee) throw new Error(ee.message);

    const { data, error } = await qb.order('title', { ascending: true });
    if (error) throw new Error(error.message);

    // 按 sort_order 重塑折顺序（无目录条目的折排最后，按标题兜底）
    const order = new Map((entries || []).map((entry, index) => [entry.poem_id, index]));
    const acts = (data || []).slice().sort((a: any, b: any) => {
      const ai = order.has(a.id) ? order.get(a.id)! : Number.MAX_SAFE_INTEGER;
      const bi = order.has(b.id) ? order.get(b.id)! : Number.MAX_SAFE_INTEGER;
      if (ai !== bi) return ai - bi;
      return String(a.title).localeCompare(String(b.title), 'zh');
    });

    // 基础信息取自作品
    const { data: work } = await client.from('works').select('name, description').eq('id', poem.work_id).maybeSingle();

    res.json({
      base_title: base,
      genre: poem.genre || '曲',
      dynasty: poem.dynasty,
      author: poem.author_id ? (data?.[0]?.authors ?? null) : null,
      work: work ?? null,
      acts: acts.map((act: any) => ({
        id: act.id,
        title: act.title,
        dynasty: act.dynasty,
        genre: act.genre,
        content: act.content,
        content_traditional: act.content_traditional,
        annotation: act.annotation,
        translation: act.translation,
        appreciation: act.appreciation,
        creation_background: act.creation_background,
        cover_emoji: act.cover_emoji,
        background_hint: act.background_hint,
        author_id: act.author_id,
        author_name: act.authors?.name,
        author_emoji: act.authors?.avatar_emoji,
        work_id: act.work_id,
        work_name: act.works?.name,
      })),
    });
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
    res.json({ ...workContexts[id], ...data, author_name: data.authors?.name, work_name: data.works?.name });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 全局搜索（人物 / 作品 / 诗文）
router.get('/search', async (req, res) => {
  try {
    const q = (typeof req.query.q === 'string' ? req.query.q : '').trim().slice(0, 128);
    if (!q) return res.json({ authors: [], works: [], poems: [] });
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const limit = Math.min(60, Math.max(1, Number(req.query.limit) || 20));
    // Trigram indexes cannot narrow a contains query with fewer than three letters.
    // Short queries search author/collection/title; longer phrases also search the body.
    const bodySearch = (q.match(/[\p{L}\p{N}]/gu)?.length ?? 0) >= 3;
    if (!/[\p{L}\p{N}]/u.test(q)) return res.json({ authors: [], works: [], poems: [], has_more: false, offset, limit });
    if (bodySearch) {
      const indexed = await client.rpc('guanwen_search', { keyword: q, page_offset: offset, page_limit: limit });
      if (!indexed.error) return res.json(indexed.data);
      if (!missingFunction(indexed.error)) throw indexed.error;
    }
    const kw = `%${q.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
    const selectPoems = () => client
      .from('poems')
      .select('id, title, dynasty, genre, cover_emoji, background_hint, author_id, authors(name, avatar_emoji)');

    const [authorsR, worksR, titlesR] = await Promise.all([
      client.from('authors').select('*').ilike('name', kw).order('name').order('id').limit(10),
      client.from('works').select('id, name, era, cover_emoji, author_id').ilike('name', kw).order('name').order('id').limit(10),
      selectPoems().ilike('title', kw).order('title').order('id').range(offset, offset + limit),
    ]);
    if (authorsR.error) throw new Error(authorsR.error.message);
    if (worksR.error) throw new Error(worksR.error.message);
    if (titlesR.error) throw new Error(titlesR.error.message);
    const poems = titlesR.data || [];
    if (bodySearch && poems.length <= limit) {
      const titleCount = await client.from('poems').select('id', { count: 'exact', head: true }).ilike('title', kw);
      if (titleCount.error) throw titleCount.error;
      const count = titleCount.count ?? 0;
      const bodyOffset = Math.max(0, offset - count);
      const linesR = await selectPoems().ilike('content', kw).not('title', 'ilike', kw)
        .order('title').order('id').range(bodyOffset, bodyOffset + limit - poems.length);
      if (linesR.error) throw linesR.error;
      poems.push(...(linesR.data || []));
    }
    const hasMore = poems.length > limit;
    res.json({
      has_more: hasMore, offset, limit,
      authors: offset ? [] : (authorsR.data || []).filter((author: any) => !author.canonical_author_id).map((author: any) => ({ id: author.id, name: author.name, dynasty: author.dynasty, avatar_emoji: author.avatar_emoji })),
      works: offset ? [] : worksR.data || [],
      poems: poems.slice(0, limit).map((p: any) => ({
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
