/* 爬取《两当轩集》识典古籍全书（按 Next 链遍历），结构化解析为逐首诗并入库。
 * 用法: npx tsx src/import-liangdang.ts
 * 数据源: https://www.shidianguji.com/ens/book/7477961701317574671
 * 解析依据: DOM 结构 <h2>=卷名, <h3>=体裁说明, <h5>=诗题, <h6>=组诗序号, <p>=每句诗文
 */
import { randomUUID } from 'node:crypto';
import { getSupabaseClient } from './storage/database/supabase-client';

const WORK_ID = 'w-liangdang';
const AUTHOR_ID = 'huang-jingren'; // 黄景仁
const DYN = '清';

const START = process.env.START_CHAPTER;
// 卷第一已知 chapter id
const DEFAULT_START = '1ktdr2sho8g8i';

const client = getSupabaseClient();
const log = (m: string) => console.log(`[import-liangdang] ${new Date().toISOString()} ${m}`);

function stripTags(s: string): string {
  return s
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

interface Token {
  type: 'h2' | 'h3' | 'h5' | 'h6' | 'p' | 'h1';
  text: string;
}

function isNavText(t: string): boolean {
  const s = t.replace(/\s+/g, '');
  if (s.length === 0) return true;
  if (/^(上一篇|下一篇|Next|Prev|Previous)$/i.test(s)) return true;
  if (/^[0-9]+\s*\/\s*[0-9]+$/.test(s)) return true;
  if (/^(1|2|3|4|5|6|7|8|9|10|…)+\s*(编辑|Editors)?$/i.test(s)) return false;
  return false;
}

// 抽取正文 tokens（只取正文区，跳过导航/脚本/图标 <p>）
function extractTokens(html: string): Token[] {
  // 定位正文起始：到第一个 <h2 卷名 或第一个 <h5 诗题 附近
  const bodyStart = Math.min(
    ...['<h2', '<h1'].map((t) => {
      const i = html.indexOf(t);
      return i < 0 ? html.length : i;
    }),
  );
  const body = html.slice(bodyStart);
  const tokens: Token[] = [];
  type Raw = { pos: number; type: Token['type']; text: string };
  const raw: Raw[] = [];
  // 标题：h1..h6（内容不嵌套，闭合标签不带反向引用，避免与 <p> 分支互扰）
  const reH = /<(h[1-6])\b[^>]*>([\s\S]*?)<\/h[1-6]>/g;
  let m: RegExpExecArray | null;
  while ((m = reH.exec(body)) !== null) {
    raw.push({ pos: m.index, type: m[1] as Token['type'], text: stripTags(m[2]) });
  }
  // 段落 <p>
  const reP = /<p\b[^>]*>([\s\S]*?)<\/p>/g;
  while ((m = reP.exec(body)) !== null) {
    raw.push({ pos: m.index, type: 'p', text: stripTags(m[1]) });
  }
  raw.sort((a, b) => a.pos - b.pos);
  for (const r of raw) {
    if (r.type === 'p') {
      if (isNavText(r.text)) continue;
      if (/[a-zA-Z0-9]{20,}|M\d[\d\s.]/i.test(r.text)) continue;
    }
    if (r.text.length > 0) tokens.push({ type: r.type, text: r.text });
  }
  return tokens;
}

interface Chapter {
  volume: string | null; // 若该页带卷标题则为卷名，否则 null（继承上一卷）
  poems: { title: string; content: string }[];
}

function volumeName(h2: string): string {
  const v = h2.replace(/\s+/g, '');
  const m = v.match(/卷[一二三四五六七八九十百千零]+/);
  if (m) return m[0];
  const m2 = v.match(/考異|考异|附錄|附录|跋|补遗|補遺|自叙|自敘|序|題/);
  if (m2) return m2[0];
  return v;
}

function parseTokens(tokens: Token[]): Chapter[] {
  const chapters: Chapter[] = [];
  let curVol: string | null = null; // 当前页出现的卷标题（h2）；无则保持 null，由调用方继承上一卷
  let poems: { title: string; content: string }[] = [];
  let curPoem: { title: string; content: string } | null = null;

  const flushPoem = () => {
    if (curPoem) {
      curPoem.content = curPoem.content.replace(/\n{3,}/g, '\n\n').trim();
      if (curPoem.content.length > 0) poems.push(curPoem);
      curPoem = null;
    }
  };
  const flushChapter = () => {
    flushPoem();
    if (poems.length > 0) chapters.push({ volume: curVol, poems });
    poems = [];
  };

  for (const t of tokens) {
    if (t.type === 'h2') {
      flushChapter();
      curVol = volumeName(t.text);
    } else if (t.type === 'h3') {
      // 体裁说明：如"古近体诗八十三首"，可作为注释，不单列
      flushPoem();
    } else if (t.type === 'h1') {
      // ignore book title
    } else if (t.type === 'h5') {
      flushPoem();
      curPoem = { title: t.text, content: '' };
    } else if (t.type === 'h6') {
      // h6 有两种语义：
      //  (a) 组诗子序号，如"（一）"，跟在 h5 主诗标题之后 → 归入当前主诗
      //  (b) 诗词等篇目标题本身就用 h6（卷十九"诗余"的词牌名）
      const isSubSeq = /^[（(][一二三四五六七八九十百千零0-9]+[）)]$/.test(t.text);
      if (isSubSeq && curPoem) {
        // (a) 组诗子序号
        if (curPoem.content.length > 0) curPoem.content += '\n';
        curPoem.content += t.text;
      } else if (isSubSeq && !curPoem) {
        // 罕见的以子序号直接开头（视为标题）
        flushPoem();
        curPoem = { title: t.text, content: '' };
      } else {
        // (b) 独立篇目标题（如词牌名）：先落盘当前诗，再开启新诗
        flushPoem();
        curPoem = { title: t.text, content: '' };
      }
    } else if (t.type === 'p') {
      if (curPoem) {
        if (curPoem.content.length > 0) curPoem.content += '\n';
        curPoem.content += t.text;
      }
    }
  }
  flushChapter();
  return chapters;
}

// 由章节页 HTML 解析「下一篇」的 chapter id
function nextChapterId(html: string, base: string): string | null {
  const re = /href="[^"]*?chapter\/([0-9a-z]+)"[^>]*>Next/i;
  const m = html.match(re);
  return m ? m[1] : null;
}

async function fetchChapter(id: string): Promise<{ html: string }> {
  const url = `https://www.shidianguji.com/ens/book/7477961701317574671/chapter/${id}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ImportBot)' } });
  if (!res.ok) throw new Error(`fetch ${id} -> HTTP ${res.status}`);
  return { html: await res.text() };
}

async function main() {
  const wExist = await client.from('works').select('id').eq('id', WORK_ID).maybeSingle();
  if (wExist.error) throw new Error(`检查作品失败: ${wExist.error.message}`);
  if (!wExist.data) {
    const { error } = await client.from('works').insert({
      id: WORK_ID,
      name: '两当轩集',
      author_id: AUTHOR_ID,
      era: DYN,
      description: '清代诗人黄景仁的诗文集，共二十二卷。诗风沉郁真挚，多写身世飘零与不平之鸣。',
      cover_emoji: '📖',
    });
    if (error) throw new Error(`创建作品失败: ${error.message}`);
  }

  // 幂等：清空本作品既有数据后重建
  log('清空 w-liangdang 既有 entries/poems...');
  const { data: oldEntries } = await client.from('collection_entries').select('poem_id').eq('work_id', WORK_ID);
  const oldPoemIds = (oldEntries as any[] | null)?.map((e) => e.poem_id) ?? [];
  const d1 = await client.from('collection_entries').delete().eq('work_id', WORK_ID);
  if (d1.error) log(`删除 entries 警告: ${d1.error.message}`);
  const d2 = await client.from('poems').delete().eq('work_id', WORK_ID);
  if (d2.error) log(`删除 poems 警告: ${d2.error.message}`);

  // 沿 Next 链遍历全书
  const start = START || DEFAULT_START;
  const visited = new Set<string>();
  let cur = start;
  const allChapters: Chapter[] = [];
  let guard = 0;
  let curVol: string | null = null; // 最近一次出现的卷标题，用于续页继承
  while (cur && !visited.has(cur) && guard < 40) {
    visited.add(cur);
    const { html } = await fetchChapter(cur);
    const tokens = extractTokens(html);
    // 页面顶部若带 <h2> 卷标题则推进当前卷（即使该页无 h5/h6 诗也不丢失，如考异/附录首页）
    const h2m = html.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/);
    if (h2m) {
      const v = volumeName(stripTags(h2m[1]));
      if (v && v.length > 0) curVol = v;
    }
    const chs = parseTokens(tokens);
    for (const ch of chs) {
      // 页面无卷标题(续页)时，继承当前最近卷
      if (ch.volume === null) {
        ch.volume = curVol;
      }
    }
    if (chs.length > 0) {
      log(`章节 ${cur} 解析到 ${chs[0].volume} (${chs[0].poems.length} 首)`);
      allChapters.push(...chs);
    } else {
      log(`章节 ${cur}: 无结构化诗（可能为序/扉页），跳过`);
    }
    const nxt = nextChapterId(html, cur);
    if (!nxt || nxt === cur) break;
    cur = nxt;
    guard++;
  }
  log(`全书共 ${allChapters.length} 章，诗 ${allChapters.reduce((a, c) => a + c.poems.length, 0)} 首`);

  // 入库
  let sort = 1;
  let inserted = 0;
  for (const ch of allChapters) {
    for (const p of ch.poems) {
      const pid = randomUUID();
      const { error: pe } = await client.from('poems').insert({
        id: pid,
        title: p.title,
        author_id: AUTHOR_ID,
        dynasty: DYN,
        work_id: WORK_ID,
        genre: (ch.volume ?? '').includes('卷') ? '诗' : '文',
        content: p.content,
        content_traditional: p.content,
        pinyin: null, annotation: null, translation: null, appreciation: null,
      });
      if (pe) {
        log(`插入诗失败 [${p.title}]: ${pe.message}`);
        continue;
      }
      const { error: ee } = await client.from('collection_entries').insert({
        work_id: WORK_ID,
        poem_id: pid,
        volume: ch.volume ?? '未分卷',
        sort_order: sort,
        entry_title: p.title,
      });
      if (ee) log(`插入条目失败 [${p.title}]: ${ee.message}`);
      sort++;
      inserted++;
      if (inserted % 200 === 0) log(`已入库 ${inserted} 首`);
    }
  }
  log(`完成，共插入 ${inserted} 首诗，sort 到 ${sort - 1}`);
}

if (process.argv[1] && process.argv[1].includes('import-liangdang')) {
  main().then(() => process.exit(0)).catch((e) => {
    console.error('[import-liangdang] 失败:', e.message);
    process.exit(1);
  });
}