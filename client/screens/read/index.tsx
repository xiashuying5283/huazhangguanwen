import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
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
              <Ink style={styles.annotationText}>{explanation?.replace(/\s*([①②③④⑤⑥⑦⑧⑨⑩])/g, '\n$1').trim() || (generating ? '正在整理赏读内容…' : `暂未收录${tab}`)}</Ink>
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
  const lines = content.split('\n');
  return <View style={styles.verse}>
    {lines.map((line, i) => pinyin?.[i]
      ? <View key={i} style={styles.pyLine}>{Array.from(line).map((char, j) => (
        <View key={j} style={styles.pyCell}>
          <Ink style={styles.py}>{pinyin[i][j]?.p ?? ''}</Ink>
          <Ink style={{ fontSize: size }}>{char}</Ink>
        </View>
      ))}</View>
      : <Ink key={i} style={[styles.line, { fontSize: size, lineHeight: Math.round(size * 1.66) }]}>{line || ' '}</Ink>
    )}
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
  annotationText: { fontSize: 17, lineHeight: 26 },
  note: { minHeight: 120, textAlignVertical: 'top', borderColor: theme.line, borderWidth: 1, borderRadius: 10, padding: 10, color: theme.ink, marginBottom: 12, fontSize: 16 },
});
