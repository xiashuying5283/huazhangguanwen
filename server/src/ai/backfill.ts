import { getSupabaseClient } from '../storage/database/supabase-client';
import { generateBio, generateContent } from './llm';

/**
 * 批量预热脚本：为缺生平的人物、缺解析/译文/赏析的诗文调用大模型生成并写库。
 * 使用：tsx src/ai/backfill.ts --authors 50 --poems 80
 * 支持只跑其中一项；可多次运行累积覆盖，已生成的内容会自动跳过。
 */
const client = getSupabaseClient();

function parseArgs(): { authors: number; poems: number } {
  const args = process.argv.slice(2);
  const n = (k: string) => {
    const i = args.indexOf(k);
    return i >= 0 ? Number(args[i + 1]) || 0 : 0;
  };
  return { authors: n('--authors'), poems: n('--poems') };
}

async function backfillAuthors(limit: number): Promise<number> {
  let done = 0;
  let start = 0;
  while (done < limit) {
    const pageSize = Math.min(limit - done, 50);
    const { data, error } = await client
      .from('authors')
      .select('id, name, dynasty, bio')
      .or('bio.is.null,bio.eq.')
      .range(start, start + pageSize - 1);
    if (error) throw new Error(error.message);
    const rows = data || [];
    if (!rows.length) break;
    for (const a of rows) {
      if (a.bio && a.bio.trim()) { done++; continue; }
      try {
        const bio = await generateBio(a.name, a.dynasty || '不详', '');
        await client.from('authors').update({ bio: bio.trim() }).eq('id', a.id);
        done++;
        console.log(`[bio] ${a.name}: ${bio.trim().slice(0, 28)}…`);
      } catch (e: any) {
        console.error(`[bio][skip] ${a.name}: ${e.message}`);
        done++; // 计数推进，避免死循环（失败作者跳过）
      }
    }
    start += rows.length;
  }
  return done;
}

async function backfillPoems(limit: number): Promise<number> {
  let done = 0;
  let start = 0;
  while (done < limit) {
    const pageSize = Math.min(limit - done, 25);
    const { data, error } = await client
      .from('poems')
      .select('id, title, dynasty, genre, content, annotation, translation, appreciation, authors(name)')
      .or('annotation.is.null,annotation.eq.,translation.is.null,translation.eq.,appreciation.is.null,appreciation.eq.')
      .range(start, start + pageSize - 1);
    if (error) throw new Error(error.message);
    const rows = data || [];
    if (!rows.length) break;
    for (const p of rows) {
      if (p.annotation && p.translation && p.appreciation) { done++; continue; }
      try {
        const r = await generateContent(p.title, p.authors?.[0]?.name || '佚名', p.dynasty, p.content);
        await client
          .from('poems')
          .update({
            annotation: r.annotation || null,
            translation: r.translation || null,
            appreciation: r.appreciation || null,
          })
          .eq('id', p.id);
        done++;
        console.log(`[poem] ${p.title}`);
      } catch (e: any) {
        console.error(`[poem][skip] ${p.title}: ${e.message}`);
        done++;
      }
    }
    start += rows.length;
  }
  return done;
}

(async () => {
  const { authors, poems } = parseArgs();
  if (authors) console.log('== 生成作者生平，目标', authors, '==');
  if (authors) console.log('已完成作者:', await backfillAuthors(authors));
  if (poems) console.log('== 生成诗文解析，目标', poems, '==');
  if (poems) console.log('已完成诗文:', await backfillPoems(poems));
  console.log('全部完成');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});