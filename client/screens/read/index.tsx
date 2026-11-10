import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { IconButton, Ink, Message, PageHeader, Paper, Segments, paperStyles as p } from '@/components/Paper';
import { DialogRow, PaperDialog } from '@/components/PaperDialog';
import { ReadingAudio } from '@/components/ReadingAudio';
import { recordRead, setNote, setPreferences, toggleFavorite, useReadingShelf } from '@/contexts/ReadingShelf';
import { useResource } from '@/hooks/useResource';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { Api, hasBackend, type PoemDetail, type PinyinChar } from '@/utils/api';
import { localCreationBackground } from '@/data/localContent';
import { getDeviceId } from '@/utils/device';
import { shareText } from '@/utils/share';
import { theme } from '@/theme';

const tabs = ['注释', '译文', '赏析', '创作背景'] as const;
const fields = { 注释: 'annotation', 译文: 'translation', 赏析: 'appreciation', 创作背景: 'creation_background' } as const;
type Tab = (typeof tabs)[number];
const ANNO_NUMS = ['①','②','③','④','⑤','⑥','⑦','⑧','⑨','⑩','⑪','⑫'];
/** 把注释文本规范化为「一条一行 + 连续序号」 */
function toAnnoLines(text?: string | null): string[] {
  if (!text?.trim()) return [];
  const s = text.replace(/[\r\n]+/g, '\n');
  let parts = s.split(/(?=[①②③④⑤⑥⑦⑧⑨⑩])/).map((x) => x.trim()).filter(Boolean);
  if (parts.length <= 1) parts = s.split(/\n/).map((x) => x.trim()).filter(Boolean);
  if (parts.length <= 1) parts = s.split(/。/).map((x) => x.trim()).filter(Boolean);
  return parts
    .map((x) => x.replace(/^[①②③④⑤⑥⑦⑧⑨⑩]+/, '').replace(/^\d+[.、)）]?\s*/, '').trim())
    .filter(Boolean)
    .map((x, i) => `${ANNO_NUMS[i] ?? (i + 1) + '.'} ${x}`);
}
type Analysis = Pick<PoemDetail, 'annotation' | 'translation' | 'appreciation'>;

export default function ReadScreen() {
  const router = useSafeRouter();
  const { id, play } = useSafeSearchParams<{ id?: string; play?: boolean | string }>();
  const [tab, setTab] = useState<Tab>('注释');
  const [panel, setPanel] = useState<'menu' | 'note'>();
  const [note, setNoteDraft] = useState('');
  const [notice, setNotice] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [analysis, setAnalysis] = useState<{ id: string; result: Analysis }>();
  const lastRead = useRef<string | undefined>(undefined);
  const { data: shelf } = useReadingShelf();
  const { preferences } = shelf;
  const load = useCallback(() => id ? Api.get<PoemDetail>(`/api/v1/poems/${encodeURIComponent(id)}`) : Promise.reject(new Error('缺少诗文信息')), [id]);
  const { data: poem, loading, error, retry } = useResource(load);
  const favorite = shelf.favorites.some((item) => item.kind === '诗文' && item.item.id === id);
  const needsAnalysis = !!(poem && hasBackend && (!poem.annotation || !poem.translation || !poem.appreciation));

  useEffect(() => {
    if (!poem || lastRead.current === poem.id) return;
    lastRead.current = poem.id;
    recordRead(poem);
    if (hasBackend) void getDeviceId().then((deviceId) => Api.post('/api/v1/history', { device_id: deviceId, poem_id: poem.id, action: 'read' })).catch(() => undefined);
  }, [poem]);

  useEffect(() => {
    if (!id || !needsAnalysis) return;
    let active = true;
    Api.post<Analysis>('/api/v1/ai/analysis', { poem_id: id }).then((result) => {
      if (active) setAnalysis({ id, result });
    }).catch(() => { if (active) setAnalysis({ id, result: {} }); });
    return () => { active = false; };
  }, [id, needsAnalysis]);

  const field = fields[tab];
  const generated = field !== 'creation_background' && analysis?.id === id ? analysis?.result[field] : undefined;
  const explanation = poem?.[field] || generated || (poem && tab === '创作背景' ? localCreationBackground(poem) : undefined);
  const content = poem ? (preferences.traditional ? poem.content_traditional || poem.content : poem.content) : '';
  const lines = content.split('\n');
  const hasMore = lines.length > 4;
  const displayContent = expanded ? content : lines.slice(0, 4).join('\n');
  const generating = needsAnalysis && analysis?.id !== id && field !== 'creation_background';

  return (
    <Paper scene="read" warm={preferences.paper === '暖笺'}>
      <PageHeader back>
        {poem && <>
          <IconButton icon="share-outline" label="分享诗文" onPress={async () => {
            try { setNotice(await shareText(poem.title, `${poem.title}\n${poem.dynasty} · ${poem.author_name ?? '佚名'}\n\n${poem.content}`) ?? ''); }
            catch (reason) { if ((reason as Error).name !== 'AbortError') setNotice('当前无法分享'); }
          }} />
          <IconButton icon={favorite ? 'heart' : 'heart-outline'} label={favorite ? '取消收藏诗文' : '收藏诗文'} color={favorite ? theme.cinnabar : theme.ink} onPress={() => toggleFavorite({ kind: '诗文', item: poem })} />
        </>}
      </PageHeader>
      <ScrollView style={p.scroll} contentContainerStyle={p.content} showsVerticalScrollIndicator={false}>
        {loading && <ActivityIndicator color={theme.primary} style={styles.loading} />}
        {error && <Message retry={retry}>{error}</Message>}
        {poem && <>
          <View style={styles.hero}>
            <Ink accessibilityRole="header" style={styles.title}>{poem.title}</Ink>
            <Pressable accessibilityRole="button" disabled={!poem.author_id} onPress={() => router.push('/poet-detail', { id: poem.author_id })}>
              <Ink style={styles.byline}>{poem.dynasty} · {poem.author_name ?? '佚名'}</Ink>
            </Pressable>
            <Verse content={displayContent}
              pinyin={preferences.pinyin ? poem.pinyin : undefined} size={preferences.fontSize} />
            {hasMore && <Pressable accessibilityRole="button" accessibilityState={{ expanded }} style={styles.expand} onPress={() => setExpanded(!expanded)}><Ink style={styles.expandText}>{expanded ? '收起全文' : '展开全文'}</Ink></Pressable>}
          </View>
          {!!notice && <Message>{notice}</Message>}
          <View style={p.card}>
            <Segments options={tabs} value={tab} onChange={setTab} />
            <View style={styles.annotation}>
              <Ink style={styles.annotationHeading}>{tab}</Ink>
              {tab === '注释' ? (
                toAnnoLines(explanation).length > 0 ? (
                  toAnnoLines(explanation).map((line, index) => (
                    <View key={index} style={styles.annoLine}>
                      <Ink style={styles.annotationText}>{line}</Ink>
                    </View>
                  ))
                ) : (
                  <Ink style={styles.annotationText}>{generating ? '正在整理赏读内容…' : `暂未收录${tab}`}</Ink>
                )
              ) : (
                <Ink style={styles.annotationText}>{explanation?.replace(/\s*([①②③④⑤⑥⑦⑧⑨⑩])/g, '\n$1').trim() || (generating ? '正在整理赏读内容…' : `暂未收录${tab}`)}</Ink>
              )}
            </View>
          </View>
        </>}
      </ScrollView>
      {poem && <ReadingAudio key={poem.id} poem={poem} autoplay={play === true || play === 'true'} onMenu={() => setPanel('menu')} />}
      {poem && panel === 'menu' && <PaperDialog title="阅读设置" onClose={() => setPanel(undefined)}>
        <DialogRow onPress={() => setPreferences({ pinyin: !preferences.pinyin })}>{preferences.pinyin ? '隐藏拼音' : '显示拼音'}</DialogRow>
        <DialogRow onPress={() => setPreferences({ traditional: !preferences.traditional })}>{preferences.traditional ? '使用简体' : '使用繁體'}</DialogRow>
        <DialogRow onPress={() => {
          setNoteDraft(shelf.notes.find((item) => item.poem.id === poem.id)?.text ?? '');
          setPanel('note');
        }}>编辑读诗笔记</DialogRow>
        {poem.work_id && <DialogRow onPress={() => { setPanel(undefined); router.push('/work-detail', { id: poem.work_id }); }}>查看所属文集</DialogRow>}
      </PaperDialog>}
      {poem && panel === 'note' && <PaperDialog title="读诗笔记" onClose={() => setPanel(undefined)}>
        <TextInput multiline placeholder="记下一点读诗心得…" placeholderTextColor={theme.muted} style={styles.note} value={note} maxLength={3000} onChangeText={setNoteDraft} />
        <DialogRow onPress={() => { setNote(poem, note); setNotice(note.trim() ? '笔记已保存' : '笔记已清除'); setPanel(undefined); }}>保存笔记</DialogRow>
      </PaperDialog>}
    </Paper>
  );
}

function Verse({ content, pinyin, size }: { content: string; pinyin?: PinyinChar[][] | null; size: number }) {
  const { width } = useWindowDimensions();
  const lines = content.split('\n');
  // 估算单行可容纳字数：每字符占 1 个字宽 + letterSpacing，两边留余量
  const capacity = Math.max(4, Math.floor((width - 48) / (size + 4)));

  // 把超长行切成若干段，每段独立渲染（避免被 flexWrap 掰弯后标点孤行）
  // 优先在句内标点（逗/顿/分/句号等）处断，保证每个子句完整不拆断；
  // 找不到合适标点的超长纯句才退回到按容量切，但仍避免行首落结尾标点。
  const toChunks = (line: string): string[] => {
    const arr = Array.from(line);
    if (arr.length <= capacity) return [line];

    // 句子级断点：这些标点之后是自然的换行处（句号、逗号、分号、顿号、冒号、叹问、省略）
    const SENT_BREAK = /[。？！；、，：…]/;
    // 行首不应出现这些结尾标点
    const LEAD_END_PUNCT = /^[，。、；：？！）」』…·]/;

    const out: string[] = [];
    let i = 0;
    const push = (end: number) => { out.push(arr.slice(i, end).join('')); i = end; };

    while (i < arr.length) {
      const endMax = Math.min(i + capacity, arr.length);
      if (i + capacity >= arr.length) { push(arr.length); break; }

      // 在 [i, endMax] 内找"最后一个"句内标点之后的断点（即标点所在索引+1）
      let breakAt = -1;
      for (let k = i; k < endMax; k++) {
        if (SENT_BREAK.test(arr[k]) && k + 1 <= endMax) {
          // 允许标点连同其后紧跟的结尾类连标点一起走，但断点不超过 capacity
          let nk = k + 1;
          while (nk < arr.length && LEAD_END_PUNCT.test(arr[nk])) nk += 1;
          if (nk <= endMax) breakAt = nk;
        }
      }
      if (breakAt > i) { push(breakAt); continue; }

      // 没有合适的标点断点（超长纯句）：按容量切，避免行首落结尾标点
      let end = endMax;
      if (i > 0 && LEAD_END_PUNCT.test(arr[i])) {
        if (out.length) { out[out.length - 1] += arr[i]; i += 1; continue; }
      }
      while (end < arr.length && LEAD_END_PUNCT.test(arr[end])) end += 1;
      push(end);
    }
    return out;
  };

  return <View style={styles.verse}>
    {lines.flatMap((line, i) => {
      const chunks = toChunks(line);
      let offset = 0;
      return chunks.map((chunk, k) => {
        const el = pinyin?.[i]
          ? <View key={`${i}-${k}`} style={styles.pyLine}>{Array.from(chunk).map((char, j) => (
              <View key={j} style={styles.pyCell}>
                <Ink style={styles.py}>{pinyin[i][offset + j]?.p ?? ''}</Ink>
                <Ink style={{ fontSize: size }}>{char}</Ink>
              </View>
            ))}</View>
          : <Ink key={`${i}-${k}`} style={[styles.line, { fontSize: size, lineHeight: Math.round(size * 1.66) }]}>{chunk || ' '}</Ink>;
        offset += Array.from(chunk).length;
        return el;
      });
    })}
  </View>;
}

const styles = StyleSheet.create({
  loading: { marginTop: 32 },
  hero: { alignItems: 'center', paddingTop: 50, paddingBottom: 23, paddingHorizontal: 14 },
  title: { fontSize: 35, letterSpacing: 2.2, textAlign: 'center' },
  byline: { marginTop: 8, color: theme.inkSoft, letterSpacing: 1.2, fontSize: 16, minHeight: 25 },
  verse: { marginTop: 22, width: '100%', alignItems: 'center' },
  expand: { marginTop: 7, minHeight: 37, paddingHorizontal: 9, justifyContent: 'center' },
  expandText: { color: theme.primaryDeep, fontSize: 14 },
  line: { textAlign: 'center', letterSpacing: 4 },
  pyLine: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', marginBottom: 7 },
  pyCell: { alignItems: 'center', paddingHorizontal: 3 },
  py: { fontSize: 11, color: theme.primaryDeep, minHeight: 15 },
  annotation: { padding: 15, paddingTop: 12 },
  annotationHeading: { fontSize: 20, marginBottom: 5 },
  annoLine: { marginBottom: 3 },
  annotationText: { fontSize: 17, lineHeight: 26 },
  note: { minHeight: 120, textAlignVertical: 'top', borderColor: theme.line, borderWidth: 1, borderRadius: 10, padding: 10, color: theme.ink, marginBottom: 12, fontSize: 16 },
});
