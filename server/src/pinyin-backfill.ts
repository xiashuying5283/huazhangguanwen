import { pinyin } from 'pinyin-pro';
import { getSupabaseClient } from './storage/database/supabase-client';

const client = getSupabaseClient();

const HAN = /[\u3400-\u9fff]/;

// 与 seed.ts 逐字拼音逻辑一致：单字取音、symbol 声调、剔除数字与符号
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

async function flush(batch: { id: string; pinyin: { c: string; p: string }[][] }[]) {
  for (const b of batch) {
    await client.from('poems').update({ pinyin: b.pinyin }).eq('id', b.id);
  }
  console.log('  flushed', batch.length);
}

async function backfill(limit: number) {
  let done = 0;
  let start = 0;
  let chunk: { id: string; pinyin: { c: string; p: string }[][] }[] = [];
  for (;;) {
    if (done >= limit) break;
    const ps = Math.min(limit - done, 200);
    const { data, error } = await client
      .from('poems')
      .select('id, content')
      .is('pinyin', null)
      .range(start, start + ps - 1);
    if (error) throw new Error(error.message);
    const rows = (data || []) as { id: string; content: string | null }[];
    if (!rows.length) break;
    for (const r of rows) {
      try {
        chunk.push({ id: r.id, pinyin: contentPy(r.content || '') });
        done++;
      } catch (e: any) {
        console.error('skip', r.id, e.message);
      }
    }
    if (chunk.length >= 200) {
      await flush(chunk);
      chunk = [];
    }
    if (rows.length < ps) break;
    start += rows.length;
  }
  if (chunk.length) await flush(chunk);
  return done;
}

function parse(): { limit: number } {
  const a = process.argv.slice(2);
  const i = a.indexOf('--limit');
  return { limit: i >= 0 ? Number(a[i + 1]) : 200 };
}

(async () => {
  console.log('开始为正文拼音回填，limit =', parse().limit);
  const n = await backfill(parse().limit);
  console.log('完成，共', n, '篇');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});