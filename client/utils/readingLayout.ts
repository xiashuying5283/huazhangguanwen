import type { PoemDetail, PoemSummary } from '@/utils/api';

export type ReadingKind = 'poem' | 'ci' | 'qu' | 'sao' | 'fu' | 'prose' | 'sketch' | 'fiction';
type BlockKind = 'line' | 'paragraph' | 'heading' | 'tune' | 'cue' | 'stage' | 'gap';
export type ReadingBlock = { kind: BlockKind; text: string; sourceLine?: number; sourceOffset?: number };
type SourceLine = { text: string; index: number };

const chapter = /^(?:第[〇零一二三四五六七八九十百千万萬两兩\d]+[章节節回折出幕卷]|[楔禊]子)(?=$|[\s：:、·]|[^，。！？；]{1,25}$)/u;
const volume = /^卷[〇零一二三四五六七八九十百\d]+[·・．.]/u;
const novelChapter = /^第[〇零一二三四五六七八九十百千万萬两兩\d]+回/u;
const tune = /^(?:【[^】\n]{1,18}】|〔[^〕\n]{1,18}〕|〖[^〗\n]{1,18}〗|［[^］\n]{1,18}］)/u;
const actor = /^(?:正旦|正末|小旦|老旦|小生|旦兒|旦儿|[外末旦生淨净丑醜貼贴雜杂])$/u;
const cue = /^\p{Script=Han}{1,12}[云雲白唱道]$/u;
const direction = /科[云雲白唱]?$|[上下](?:詩|诗)?[云雲白唱]?$/u;

function readingKind(poem: PoemSummary): ReadingKind {
  const genre = poem.genre?.trim() ?? '';
  const title = poem.title.trim();
  if (/曲|[杂雜][剧劇]|[戏戲][剧劇]/u.test(genre)) return 'qu';
  if (/骚|騷/u.test(genre)) return 'sao';
  if (/^(?:[宋小慢长長]?[词詞]|[词詞]牌)$/u.test(genre)) return 'ci';
  if (/[诗詩]|[绝絕]句|律[诗詩]/u.test(genre)) return 'poem';
  if (/小[说說]|章回|话本|話本/u.test(genre) || novelChapter.test(title)) return 'fiction';
  if (/小品|[笔筆][记記]|[随隨][笔筆]/u.test(genre) || /^幽[梦夢]影/u.test(title) || /幽[梦夢]影/u.test(poem.work_name ?? '')) return 'sketch';
  if (/[赋賦]/u.test(genre) || /[赋賦](?:[（(]?并序[）)]?)?$/u.test(title)) return 'fu';
  return 'prose';
}

const kindNames: Record<ReadingKind, string> = {
  poem: '诗', ci: '词', qu: '曲', sao: '骚体', fu: '赋', prose: '文章', sketch: '小品', fiction: '小说',
};

export function readingGenreLabel(poem: PoemSummary) {
  return kindNames[readingKind(poem)];
}

function sourceLines(content: string): SourceLine[] {
  const lines = content.split(/\r\n?|\n/u).map((text, index) => ({ text: text.trim(), index }));
  // These imported folios start with the source site's navigation and a view-count label.
  const navigationEnd = lines.slice(0, 42).findIndex(({ text }) => /^查看\s*[:：]\s*\|$/u.test(text));
  if (/^[经經]部$/u.test(lines[0]?.text) && /^【[编編]年】$/u.test(lines[1]?.text) && navigationEnd >= 20) {
    return lines.slice(navigationEnd + 1);
  }
  return lines;
}

function splitParagraph(text: string) {
  if (text.length < 300) return [text];
  const result: string[] = [];
  const closingMarks = '」』”’）)';
  const openingMarks = '「『“‘（(';
  const nesting: string[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const character = text[i];
    const opens = openingMarks.indexOf(character);
    const closes = character === nesting.at(-1);
    if (opens >= 0) nesting.push(closingMarks[opens]);
    else if (closes) nesting.pop();
    const endsSentence = /[。！？!?]/u.test(closes ? text[i - 1] : character);
    if (nesting.length === 0 && i - start >= 134 && endsSentence) {
      result.push(text.slice(start, i + 1));
      start = i + 1;
    }
  }
  if (start < text.length) result.push(text.slice(start));
  return result;
}

function proseBlocks(lines: SourceLine[], kind: ReadingKind, title: string): ReadingBlock[] {
  const importedVolume = volume.test(title);
  const blocks: ReadingBlock[] = [];
  let joined = '';
  for (const line of lines) {
    const { text, index } = line;
    if (kind === 'sketch') {
      if (text) joined += text;
      else if (joined) { blocks.push({ kind: 'paragraph', text: joined }); joined = ''; }
      continue;
    }
    if (!text) continue;
    if ((kind === 'fiction' || importedVolume || kind === 'prose') && text.length <= 60 && chapter.test(text)) {
      blocks.push({ kind: 'heading', text });
      continue;
    }
    if (importedVolume) {
      const separator = text.search(/[ \u3000]{2}/u);
      const heading = separator < 0 ? text : text.slice(0, separator);
      if (/^[^，。！？；：「」]{2,30}[赋賦序表書书贊赞頌颂銘铭記记碑文祭辭辞傳传]$/u.test(heading)) {
        blocks.push({ kind: 'heading', text: heading });
        if (separator >= 0) {
          for (const part of splitParagraph(text.slice(separator).trimStart())) blocks.push({ kind: 'paragraph', text: part });
        }
        continue;
      }
    }
    let offset = 0;
    for (const part of splitParagraph(text)) {
      blocks.push({ kind: 'paragraph', text: part, sourceLine: index, sourceOffset: offset });
      offset += Array.from(part).length;
    }
  }
  if (joined) blocks.push({ kind: 'paragraph', text: joined });
  return blocks;
}

function quBlocks(lines: SourceLine[]): ReadingBlock[] {
  const blocks: ReadingBlock[] = [];
  for (const { text: original, index } of lines) {
    if (!original) { blocks.push({ kind: 'gap', text: '' }); continue; }
    if (original.length <= 60 && chapter.test(original)) {
      blocks.push({ kind: 'heading', text: original });
      continue;
    }
    let text = original;
    let label = tune.exec(text);
    while (label) {
      blocks.push({ kind: 'tune', text: label[0] });
      text = text.slice(label[0].length).trimStart();
      label = tune.exec(text);
    }
    let start = 0;
    const prefix = original.length - text.length;
    const sourceOffset = (position: number) => Array.from(original.slice(0,prefix+position)).length;
    for (const match of text.matchAll(/[（(]([^()（）\n]{1,22})[）)]/gu)) {
      const marker = match[1].trim();
      const isStage = direction.test(marker);
      if (!isStage && !actor.test(marker) && !cue.test(marker)) continue;
      if (match.index > start) blocks.push({ kind: 'line', text: text.slice(start, match.index), sourceLine: index, sourceOffset: sourceOffset(start) });
      blocks.push({ kind: isStage ? 'stage' : 'cue', text: match[0] });
      start = match.index + match[0].length;
    }
    if (start < text.length) {
      const rest = text.slice(start);
      let offset = sourceOffset(start);
      for (const part of splitParagraph(rest)) {
        blocks.push({ kind: 'line', text: part, sourceLine: index, sourceOffset: offset });
        offset += Array.from(part).length;
      }
    }
  }
  return blocks;
}

function ciBreak(lines: SourceLine[], title: string) {
  if (lines.length !== 8 || lines.some(({ text }) => !text)) return -1;
  const meter = lines.map(({ text }) => Array.from(text.matchAll(/\p{Script=Han}/gu)).length).join(',');
  if (/^蝶[恋戀]花(?:$|[·・\s])/u.test(title) && meter === '7,9,7,7,7,9,7,7') return 4;
  if (/^水[调調]歌[头頭](?:$|[·・\s])/u.test(title) && meter === '10,11,15,10,9,11,15,10') return 4;
  return -1;
}

function poemLines({ text, index }: SourceLine): ReadingBlock[] {
  if (!text) return [{ kind: 'gap', text }];
  const clauses = text.match(/\p{Script=Han}{5,7}[，、。！？；,!?;]/gu);
  if (!clauses || clauses.length <= 2 || clauses.length % 2 !== 0 || clauses.join('') !== text) {
    return [{ kind: 'line', text, sourceLine: index }];
  }
  let sourceOffset = 0;
  const result: ReadingBlock[] = [];
  for (let i = 0; i < clauses.length; i += 2) {
    const couplet = clauses[i] + clauses[i + 1];
    result.push({ kind: 'line', text: couplet, sourceLine: index, sourceOffset });
    sourceOffset += Array.from(couplet).length;
  }
  return result;
}

export function prepareReading(poem: PoemDetail, traditional: boolean) {
  const kind = readingKind(poem);
  const content = (traditional ? poem.content_traditional || poem.content : poem.content) ?? '';
  const lines = sourceLines(content);
  const first = lines.findIndex(({ text }) => text);
  const last = lines.reduce((end, line, i) => line.text ? i + 1 : end, 0);
  const body = first < 0 ? [] : lines.slice(first, last);
  const breakAt = kind === 'ci' ? ciBreak(body, poem.title) : -1;
  const blocks: ReadingBlock[] = kind === 'qu' ? quBlocks(body) : kind === 'poem' || kind === 'ci' || kind === 'sao'
    ? body.flatMap(({ text, index }, i) => {
      if (kind === 'poem') return poemLines({ text, index });
      const block: ReadingBlock = { kind: text ? 'line' : 'gap', text, sourceLine: index };
      return i === breakAt ? [{ kind: 'gap', text: '' }, block] : [block];
    })
    : proseBlocks(body, kind, poem.title);
  const rawLines = content.split(/\r\n?|\n/u);
  for (const block of blocks) {
    if (block.sourceLine === undefined) continue;
    const raw = rawLines[block.sourceLine] ?? '';
    const leading = Array.from(raw).length - Array.from(raw.trimStart()).length;
    block.sourceOffset = (block.sourceOffset ?? 0) + leading;
  }
  const length = body.reduce((total, line) => total + line.text.length, 0);
  const long = length > 650 || blocks.length > 35;
  const headings = blocks.flatMap((block, index) => block.kind === 'heading' ? [{ index, label: block.text }] : []);
  const tunes = kind === 'qu' && long ? blocks.flatMap((block, index) => block.kind === 'tune' ? [{ index, label: block.text }] : []) : [];
  const anchors = headings.length ? headings : tunes.length ? tunes : long ? blocks.flatMap((block, index) =>
    index % (kind === 'poem' || kind === 'ci' || kind === 'sao' ? 20 : 8) === 0 && block.text
      ? [{ index, label: block.text.length > 18 ? `${block.text.slice(0, 18)}…` : block.text }] : []) : [];
  const centered = kind === 'poem' && blocks.length <= 16 && length <= 210;
  const compactCi = kind === 'ci' && body.length <= 16 && length <= 160;
  return { kind, label: kindNames[kind], blocks, anchors, centered, compactCi };
}
