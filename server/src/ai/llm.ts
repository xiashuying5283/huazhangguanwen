import { LLMClient, Config, HeaderUtils, type Message } from 'coze-coding-dev-sdk';

/**
 * 基于大模型的古文内容生成中心。
 * 仅服务端使用，负责：诗人生平、诗文注解/翻译/赏析的文案生成。
 * 生成结果由调用方写入数据库缓存（同一篇只生成一次）。
 */
const MODEL = 'doubao-seed-2-0-pro-260215';

export interface GenContent {
  annotation: string;
  translation: string;
  appreciation: string;
}

const systemForBio =
  '你是一位博学严谨的中国古典文学专家和文学史学者。' +
  '请为给定诗人/作者撰写一份精炼的生平介绍（150-260字），概述其生平经历、文学成就、风格特点与历史地位。' +
  '语言用现代汉语，条理清晰，史实准确；若确无可靠生平的佚名/合集作者，请如实说明。只输出正文，不要任何标题、编号或客套话。';

const systemForAnalysis =
  '你是一位功底深厚的中国古代诗文鉴赏专家。' +
  '请仅依据我提供的诗（或词/曲/文言文）原文，输出三部分，每部分用「【注解】」「【译文】」「【赏析】」单独成段：\n' +
  '【注解】逐句或分节解释字词、典故、难句含义，简洁准确；\n' +
  '【译文】用通顺的现代汉语将全文逐句翻译（保持分行或句读对应）；\n' +
  '【赏析】从意象、手法、情感、主旨等方面赏析，约150-250字，语言凝练有见地。\n' +
  '只输出这三个段落及标记，不要其他说明。若原文过短或为残句，尽力而为并注明。';

async function createClient(headers?: Record<string, string>) {
  const config = new Config();
  const client = new LLMClient(config, headers);
  return client;
}

const stripMarkers = (s: string): string => s.replace(/^```(?:json|text)?/i, '').replace(/```$/i, '').trim();

/** 生成诗人生平 */
export async function generateBio(name: string, dynasty: string, extra: string, headers?: Record<string, string>): Promise<string> {
  const client = await createClient(headers);
  const prompt =
    `${name}（${dynasty}）。` +
    (extra ? `已知信息：${extra}\n` : '') +
    '请撰写其生平简介。';
  const res = await client.invoke(
    [
      { role: 'system', content: systemForBio },
      { role: 'user', content: prompt },
    ],
    { model: MODEL, temperature: 0.7 },
  );
  return stripMarkers(res.content);
}

/** 生成诗文注解/翻译/赏析 */
export async function generateContent(title: string, author: string, dynasty: string, content: string, headers?: Record<string, string>): Promise<GenContent> {
  const client = await createClient(headers);
  const prompt =
    `篇名：${title}\n作者：${author || '佚名'}（${dynasty || '朝代不详'}）\n\n原文：\n${content}`;
  const res = await client.invoke(
    [
      { role: 'system', content: systemForAnalysis },
      { role: 'user', content: prompt },
    ],
    { model: MODEL, temperature: 0.7 },
  );
  return parseAnalysis(stripMarkers(res.content));
}

function parseAnalysis(text: string): GenContent {
  const grab = (label: string): string => {
    const re = new RegExp(`【${label}】([\\s\\S]*?)(?=【译文】|【赏析】|$)`, 'i');
    const m = text.match(re);
    return m ? m[1].trim() : '';
  };
  return {
    annotation: grab('注解'),
    translation: grab('译文'),
    appreciation: grab('赏析'),
  };
}

export { HeaderUtils };