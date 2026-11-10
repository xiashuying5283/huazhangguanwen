import { pinyin } from 'pinyin-pro';
import { getSupabaseClient } from './storage/database/supabase-client';

const client = getSupabaseClient();

const HAN = /[\u3400-\u9fff]/;

// 与 seed.ts / pinyin-backfill.ts 逐字拼音逻辑一致
function linePy(line: string): { c: string; p: string }[] {
  return Array.from(line).map((ch) => {
    if (HAN.test(ch)) {
      const raw = pinyin(ch, { toneType: 'symbol' }) || '';
      const p = raw.replace(/[^a-zA-Zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüńň]|\d/g, '').trim();
      return { c: ch, p };
    }
    return { c: ch, p: '' };
  });
}
function contentPy(content: string) {
  return (content || '').split('\n').map(linePy);
}

// 把单行内容按中文标点断行成「一句一行」。
function splitToLines(content: string): string {
  if (!content || content.includes('\n')) return content;
  const segs = content.match(/[^，。？！；、]+[，。？！；、]|[^，。？！；、]+$/g) || [];
  const lines = segs.map((s) => s.trim()).filter(Boolean);
  if (lines.length <= 1) return content; // 本就是单句，不改
  return lines.join('\n');
}

const BATCH = 200;

// 直接命中「不含换行」的单行诗（not.like）,逐条判读是否多句可断。
async function fixSingleLines() {
  let done = 0;
  let written = 0;
  let noProgress = 0;
  for (;;) {
    const { data, error } = await client
      .from('poems')
      .select('id, content')
      .not('content', 'like', '%\n%')
      .limit(BATCH);
    if (error) throw new Error(error.message);
    const rows = (data || []) as { id: string; content: string | null }[];
    if (!rows.length) break;

    const upd: { id: string; content: string; pinyin: unknown }[] = [];
    for (const r of rows) {
      const c = splitToLines(r.content || '');
      if (c !== r.content) upd.push({ id: r.id, content: c, pinyin: contentPy(c) });
    }
    if (upd.length) {
      const queue = [...upd];
      const runOne = async () => {
        while (queue.length) {
          const u = queue.shift()!;
          const { error: ue } = await client
            .from('poems')
            .update({ content: u.content, pinyin: u.pinyin })
            .eq('id', u.id);
          if (ue) throw new Error(`update 失败: ${ue.message}`);
          await new Promise((r) => setTimeout(r, 60));
        }
      };
      const workers = Array.from({ length: Math.min(3, queue.length) }, () => runOne());
      await Promise.all(workers);
      written += upd.length;
      noProgress = 0;
    } else {
      // 本批无任何可改写行：剩余是纯单句（拆不成多句），继续取可能死循环
      noProgress += 1;
      if (noProgress >= 3) {
        console.log('  连续无进展，停止（剩余为无法断句的单句）');
        break;
      }
    }
    done += rows.length;
    console.log('  本轮读', rows.length, '| 改写', upd.length, '| 累计改写', written);
  }
  return { done, written };
}

async function fixAll() {
  const { done, written } = await fixSingleLines();
  return { done, written };
}

(async () => {
  console.log('开始为单行诗文按句断行并重建拼音…');
  const { done, written } = await fixAll();
  console.log('扫描', done, '篇 | 改写', written, '篇');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});