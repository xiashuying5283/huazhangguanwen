/* 通用导入：全宋诗 / 元曲 / 楚辞 / 诗经 / 曹操诗集 / 纳兰性德 / 四书 / 幽梦影 / 蒙学
 * 运行：cd server && npx tsx src/import-more.ts
 */
import * as fs from 'fs';
import { Converter } from 'opencc-js';
import { getSupabaseClient } from './storage/database/supabase-client';

const CWD = '/workspace/projects/corpus';
const cn = Converter({ from: 'tw', to: 'cn' }); // 繁→简
const tw = Converter({ from: 'cn', to: 'tw' }); // 简→繁

const norm = (raw: string | undefined) => (raw ?? '').replace(/\s+/g, '').trim();
const cut = (s: string, n = 110) => (s.length > n ? s.slice(0, n) : s);
const AUTHOR_UNKNOWN = '佚名';

type Item = { author: string; dynasty: string; genre: string; title: string; paragraphs: string[] };

const corpora: (() => Item[])[] = [];
const push = (fn: () => Item[]) => corpora.push(fn);

function convText(text: string) {
  let simple = cn(text);
  let traditional = tw(simple);
  if (!simple && text.trim()) simple = text; // 兜底
  if (!traditional && simple) traditional = simple;
  return { simple, traditional };
}

function readJson(p: string): any {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

const listFiles = (dir: string, re: RegExp) =>
  fs.readdirSync(dir).filter((f) => re.test(f)).sort().map((f) => `${dir}/${f}`);

const contentLines = (v: unknown): string[] => {
  if (Array.isArray(v)) return v.map((x) => String(x));
  if (typeof v === 'string') return v.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  return [];
};

/* ---- 全宋诗 ---- */
push(() => {
  const out: Item[] = [];
  for (const f of listFiles(`${CWD}/全唐诗`, /^poet\.song\.\d+\.json$/)) {
    for (const e of readJson(f)) {
      const paragraphs = contentLines(e.paragraphs);
      if (!paragraphs.length) continue;
      out.push({
        author: norm(e.author) || AUTHOR_UNKNOWN,
        dynasty: '宋代', genre: '诗',
        title: cut(norm(e.title) || '(无题)'),
        paragraphs,
      });
    }
  }
  return out;
});

/* ---- 元曲 ---- */
push(() =>
  readJson(`${CWD}/元曲/yuanqu.json`).map((e: any) => ({
    author: norm(e.author) || AUTHOR_UNKNOWN,
    dynasty: '元代', genre: '曲',
    title: cut(norm(e.title) || '(无题)'),
    paragraphs: contentLines(e.paragraphs),
  }))
);

/* ---- 楚辞 ---- */
push(() =>
  readJson(`${CWD}/楚辞/chuci.json`).map((e: any) => ({
    author: norm(e.author) || AUTHOR_UNKNOWN,
    dynasty: '先秦', genre: '骚体',
    title: cut(norm(e.title) || '(无题)'),
    paragraphs: contentLines(e.content),
  }))
);

/* ---- 诗经 ---- */
push(() =>
  readJson(`${CWD}/诗经/shijing.json`).map((e: any) => ({
    author: AUTHOR_UNKNOWN,
    dynasty: '先秦', genre: '诗',
    title: cut(norm(e.title) || '(佚篇)'),
    paragraphs: contentLines(e.content).map((s: string) => s.replace(/[；。]/g, (m: string) => (m === '；' ? '； ' : '。 '))),
  }))
);

/* ---- 曹操诗集 ---- */
push(() =>
  readJson(`${CWD}/曹操诗集/caocao.json`).map((e: any) => ({
    author: '曹操', dynasty: '三国', genre: '诗',
    title: cut(norm(e.title) || '(无题)'),
    paragraphs: contentLines(e.paragraphs),
  }))
);

/* ---- 纳兰性德词 ---- */
push(() =>
  readJson(`${CWD}/纳兰性德/纳兰性德诗集.json`).map((e: any) => ({
    author: '纳兰性德', dynasty: '清代', genre: '词',
    title: cut(norm(e.title || e.author) || '(无题)'),
    paragraphs: contentLines(e.para).map((s: string) => s.replace(/[，。]/g, (m: string) => (m === '，' ? '， ' : '。 '))),
  }))
);

/* ---- 论语/孟子/大学/中庸 (四书) ---- */
const siShu: { file: string; author: string; start: number }[] = [
  { file: `${CWD}/论语/lunyu.json`, author: '孔子及弟子', start: 0 },
  { file: `${CWD}/四书五经/mengzi.json`, author: '孟子及弟子', start: 0 },
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
push(() => bookList(`${CWD}/四书五经/daxue.json`, '曾参'));
push(() => bookList(`${CWD}/四书五经/zhongyong.json`, '子思'));

/* ---- 幽梦影 ---- */
push(() =>
  readJson(`${CWD}/幽梦影/youmengying.json`).map((e: any, i: number) => ({
    author: '张潮', dynasty: '清代', genre: '小品',
    title: `幽梦影 · 第${i + 1}则`,
    paragraphs: [String(e.content ?? '')],
  }))
);

/* ---- 蒙学 ---- */
const mengFiles = ['sanzijing-new', 'baijiaxing', 'qianziwen', 'dizigui', 'zengguangxianwen', 'youxueqionglin', 'shenglvqimeng', 'wenzimengqiu', 'zhuzijiaxun', 'baijiaxing'].filter((x, i, a) => a.indexOf(x) === i);
push(() => {
  const out: Item[] = [];
  for (const base of mengFiles) {
    const d = readJson(`${CWD}/蒙学/${base}.json`);
    let paras: string[] = [];
    if (Array.isArray(d.paragraphs)) paras = d.paragraphs.map((x: any) => String(x));
    else if (d.content !== undefined) paras = contentLines(d.content);
    if (!paras.length) continue;
    out.push({
      author: norm(d.author) || AUTHOR_UNKNOWN,
      dynasty: '中华蒙学', genre: '文',
      title: cut(norm(d.title || d.name || base)),
      paragraphs: paras,
    });
  }
  return out;
});

/* ---- 运行 ---- */
async function main() {
  const client = getSupabaseClient();

  // 1) 收集作者
  const authorSet = new Map<string, Set<string>>(); // name -> dynasties
  for (const mk of corpora) {
    for (const it of mk()) authorSet.set(it.author, (authorSet.get(it.author) ?? new Set()).add(it.dynasty));
  }

  // 2) 现有作者的 id 映射
  let authorMap = new Map<string, string>();
  {
    const rows = await client.from('authors').select('id,name,dynasty');
    for (const r of rows.data ?? []) authorMap.set(`${r.name}|${r.dynasty}`, r.id as string);
  }

  // 3) 补插新作者
  const newAuthors: { name: string; dynasty: string; bio: string }[] = [];
  for (const [name, dyns] of authorSet) {
    for (const dynasty of dyns) {
      if (!authorMap.has(`${name}|${dynasty}`)) newAuthors.push({ name, dynasty, bio: '' });
    }
  }
  console.log(`新作者数: ${newAuthors.length}`);
  for (let i = 0; i < newAuthors.length; i += 500) {
    const chunk = newAuthors.slice(i, i + 500);
    const { data } = await client.from('authors').insert(chunk).select('id,name,dynasty');
    for (const r of data ?? []) authorMap.set(`${r.name}|${r.dynasty}`, r.id as string);
  }

  // 4) 逐集转换并分批插诗
  let total = 0;
  const t0 = Date.now();
  for (const mk of corpora) {
    const items = mk();
    const genre = items[0]?.genre ?? '';
    const rows: any[] = [];
    for (const it of items) {
      const text = it.paragraphs.join('\n');
      if (!text.trim()) continue;
      const { simple, traditional } = convText(text);
      rows.push({
        title: it.title, author_id: authorMap.get(`${it.author}|${it.dynasty}`) || null,
        dynasty: it.dynasty, genre: it.genre,
        content: simple, content_traditional: traditional,
        pinyin: null, annotation: null, translation: null, appreciation: null,
      });
    }
    // 分批插入
    for (let i = 0; i < rows.length; i += 800) {
      const chunk = rows.slice(i, i + 800);
      const { error } = await client.from('poems').insert(chunk);
      if (error) throw new Error(`${genre} 插入失败: ${error.message}`);
    }
    total += rows.length;
    console.log(`已插入 ${genre}: ${rows.length}（累计 ${total}）用时 ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  console.log(`全部完成：新增 ${total} 篇`);
}

main().catch((e) => {
  console.error('失败：', e.message);
  process.exit(1);
});
