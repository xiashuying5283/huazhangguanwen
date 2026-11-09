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

const BATCH = 200;

async function backfill(maxRows: number) {
  let done = 0;
  // 每轮都取当前仍为 null 的批（不带偏移），更新后这些行即从结果集消失，
  // 因此既不漏篇、也不重复，天然规避 range 偏移错位问题。
  for (;;) {
    if (done >= maxRows) break;
    const take = Math.min(BATCH, maxRows - done);
    const { data, error } = await client
      .from('poems')
      .select('id, content')
      .is('pinyin', null)
      .limit(take);
    if (error) throw new Error(error.message);
    const rows = (data || []) as { id: string; content: string | null }[];
    if (!rows.length) break; // 已无待处理行

    const upd = rows
      .map((r) => ({ id: r.id, pinyin: contentPy(r.content || '') }))
      .filter((u) => u.pinyin.length > 0);
    if (upd.length) {
      // 逐条 update（仅写 pinyin 列），并发 3 + 间隔，规避 API 限流
      const queue = [...upd];
      const runOne = async () => {
        while (queue.length) {
          const u = queue.shift()!;
          const { error: ue } = await client.from('poems').update({ pinyin: u.pinyin }).eq('id', u.id);
          if (ue) throw new Error(`update 失败: ${ue.message}`);
          await new Promise((r) => setTimeout(r, 60));
        }
      };
      const workers = Array.from({ length: Math.min(3, queue.length) }, () => runOne());
      await Promise.all(workers);
    }
    done += rows.length;
    console.log('  已处理', done, '(本轮', rows.length, ')');
    if (rows.length < take) break;
  }
  return done;
}

function parse(): { limit: number } {
  const a = process.argv.slice(2);
  const i = a.indexOf('--limit');
  return { limit: i >= 0 ? Number(a[i + 1]) : 1000000 };
}

(async () => {
  const { limit } = parse();
  console.log('开始为正文拼音回填，limit =', limit);
  const n = await backfill(limit);
  console.log('完成，共', n, '篇');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});