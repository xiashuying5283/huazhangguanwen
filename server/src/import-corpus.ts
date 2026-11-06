/* 批量导入全唐诗 + 全宋词语料（chinese-poetry 数据集）到 poems/authors 表
 * 用法: npx tsx src/import-corpus.ts
 */
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { Converter } from 'opencc-js';
import { getSupabaseClient } from './storage/database/supabase-client';

const CORPUS = process.env.CORPUS_DIR || '/workspace/projects/corpus';
const client = getSupabaseClient();

const tw2cn = Converter({ from: 'tw', to: 'cn' });
const cn2tw = Converter({ from: 'cn', to: 'tw' });

const log = (m: string) => {
  console.log(`[import] ${new Date().toISOString()} ${m}`);
};

interface PoemRow {
  title: string;
  author: string;
  dynasty: string;
  genre: string;
  content: string;          // 简体
  content_traditional: string; // 繁体
}

function readJson(f: string): any[] {
  return JSON.parse(readFileSync(f, 'utf8'));
}

function trunc(title: string): string {
  return title.length > 120 ? `${title.slice(0, 120)}…` : title;
}

// 解析全唐诗 (poet.tang.*.json) —— 源为繁体
function parseTang(file: string): PoemRow[] {
  return readJson(file).map((e: any) => {
    const paragraphs: string[] = (e.paragraphs || []).map((p: string) => p.trim());
    const traditional = paragraphs.join('\n');
    return {
      title: trunc(e.title || '无题'),
      author: (e.author || '佚名').trim(),
      dynasty: '唐代',
      genre: '诗',
      content: tw2cn(traditional),
      content_traditional: traditional,
    };
  });
}

// 解析全宋词 (ci.song.*.json) —— 源为简体
function parseCi(file: string): PoemRow[] {
  return readJson(file).map((e: any) => {
    const paragraphs: string[] = (e.paragraphs || []).map((p: string) => p.trim());
    const simplified = paragraphs.join('\n');
    const rhythmic = (e.rhythmic || '').trim();
    const title = trunc(e.title ? `${rhythmic}·${e.title}` : (rhythmic || '无题'));
    return {
      title,
      author: (e.author || '佚名').trim(),
      dynasty: '宋代',
      genre: '词',
      content: simplified,
      content_traditional: cn2tw(simplified),
    };
  });
}

async function getAllPoemFiles(): Promise<string[]> {
  const tangDir = join(CORPUS, '全唐诗');
  const ciDir = join(CORPUS, '宋词');
  const tangFiles = readdirSync(tangDir)
    .filter((f) => /^poet\.tang\.\d+\.json$/.test(f))
    .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]))
    .map((f) => join(tangDir, f));
  const ciFiles = readdirSync(ciDir)
    .filter((f) => /^ci\.song\.\d+\.json$/.test(f))
    .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]))
    .map((f) => join(ciDir, f));
  return [...tangFiles, ...ciFiles];
}

async function ensureAuthors(rows: PoemRow[]): Promise<Map<string, string>> {
  // 收集所需作者
  const needed = new Map<string, { name: string; dynasty: string }>();
  for (const r of rows) {
    needed.set(`${r.author}|${r.dynasty}`, { name: r.author, dynasty: r.dynasty });
  }

  // 现有作者
  const { data: existing, error } = await client.from('authors').select('id, name, dynasty');
  if (error) throw new Error(`读取作者失败: ${error.message}`);
  const map = new Map<string, string>();
  for (const a of existing as any[]) map.set(`${a.name}|${a.dynasty}`, a.id);

  // 需新增的作者
  const toAdd: any[] = [];
  for (const [key, { name, dynasty }] of needed) {
    if (!map.has(key)) toAdd.push({ name, dynasty, bio: '' });
  }
  if (toAdd.length > 0) {
    log(`新增作者 ${toAdd.length} 位`);
    for (let i = 0; i < toAdd.length; i += 1000) {
      const chunk = toAdd.slice(i, i + 1000);
      const { data: ins, error: ie } = await client
        .from('authors')
        .insert(chunk)
        .select('id, name, dynasty');
      if (ie) throw new Error(`插入作者失败: ${ie.message}`);
      for (const a of (ins as any[]) || []) map.set(`${a.name}|${a.dynasty}`, a.id);
    }
  }
  return map;
}

async function main() {
  const files = await getAllPoemFiles();
  log(`发现语料文件 ${files.length} 个`);

  // 防重复：若库中诗文量已明显大于种子数据，则中止
  const { count } = await client.from('poems').select('*', { count: 'exact', head: true });
  log(`当前 poems 总数: ${count}`);
  if ((count || 0) > 3000) {
    log('已检测到大量诗文，疑似已导入，中止执行。');
    return;
  }

  // 第一步：收集全部作者并 upsert
  const allRows: PoemRow[] = [];
  for (const f of files) {
    const rows = f.includes('全唐诗') ? parseTang(f) : parseCi(f);
    allRows.push(...rows);
  }
  log(`解析到诗文 ${allRows.length} 首`);

  const authorMap = await ensureAuthors(allRows);
  log(`作者映射就绪，共 ${authorMap.size} 位`);

  // 第二步：分块插入诗文
  const BATCH = 800;
  let done = 0;
  for (let i = 0; i < allRows.length; i += BATCH) {
    const chunk = allRows.slice(i, i + BATCH).flatMap((r) => {
      const author_id = authorMap.get(`${r.author}|${r.dynasty}`);
      if (!author_id) return []; // 理论上不会发生
      return [{
        title: r.title,
        author_id,
        dynasty: r.dynasty,
        genre: r.genre,
        content: r.content,
        content_traditional: r.content_traditional,
        pinyin: null,
        annotation: null,
        translation: null,
        appreciation: null,
      }];
    });
    if (chunk.length === 0) continue;
    const { error } = await client.from('poems').insert(chunk);
    if (error) throw new Error(`插入诗文失败: ${error.message}`);
    done += chunk.length;
    if (done % 8000 < BATCH) log(`已插入 ${done}/${allRows.length}`);
  }
  log(`导入完成，共 ${done} 首诗文。`);
}

// tsx 直运行时执行
if (process.argv[1] && process.argv[1].includes('import-corpus')) {
  main().then(() => process.exit(0)).catch((e) => {
    console.error('[import] 失败:', e.message);
    process.exit(1);
  });
}