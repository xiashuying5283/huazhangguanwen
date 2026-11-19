import { Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ink, paperStyles } from '@/components/Paper';
import { theme } from '@/theme';
import type { prepareReading } from '@/utils/readingLayout';
import type { PinyinChar } from '@/utils/api';
import type { annotationMatcher, InlineAnnotation } from '@/utils/inlineAnnotations';

type Layout = ReturnType<typeof prepareReading>;
const openingMark = /^[（〔［【「『《〈“‘([]$/u;
const closingMark = /^[、。，；：？！…）〕］】」』》〉”’％,.!?;:%)\]]$/u;

function rubyGroups(characters: string[]) {
  const groups: number[][] = [];
  let pending: number[] = [];
  characters.forEach((character, index) => {
    const previous = groups.at(-1);
    if (closingMark.test(character) && previous && pending.length === 0) {
      previous.push(index);
    } else {
      pending.push(index);
      if (!openingMark.test(character)) {
        groups.push(pending);
        pending = [];
      }
    }
  });
  if (pending.length) groups.push(pending);
  return groups;
}

export function ReadingBody({ layout, pinyin, size, onAnchor, matchAnnotations, referenceLayout, onAnnotation }: {
  layout: Layout;
  pinyin?: PinyinChar[][] | null;
  size: number;
  onAnchor: (index: number, y: number) => void;
  matchAnnotations?: ReturnType<typeof annotationMatcher>;
  referenceLayout?: Layout;
  onAnnotation: (annotation: InlineAnnotation) => void;
}) {
  const { kind, blocks, centered, compactCi } = layout;
  const { width } = useWindowDimensions();
  const anchors = new Set(layout.anchors.map(({ index }) => index));
  const prose = kind === 'prose' || kind === 'fiction' || kind === 'fu' || kind === 'sketch';
  const fontSize = centered || compactCi || kind === 'sketch' ? size : Math.max(16, size - 2);
  const ciWidth = compactCi
    ? blocks.reduce((longest, block) => Math.max(longest, Array.from(block.text).length), 0) * (fontSize + (pinyin ? 6 : 0)) + 16
    : undefined;
  const lineWidth = (Platform.OS === 'web' ? Math.min(width, 510) : width) - 48;
  const bodyStyle = { fontSize, lineHeight: Math.round(fontSize * (prose ? 1.75 : 1.62)) };
  const indent = kind === 'prose' || kind === 'fiction' || kind === 'fu';

  return <>
    {blocks.map((block, index) => {
      const anchor = anchors.has(index) ? (y: number) => onAnchor(index, y) : undefined;
      const source = block.sourceLine === undefined ? undefined : pinyin?.[block.sourceLine];
      const characters = source ? Array.from(block.text) : undefined;
      const line = characters && block.sourceOffset !== undefined
        ? source?.slice(block.sourceOffset, block.sourceOffset + characters.length)
        : source;
      const ruby = characters && Array.isArray(line) && characters.length === line.length;
      const format = (value: string) => !ruby && centered && Array.from(value).length * (fontSize + 2) > lineWidth
        ? value.replace(/^(\p{Script=Han}{5,7}[，、])(?=\p{Script=Han}{5,7}[。！？]?$)/u, '$1\n')
        : value;
      const text = format(block.text);
      const reference = referenceLayout?.blocks[index];
      const matchesReference = reference?.kind === block.kind && reference.sourceLine === block.sourceLine && reference.sourceOffset === block.sourceOffset;
      const matches = matchAnnotations?.(text, matchesReference && reference ? format(reference.text) : undefined, { line: block.sourceLine, offset: block.sourceOffset }) ?? [];
      const displayed = matches.length ? Array.from(text) : [];
      let cursor = 0;
      const annotated = matches.flatMap((match) => {
        const before = displayed.slice(cursor, match.start).join('');
        cursor = match.end;
        return [before, <Text key={match.start} style={paperStyles.annotationLink} accessibilityRole="button"
          accessibilityLabel={`${match.word}，查看注释`} onPress={() => onAnnotation(match)}>{match.word}</Text>];
      });
      if (matches.length) annotated.push(displayed.slice(cursor).join(''));
      return (
        <View key={index} style={[styles.block, ciWidth !== undefined && { maxWidth: ciWidth }, index === blocks.length - 1 && styles.last]}
          onLayout={anchor ? ({ nativeEvent: { layout: { y } } }) => anchor(y) : undefined}>
          {block.kind === 'gap' ? <View style={compactCi ? styles.ciGap : styles.gap} /> :
            block.kind === 'heading' ? <Ink accessibilityRole="header" style={styles.heading}>{block.text}</Ink> :
            block.kind === 'tune' ? <Ink style={styles.tune}>{block.text}</Ink> :
            block.kind === 'cue' ? <Ink style={styles.cue}>{block.text}</Ink> :
            block.kind === 'stage' ? <Ink style={styles.stage}>{block.text}</Ink> :
            ruby ? <View style={[styles.rubyLine, centered && styles.rubyCentered, prose && styles.paragraph]}>
              {indent && <View style={{ width: fontSize * 2 }} />}
              {rubyGroups(characters).map((group) => (
                <View key={group[0]} style={styles.rubyGroup}>
                  {group.map((i) => {
                    const character = characters[i];
                    const mark = openingMark.test(character) || closingMark.test(character);
                    const annotation = matches.find((match) => i >= match.start && i < match.end);
                    return <View key={i} style={mark ? styles.rubyMark : styles.rubyCell}>
                      {!mark && <Ink style={styles.pinyin}>{line[i]?.p ?? ''}</Ink>}
                      {annotation ? <Ink style={[{ fontSize }, paperStyles.annotationLink]}
                        accessibilityRole={i === annotation.start ? 'button' : undefined}
                        accessibilityLabel={i === annotation.start ? `${annotation.word}，查看注释` : undefined}
                        onPress={() => onAnnotation(annotation)}>{character}</Ink>
                        : <Ink style={{ fontSize }}>{character}</Ink>}
                    </View>;
                  })}
                </View>
              ))}
            </View> :
            <Ink style={[bodyStyle, centered && styles.centered, block.kind === 'paragraph' && styles.paragraph]}>
              {indent && block.kind === 'paragraph' ? '\u3000\u3000' : ''}{matches.length ? annotated : text}
            </Ink>}
        </View>
      );
    })}
  </>;
}

const styles = StyleSheet.create({
  block: { width: '100%', maxWidth: 590, alignSelf: 'center', paddingHorizontal: 6 },
  last: { marginBottom: 24 },
  centered: { textAlign: 'center', letterSpacing: 2 },
  paragraph: { marginBottom: 13 },
  heading: { fontSize: 24, lineHeight: 34, color: theme.primaryDeep, paddingTop: 15, paddingBottom: 9 },
  tune: { alignSelf: 'flex-start', color: theme.primaryDeep, backgroundColor: 'rgba(117,125,83,0.12)', paddingVertical: 4, paddingRight: 6, marginTop: 12, marginBottom: 4, borderRadius: 5, fontSize: 16 },
  cue: { fontSize: 16, lineHeight: 25, color: theme.primaryDeep, fontWeight: '600', marginTop: 6 },
  stage: { fontSize: 15, lineHeight: 25, color: theme.muted, marginTop: 4 },
  gap: { height: 15 },
  ciGap: { height: 23 },
  rubyLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 6 },
  rubyCentered: { justifyContent: 'center' },
  rubyGroup: { flexDirection: 'row', flexShrink: 0, alignItems: 'flex-end' },
  rubyCell: { alignItems: 'center', paddingHorizontal: 1 },
  rubyMark: { alignItems: 'center' },
  pinyin: { fontSize: 11, color: theme.primaryDeep, minHeight: 15 },
});
