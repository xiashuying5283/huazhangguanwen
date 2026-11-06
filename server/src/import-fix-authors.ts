/* 修复作者关联：为 author_id 为空的诗重建作者并回填
 * 运行：cd server && npx tsx src/import-fix-authors.ts
 *
 * 思路：重新读取各语料源（与 import-more.ts 相同的解析逻辑），
 * 确保所有 (作者, 朝代) 存在于 authors 表；随后按
 * (dynasty, genre, content) 精确匹配作者为空的诗，回填 author_id。
 */
import * as fs from 'fs';
import { Converter } from 'opencc-js';
import { getSupabaseClient } from './storage/database/supabase-client';

const CWD = '/workspace/projects/corpus';
const cn = Converter({ from: 'tw', to: 'cn' });
const norm = (raw: string | undefined) => (raw ?? '').replace(/\s+/g, '').trim();
const cut = (s: string, n = 110) => (s.length > n ? s.slice(0, n) : s);
const AUTHOR_UNKNOWN = '佚名';

type Item = { author: string; dynasty: string; genre: string; title: string; paragraphs: string[] };

const corpora: (() => Item[])[] = [];
const push = (fn: () => Item[]) => corpora.push(fn);

const readJson = (p: string): any => JSON.parse(fs.readFileSync(p, 'utf8'));
const listFiles = (dir: string, re: RegExp) =>
  fs.readdirSync(dir).filter((f) => re.test(f)).sort().map((f) => `${dir}/${f}`);
const contentLines = (v: unknown): string[] => {
  if (Array.isArray(v)) return v.map((x) => String(x));
  if (typeof v === 'string') return v.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  return [];
};
const convSimple = (text: string) => {
  let s = cn(text);
  if (!s && text.trim()) s = text;
  return s;
};

/* ---- 全宋诗 ---- */
push(() => {
  const out: Item[] = [];
  for (const f of listFiles(`${CWD}/全唐诗`, /^poet\.song\.\d+\.json$/)) {
    for (const e of readJson(f)) {
      const paragraphs = contentLines(e.paragraphs);
      if (!paragraphs.length) continue;
      out.push({ author: norm(e.author) || AUTHOR_UNKNOWN, dynasty: '宋代', genre: '诗',
        title: cut(norm(e.title) || '(无题)'), paragraphs });
    }
  }
  return out;
});
/* ---- 元曲 ---- */
push(() =>
  readJson(`${CWD}/元曲/yuanqu.json`).map((e: any) => ({
    author: norm(e.author) || AUTHOR_UNKNOWN, dynasty: '元代', genre: '曲',
    title: cut(norm(e.title) || '(无题)'), paragraphs: contentLines(e.paragraphs),
  }))
);
/* ---- 楚辞 ---- */
push(() =>
  readJson(`${CWD}/楚辞/chuci.json`).map((e: any) => ({
    author: norm(e.author) || AUTHOR_UNKNOWN, dynasty: '先秦', genre: '骚体',
    title: cut(norm(e.title) || '(无题)'), paragraphs: contentLines(e.content),
  }))
);
/* ---- 诗经 ---- */
push(() =>
  readJson(`${CWD}/诗经/shijing.json`).map((e: any) => ({
    author: AUTHOR_UNKNOWN, dynasty: '先秦', genre: '诗',
    title: cut(norm(e.title) || '(佚篇)'),
    paragraphs: contentLines(e.content).map((s) => s.replace(/[；。]/g, (m) => (m === '；' ? '； ' : '。 '))),
  }))
);
/* ---- 曹操诗集 ---- */
push(() =>
  readJson(`${CWD}/曹操诗集/caocao.json`).map((e: any) => ({
    author: '曹操', dynasty: '三国', genre: '诗',
    title: cut(norm(e.title) || '(无题)'), paragraphs: contentLines(e.paragraphs),
  }))
);
/* ---- 纳兰性德词 ---- */
push(() =>
  readJson(`${CWD}/纳兰性德/纳兰性德诗集.json`).map((e: any) => ({
    author: '纳兰性德', dynasty: '清代', genre: '词',
    title: cut(norm(e.title || e.author) || '(无题)'),
    paragraphs: contentLines(e.para).map((s) => s.replace(/[，。]/g, (m) => (m === '，' ? '， ' : '。 '))),
  }))
);
/* ---- 四书 ---- */
const siShu: { file: string; author: string }[] = [
  { file: `${CWD}/论语/lunyu.json`, author: '孔子及弟子' },
  { file: `${CWD}/四书五经/mengzi.json`, author: '孟子及弟子' },
  { file: `${CWD}/四书五经/daxue.json`, author: '曾参' },
  { file: `${CWD}/四书五经/zhongyong.json`, author: '子思' },
];
function bookList(file: string, author: string): Item[] {
  const d = readJson(file);
  const list = Array.isArray(d) ? d : [d];
  return list.map((e: any) => ({
    author, dynasty: '先秦', genre: '文',
    title: cut(norm(e.chapter || e.title || '(篇)')),
    paragraphs: contentLines(e.paragraphs),
  }));
}
for (const b of siShu) push(() => bookList(b.file, b.author));
/* ---- 幽梦影 ---- */
push(() =>
  readJson(`${CWD}/幽梦影/youmengying.json`).map((e: any, i: number) => ({
    author: '张潮', dynasty: '清代', genre: '文',
    title: `幽梦影 · 第${i + 1}则`, paragraphs: [String(e.content ?? '')],
  }))
);
/* ---- 蒙学 ---- */
const mengFiles = ['sanzijing-new', 'baijiaxing', 'qianziwen', 'dizigui', 'zengguangxianwen', 'youxueqionglin', 'shenglvqimeng', 'wenzimengqiu', 'zhuzijiaxun'].filter((x, i, a) => a.indexOf(x) === i);
push(() => {
  const out: Item[] = [];
  for (const base of mengFiles) {
    const d = readJson(`${CWD}/蒙学/${base}.json`);
    let paras: string[] = [];
    if (Array.isArray(d.paragraphs)) paras = d.paragraphs.map((x: any) => String(x));
    else if (d.content !== undefined) paras = contentLines(d.content);
    if (!paras.length) continue;
    out.push({ author: norm(d.author) || AUTHOR_UNKNOWN, dynasty: '中华蒙学', genre: '文',
      title: cut(norm(d.title || d.name || base)), paragraphs: paras });
  }
  return out;
});

async function main() {
  const client = getSupabaseClient();

  // 现有作者映射
  let authorMap = new Map<string, string>();
  {
    let start = 0;
    for (;;) {
      const { data } = await client.from('authors').select('id,name,dynasty').range(start, start + 999);
      const rows = data ?? [];
      for (const r of rows) authorMap.set(`${r.name}|${r.dynasty}`, r.id as string);
      if (rows.length < 1000) break;
      start += 1000;
    }
  }

  // 1) 收集语料作者并确保存在
  const need: Set<string> = new Set();
  for (const mk of corpora) for (const it of mk()) need.add(`${it.author}|${it.dynasty}`);
  let created = 0;
  for (const key of need) {
    if (authorMap.has(key)) continue;
    const [name, dynasty] = key.split('|');
    const { data } = await client.from('authors').insert({ name, dynasty, bio: '' }).select('id,name,dynasty').single();
    if (data) {
      authorMap.set(`${data.name}|${data.dynasty}`, data.id as string);
      created++;
    }
  }
  console.log(`补齐作者: ${created}`);

  // 2) 按语料逐个回填 author_id 为空的诗
  let fixed = 0;
  for (const mk of corpora) {
    const items = mk(); // 读取一次，构建 content -> author 映射
    const byContent = new Map<string, string>(); // content(简) -> author|dynasty
    for (const it of items) {
      if (!it.paragraphs.length) continue;
      const text = it.paragraphs.join('\n');
      if (!text.trim()) continue;
      byContent.set(convSimple(text), `${it.author}|${it.dynasty}`);
      const titleKey = `${cut(norm(it.title))}::${convSimple(text)}`;
      if (!byContent.has(titleKey)) byContent.set(titleKey, `${it.author}|${it.dynasty}`);
    }
    // 拉取该(dynasty,genre)下 author 为空的诗
    const dyn = items[0]?.dynasty ?? '';
    const genre = items[0]?.genre ?? '';
    if (!dyn || !genre) continue;
    let start = 0;
    const toFix: { id: string; content: string; title: string }[] = [];
    for (;;) {
      const { data } = await client.from('poems')
        .select('id,title,content,dynasty,genre')
        .eq('dynasty', dyn).eq('genre', genre).is('author_id', null)
        .range(start, start + 999);
      const rows = data ?? [];
      for (const r of rows) toFix.push({ id: r.id, content: r.content ?? '', title: r.title ?? '' });
      if (rows.length < 1000) break;
      start += 1000;
    }
    // 分组按作者批量 update
    const byAuthor = new Map<string, { id: string; content: string; title: string }[]>();
    let unmatched = 0;
    for (const p of toFix) {
      const simple = convSimple(p.content);
      const key = byContent.get(simple) ?? byContent.get(`${cut(p.title)}::${simple}`);
      if (!key) { unmatched++; continue; }
      const arr = byAuthor.get(key) ?? [];
      arr.push(p);
      byAuthor.set(key, arr);
    }
    for (const [key, list] of byAuthor) {
      const authorId = authorMap.get(key);
      if (!authorId) continue;
      for (let i = 0; i < list.length; i += 100) {
        const ids = list.slice(i, i + 100).map((x) => x.id);
        const { error } = await client.from('poems').update({ author_id: authorId }).in('id', ids);
        if (error) throw new Error(`${dyn}/${genre} 更新失败: ${error.message}`);
      }
      fixed += list.length;
    }
    console.log(`${dyn}/${genre}: 待回填 ${toFix.length}，本次更新 ${byAuthor.size ? [...byAuthor.values()].reduce((a, l) => a + l.length, 0) : 0}，未匹配 ${unmatched}`);
  }
  console.log(`回填完成，共更新 ${fixed} 篇`);
}

main().catch((e) => {
  console.error('失败：', e.stack || e.message);
  process.exit(1);
});