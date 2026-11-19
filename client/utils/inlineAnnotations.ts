export type InlineAnnotation = { word: string; explanation: string };
export type AnchoredAnnotation = InlineAnnotation & { line: number; start: number; end: number; source_text: string };
export type AnnotationContext = { line?: number; offset?: number };
type Match = InlineAnnotation & { start: number; end: number };

export function parseInlineAnnotations(annotation: string | null | undefined) {
  const entries = new Map<string, string>();
  for (const line of (annotation ?? '').replace(/\s*([①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳])/gu, '\n$1').split(/\r?\n/u)) {
    const headings = [...line.matchAll(/(?:^|[。！？])\s*(?:[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]|\d{1,3}[.、]\s*)?(\p{Script=Han}{1,14}(?:、\p{Script=Han}{1,14}){0,5})[：:]/gu)];
    headings.forEach((heading, index) => {
      const next = headings[index + 1];
      const end = next ? next.index + 1 : line.length;
      const explanation = line.slice(heading.index + heading[0].length, end).trim();
      if (!explanation) return;
      for (const word of heading[1].split('、')) {
        if (!entries.has(word)) entries.set(word, explanation);
      }
    });
  }
  return entries;
}

export function annotationMatcher(entries: Map<string, string>, notes?: AnchoredAnnotation[] | null) {
  const anchored = notes?.filter((note) => typeof note.word === 'string' && typeof note.explanation === 'string'
    && typeof note.source_text === 'string' && Number.isInteger(note.line) && note.line >= 0
    && Number.isInteger(note.start) && Number.isInteger(note.end) && note.start >= 0 && note.end > note.start);
  if (anchored?.length) return (text: string, reference?: string, context?: AnnotationContext): Match[] => {
    if (context?.line === undefined) return [];
    const displayed = Array.from(text);
    const original = Array.from(reference ?? text);
    if (original.length !== displayed.length) return [];
    const indexes = original.flatMap((char,index) => char === '\n' ? [] : [index]);
    const source = indexes.map((index) => original[index]).join('');
    const offset = context.offset ?? 0;
    const matches: Match[] = [];
    for (const note of anchored) {
      if (note.line !== context.line || note.start < offset || note.end > offset + indexes.length) continue;
      const raw = Array.from(note.source_text);
      if (raw.slice(offset,offset+indexes.length).join('') !== source || raw.slice(note.start,note.end).join('') !== note.word) continue;
      const start = indexes[note.start-offset];
      const end = indexes[note.end-offset-1]+1;
      matches.push({ start,end,word: displayed.slice(start,end).join(''),explanation: note.explanation });
    }
    let end = 0;
    return matches.sort((a,b) => a.start-b.start || b.end-a.end).filter((match) => {
      if (match.start < end) return false;
      end = match.end; return true;
    });
  };
  if (entries.size === 0) return undefined;
  const pattern = new RegExp([...entries.keys()].sort((a, b) => b.length - a.length).map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'gu');
  return (text: string, reference?: string, _context?: AnnotationContext): Match[] => {
    const displayed = Array.from(text);
    const source = reference && Array.from(reference).length === displayed.length ? reference : text;
    return [...source.matchAll(pattern)].map((match) => {
      const start = Array.from(source.slice(0, match.index)).length;
      const end = start + Array.from(match[0]).length;
      return { start, end, word: displayed.slice(start, end).join(''), explanation: entries.get(match[0]) ?? '' };
    });
  };
}
