/**
 * 元曲 title「正文混入标题 + 正文劈断」智能修复
 *
 * 背景：部分元曲的 title 形如「曲牌名・正文前段」，正文被劈成两半
 *   - 正常形式：剧名・曲牌名（・右侧是 2-4 字短曲牌名，如 两军师隔江斗智・天下乐）
 *   - 错位形式：曲牌名・正文前段……末尾（・右侧是长正文，且正文在无句读处被砍断）
 *
 * 智能判定规则：
 *   若 title 含「・」且「・」右侧是"长正文"（长度≥5 且含中文字与标点），则判定为错位：
 *     - title 修正为「・」左侧部分（若左侧也含・则保留前两段 -> 剧名・曲牌名）
 *     - content = 原「・」右侧正文 + 原 content（把劈断的前半归还，恢复完整正文）
 *   若「・」右侧是短曲牌名（<5 字或 4 字内），属正常，不动。
 *
 * 干跑模式：--dry 只打印不执行；默认执行。
 */
import { getSupabaseClient } from './storage/database/supabase-client';

const DRY = process.argv.includes('--dry');

const client = getSupabaseClient();

// 句子标点（用于判断某段是否为"正文"而非曲牌名）
const isBodyLike = (seg: string) =>
  /[。？！，、；：」』]/.test(seg) || /[字词].{3,}$/.test(seg);

/**
 * 判断 title 拆分并返回修复方案，若无需修复返回 null。
 * @returns { title: 新title, content: 新content } 或 null
 */
function fix(title: string, content: string) {
  if (!title.includes('・')) return null;
  const parts = title.split('・');
  const last = parts[parts.length - 1];

  // 「・」右侧是正文的特征：较长 且 含句读标点
 
  // 只处理右侧明显是"正文句"（含标点即视为正文）
  if (!/[。？！，、；」』：]/.test(last)) return null;

  // 右侧属于正文 -> 错位
  // 新 title：把正文段去掉；若剩多段，取 前两段（剧名・曲牌名）
  let newTitle: string;
  if (parts.length >= 3) {
    // 例：混江龙・某・正文 -> 可能前面还有剧名层次，保守取前两段
    newTitle = parts.slice(0, 2).join('・');
  } else {
    // 例：混江龙・正文 -> 只保留曲牌名
    newTitle = parts[0];
  }

  // 新 content：把混入 title 的正文段拼回 content 最前（保持原文连续）
  const newContent = (last + content).replace(/^\s*\n/, '');

  return { title: newTitle, content: newContent };
}

async function main() {
  let page = 0;
  const BATCH = 500;
  let processed = 0;
  let fixed = 0;
  const samples: string[] = [];

  for (;;) {
    const { data, error } = await client
      .from('poems')
      .select('id,title,work_id,content')
      .eq('work_id', 'w-yuanqu')
      .range(page * BATCH, page * BATCH + BATCH - 1);

    if (error) throw new Error(`查询失败: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const row of data) {
      processed++;
      const title = row.title || '';
      const content = row.content || '';
      const r = fix(title, content);
      if (r) {
        fixed++;
        if (samples.length < 120) {
          samples.push(
            `ID=${row.id}\n  T:${title}\n  ->T:${r.title}\n  C:${content.slice(0, 26)}\n  ->C:${r.content.slice(0, 40)}`
          );
        }
        if (!DRY) {
          const { error: upErr } = await client
            .from('poems')
            .update({ title: r.title, content: r.content, pinyin: null })
            .eq('id', row.id);
          if (upErr) console.warn('更新失败', row.id, upErr.message);
        }
      }
    }
    page++;
    if (processed % 2000 < BATCH) console.log(`已扫 ${processed} / 命中 ${fixed}`);
    if (page * BATCH > 12000) break;
  }

  console.log(`\n==== 结果 ====`);
  console.log(`共扫描: ${processed}`);
  console.log(`命中错位待修: ${fixed}`);
  console.log(`模式: ${DRY ? 'DRY-RUN(仅预览，未写库)' : '已执行写库'}`);
  if (samples.length) {
    console.log('\n--- 样例预览 (前 12 条) ---');
    samples.slice(0, 12).forEach((s, i) => console.log(`\n[${i + 1}]\n${s}`));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});