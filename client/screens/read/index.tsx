import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { GenreTag, IconButton, Ink, Message, PageHeader, Paper, paperStyles as p } from '@/components/Paper';
import { DialogRow, PaperDialog } from '@/components/PaperDialog';
import { AnalysisSection, ReadingAnalysis, type ReadingAnalysisTab } from '@/components/ReadingAnalysis';
import { ReadingAudio } from '@/components/ReadingAudio';
import { ReadingBody } from '@/components/ReadingBody';
import { recordRead, setNote, setPreferences, toggleFavorite, useReadingShelf } from '@/contexts/ReadingShelf';
import { useResource } from '@/hooks/useResource';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { Api, hasBackend, type PoemDetail } from '@/utils/api';
import { localCreationBackground } from '@/data/localContent';
import { isDramaTitle } from '@/utils/drama';
import { getDeviceId } from '@/utils/device';
import { shareText } from '@/utils/share';
import { prepareReading } from '@/utils/readingLayout';
import { annotationMatcher, parseInlineAnnotations, type InlineAnnotation } from '@/utils/inlineAnnotations';
import { theme } from '@/theme';

const fields = { 注释: 'annotation', 译文: 'translation', 赏析: 'appreciation', 创作背景: 'creation_background' } as const;
type Analysis = Pick<PoemDetail, 'annotation' | 'translation' | 'appreciation'>;

function readingByline(poem: PoemDetail) {
  return [poem.dynasty, poem.author_name || '佚名'].filter(Boolean).join(' · ');
}

export default function ReadScreen() {
  const { id } = useSafeSearchParams<{ id?: string }>();
  return <PoemReadScreen key={id} />;
}

function PoemReadScreen() {
  const router = useSafeRouter();
  const { id, play } = useSafeSearchParams<{ id?: string; play?: boolean | string }>();
  const [tab, setTab] = useState<ReadingAnalysisTab>('注释');
  const [panel, setPanel] = useState<'menu' | 'note' | 'directory'>();
  const [wordNote, setWordNote] = useState<InlineAnnotation>();
  const [note, setNoteDraft] = useState('');
  const [notice, setNotice] = useState('');
  const scroll = useRef<ScrollView>(null);
  const positions = useRef<Record<number, number>>({});
  const analysisOffset = useRef(0);
  const [generatingAnalysis, setGeneratingAnalysis] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
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

  const generateAnalysis = async () => {
    if (!id || generatingAnalysis) return;
    setGeneratingAnalysis(true);
    setAnalysisError('');
    try {
      const result = await Api.post<Analysis>('/api/v1/ai/analysis', { poem_id: id });
      setAnalysis({ id, result });
    } catch (reason) {
      setAnalysisError(reason instanceof Error ? reason.message : '生成失败，请重试');
    } finally { setGeneratingAnalysis(false); }
  };

  useEffect(() => {
    if (poem && isDramaTitle(poem.title)) router.replace('/drama', { id: poem.id });
  }, [poem, router]);

  const field = fields[tab];
  const generated = field !== 'creation_background' && analysis?.id === id ? analysis?.result[field] : undefined;
  const explanation = poem?.[field] || generated || (poem && tab === '创作背景' ? localCreationBackground(poem) : undefined);
  const backgroundSource = tab === '创作背景' ? poem?.background_source : undefined;
  const layout = useMemo(() => poem ? prepareReading(poem, preferences.traditional) : undefined, [poem, preferences.traditional]);
  const annotation = poem?.annotation || (analysis?.id === id ? analysis?.result.annotation : undefined);
  const matchAnnotations = useMemo(() => annotationMatcher(parseInlineAnnotations(annotation), poem?.annotation_notes), [annotation, poem?.annotation_notes]);
  const referenceLayout = useMemo(() => poem && preferences.traditional && poem.content_traditional && matchAnnotations
    ? prepareReading(poem, false) : undefined, [poem, preferences.traditional, matchAnnotations]);
  const hasPinyin = layout?.blocks.some((block) => block.sourceLine !== undefined && !!poem?.pinyin?.[block.sourceLine]?.length);
  const jumpTo = (y: number | undefined) => {
    setPanel(undefined);
    if (y !== undefined) scroll.current?.scrollTo({ y: Math.max(0, y - 8), animated: false });
  };
  const generating = generatingAnalysis && field !== 'creation_background';

  return (
    <Paper scene={layout?.centered || layout?.compactCi ? 'read' : undefined} warm={preferences.paper === '暖笺'}>
      <PageHeader back>
        {poem && <>
          {!!layout?.anchors.length && <IconButton icon="list-outline" label="正文目录" onPress={() => setPanel('directory')} />}
          <IconButton icon="share-outline" label="分享诗文" onPress={async () => {
            try { setNotice(await shareText(poem.title, `${poem.title}\n${readingByline(poem)}\n\n${poem.content}`) ?? ''); }
            catch (reason) { if ((reason as Error).name !== 'AbortError') setNotice('当前无法分享'); }
          }} />
          <IconButton icon={favorite ? 'heart' : 'heart-outline'} label={favorite ? '取消收藏诗文' : '收藏诗文'} color={favorite ? theme.cinnabar : theme.ink} onPress={() => toggleFavorite({ kind: '诗文', item: poem })} />
        </>}
      </PageHeader>
      <View style={styles.scrollArea}>
        <ScrollView ref={scroll} style={p.scroll} contentContainerStyle={p.content} showsVerticalScrollIndicator={false}>
          {loading && <ActivityIndicator color={theme.primary} style={styles.loading} />}
          {error && <Message retry={retry}>{error}</Message>}
          {poem && layout && <>
            <View style={[styles.hero, layout.centered && styles.centeredHero, layout.compactCi && styles.ciHero]}>
              <View style={styles.titleRow}>
                <Ink accessibilityRole="header" style={styles.title}>{poem.title}</Ink>
                <GenreTag label={layout.label} />
              </View>
              <Pressable accessibilityRole="button" disabled={!poem.author_id} onPress={() => router.push('/poet-detail', { id: poem.author_id })}>
                <Ink style={styles.byline}>{readingByline(poem)}</Ink>
              </Pressable>
            </View>
            <ReadingBody layout={layout} size={preferences.fontSize} pinyin={preferences.pinyin ? poem.pinyin : undefined}
              matchAnnotations={matchAnnotations} referenceLayout={referenceLayout} onAnnotation={setWordNote}
              onAnchor={(index, y) => { positions.current[index] = y; }} />
            {!!notice && <Message>{notice}</Message>}
            <View onLayout={({ nativeEvent: { layout: { y } } }) => { analysisOffset.current = y; }}>
              <ReadingAnalysis tab={tab} onChange={setTab}>
                <AnalysisSection muted={!explanation}>{explanation?.replace(/\s*([①②③④⑤⑥⑦⑧⑨⑩])/g, '\n$1').trim() || (generating ? '正在整理赏读内容…' : `暂未收录${tab}`)}</AnalysisSection>
                {needsAnalysis && !explanation && field !== 'creation_background' && (
                  <Pressable accessibilityRole="button" disabled={generatingAnalysis} onPress={generateAnalysis}>
                    <Ink style={p.meta}>{generatingAnalysis ? '正在生成…' : '生成赏读内容'}</Ink>
                  </Pressable>
                )}
                {!!analysisError && <Ink style={p.meta}>{analysisError}</Ink>}
                {backgroundSource && (
                  <Pressable accessibilityRole="link" onPress={() => { void Linking.openURL(backgroundSource.url).catch(() => undefined); }}>
                    <Ink style={p.meta}>资料来源 · {backgroundSource.title}</Ink>
                  </Pressable>
                )}
              </ReadingAnalysis>
            </View>
          </>}
        </ScrollView>
      </View>
      {poem && <ReadingAudio key={poem.id} poem={poem} autoplay={play === true || play === 'true'} onMenu={() => setPanel('menu')} />}
      {wordNote && <PaperDialog title={wordNote.word} onClose={() => setWordNote(undefined)}>
        <AnalysisSection>{wordNote.explanation}</AnalysisSection>
      </PaperDialog>}
      {layout && panel === 'directory' && <PaperDialog title="正文目录" onClose={() => setPanel(undefined)}>
        {layout.anchors.map(({ index, label }) => <DialogRow key={index} onPress={() => jumpTo(positions.current[index])}>{label}</DialogRow>)}
        <DialogRow onPress={() => jumpTo(analysisOffset.current)}>查看赏读</DialogRow>
      </PaperDialog>}
      {poem && panel === 'menu' && <PaperDialog title="阅读设置" onClose={() => setPanel(undefined)}>
        {hasPinyin && <DialogRow onPress={() => setPreferences({ pinyin: !preferences.pinyin })}>{preferences.pinyin ? '隐藏拼音' : '显示拼音'}</DialogRow>}
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

const styles = StyleSheet.create({
  loading: { marginTop: 32 },
  scrollArea: { flex: 1, minHeight: 0 },
  hero: { alignItems: 'center', paddingTop: 21, paddingBottom: 25, paddingHorizontal: 6 },
  centeredHero: { paddingTop: 50, paddingBottom: 25, paddingHorizontal: 14 },
  ciHero: { paddingTop: 31, paddingBottom: 26 },
  titleRow: { maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 7 },
  title: { flexShrink: 1, fontSize: 35, letterSpacing: 2.2, textAlign: 'center' },
  byline: { marginTop: 8, color: theme.inkSoft, letterSpacing: 1.2, fontSize: 16, minHeight: 25 },
  note: { minHeight: 120, textAlignVertical: 'top', borderColor: theme.line, borderWidth: 1, borderRadius: 10, padding: 10, color: theme.ink, marginBottom: 12, fontSize: 16 },
});
