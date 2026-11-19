import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Ink, Message, PageHeader, Paper, paperStyles as p } from '@/components/Paper';
import { DialogRow, PaperDialog } from '@/components/PaperDialog';
import { recordRead, setPreferences, useReadingShelf } from '@/contexts/ReadingShelf';
import { useResource } from '@/hooks/useResource';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { Api, hasBackend, type PoemDetail } from '@/utils/api';
import { getDeviceId } from '@/utils/device';
import { asSummary, summaryFor, type DramaDetail } from '@/screens/drama';
import { ReadingBody } from '@/components/ReadingBody';
import { ReadingAnalysis, AnalysisSection } from '@/components/ReadingAnalysis';
import { prepareReading } from '@/utils/readingLayout';
import { annotationMatcher, parseInlineAnnotations, type InlineAnnotation } from '@/utils/inlineAnnotations';
import { theme } from '@/theme';

const tabs = ['注释', '译文', '赏析', '创作背景'] as const;
type Tab = (typeof tabs)[number];

export default function DramaActScreen() {
  const router = useSafeRouter();
  const { id } = useSafeSearchParams<{ id?: string }>();
  const [tab, setTab] = useState<Tab>('注释');
  const shelf = useReadingShelf();
  const { traditional, fontSize } = shelf.data.preferences;
  const [scene, setScene] = useState<'directory' | 'settings'>();
  const [wordNote, setWordNote] = useState<InlineAnnotation>();

  const loadAct = useCallback(() => id ? Api.get<PoemDetail>(`/api/v1/poems/${encodeURIComponent(id)}`) : Promise.reject(new Error('缺少折信息')), [id]);
  const { data: act, error, loading, retry } = useResource(loadAct);

  // 聚合整部戏，以支持上一折/下一折/目录
  const loadDrama = useCallback(() => id ? Api.get<DramaDetail>(`/api/v1/dramas/by-poem/${encodeURIComponent(id)}`) : Promise.reject(new Error('缺少折信息')), [id]);
  const drama = useResource(loadDrama);

  const index = drama.data ? Math.max(0, drama.data.acts.findIndex((a) => a.id === id)) : 0;
  const prev = drama.data && index > 0 ? drama.data.acts[index - 1] : undefined;
  const next = drama.data ? drama.data.acts[index + 1] : undefined;
  const alone = drama.data?.acts.length === 1;

  useEffect(() => {
    if (!act) return;
    recordRead(asSummary({ ...act, genre: act.genre || '曲', dynasty: act.dynasty || '' }));
    if (hasBackend && act.work_id) void getDeviceId().then((deviceId) => Api.post('/api/v1/history', { device_id: deviceId, poem_id: act.id, action: 'read' })).catch(() => undefined);
  }, [act]);

  const layout = useMemo(() => act ? prepareReading(act, traditional) : undefined,[act,traditional]);
  const reference = useMemo(() => act && traditional ? prepareReading(act,false) : undefined,[act,traditional]);
  const matchAnnotations = useMemo(() => annotationMatcher(parseInlineAnnotations(act?.annotation),act?.annotation_notes),[act]);

  const goAct = (actId: string) => {
    setScene(undefined);
    setTab('注释');
    router.replace('/drama-act', { id: actId });
  };

  return (
    <Paper scene="read" warm={shelf.data.preferences.paper === '暖笺'}>
      <PageHeader title={act?.title ?? '折'} centered back>
        <Pressable accessibilityRole="button" accessibilityLabel="阅读设置" onPress={() => setScene('settings')} style={styles.settings}>
          <Ionicons name="text-outline" size={21} color={theme.ink} />
        </Pressable>
      </PageHeader>
      <ScrollView style={p.scroll} contentContainerStyle={[p.content, styles.content]} showsVerticalScrollIndicator={false}>
        {loading && <ActivityIndicator color={theme.primary} style={styles.loading} />}
        {error && <Message retry={retry}>{error}</Message>}
        {act && <>
          <View style={styles.chapterLead}>
            <Ink style={styles.workTitle}>{drama.data?.base_title ?? act.title}</Ink>
            <Ink style={styles.chapterSummary}>{drama.data?.author?.name ?? ''}</Ink>
          </View>
          <View style={styles.readArea}>
            {layout && <ReadingBody layout={layout} size={fontSize} referenceLayout={reference} matchAnnotations={matchAnnotations} onAnnotation={setWordNote} onAnchor={() => undefined} />}
          </View>
          <View style={styles.end}>
            <Ink style={styles.endLabel}>{act.title}完</Ink>
            <ReadingAnalysis tab={tab} onChange={setTab}>
              <AnalysisSection>{(tab === '注释' ? act.annotation : tab === '译文' ? act.translation : tab === '赏析' ? act.appreciation : act.creation_background)?.trim() || `暂未收录${tab}`}</AnalysisSection>
            </ReadingAnalysis>
          </View>
        </>}
      </ScrollView>
      <View style={styles.footer}>
        <FooterButton title="上一折" icon="chevron-back-outline" disabled={!prev} onPress={() => prev && goAct(prev.id)} />
        <FooterButton title="目录" icon="list-outline" onPress={() => setScene('directory')} />
        <FooterButton title="下一折" icon="chevron-forward-outline" disabled={!next || alone} onPress={() => next && goAct(next.id)} />
      </View>
      {wordNote && <PaperDialog title={wordNote.word} onClose={() => setWordNote(undefined)}><AnalysisSection>{wordNote.explanation}</AnalysisSection></PaperDialog>}
      {scene === 'directory' && drama.data && (
        <PaperDialog title="作品目录" onClose={() => setScene(undefined)}>
          {drama.data.acts.map((item) => (
            <DialogRow key={item.id} onPress={() => item.id === act?.id ? setScene(undefined) : goAct(item.id)}>
              {item.title.replace(/^.*?・/u, '')}{'\u3000'}{item.id === act?.id ? '正在阅读' : summaryFor(item)}
            </DialogRow>
          ))}
          <DialogRow onPress={() => { setScene(undefined); router.back(); }}>返回</DialogRow>
        </PaperDialog>
      )}
      {scene === 'settings' && (
        <PaperDialog title="阅读设置" onClose={() => setScene(undefined)}>
          <DialogRow onPress={() => setPreferences({ traditional: !traditional })}>{traditional ? '使用简体' : '使用繁體'}</DialogRow>
          <DialogRow onPress={() => setPreferences({ fontSize: Math.max(17, fontSize - 2) })}>缩小字号</DialogRow>
          <DialogRow onPress={() => setPreferences({ fontSize: Math.min(33, fontSize + 2) })}>放大字号</DialogRow>
        </PaperDialog>
      )}
    </Paper>
  );
}

function FooterButton({ title, icon, disabled, onPress }: {
  title: string; icon: 'chevron-back-outline' | 'chevron-forward-outline' | 'list-outline'; disabled?: boolean; onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
      style={({ pressed }) => [styles.footerButton, disabled && styles.disabled, pressed && styles.pressed]}>
      {icon !== 'chevron-forward-outline' && <Ionicons name={icon} size={17} color={theme.primaryDeep} />}
      <Ink style={styles.footerText}>{title}</Ink>
      {icon === 'chevron-forward-outline' && <Ionicons name={icon} size={17} color={theme.primaryDeep} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  loading: { marginTop: 32 },
  settings: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  content: { width: '100%', maxWidth: 610, alignSelf: 'center', paddingHorizontal: 23, paddingBottom: 26 },
  chapterLead: { alignItems: 'center', paddingTop: 22, paddingBottom: 22, gap: 5 },
  workTitle: { fontSize: 19, letterSpacing: 1.6, color: theme.ink },
  chapterSummary: { fontSize: 14, color: theme.muted },
  readArea: { gap: 13, paddingBottom: 8 },
  stage: { fontSize: 15, lineHeight: 23, color: theme.muted },
  verse: { borderLeftColor: '#a4a78b', borderLeftWidth: 2, paddingHorizontal: 12, paddingVertical: 3, gap: 0 },
  tune: { color: theme.primaryDeep, fontSize: 15, lineHeight: 25, marginBottom: 2 },
  bodyText: { color: theme.ink, textAlign: 'left', marginBottom: 2 },
  end: { marginTop: 12 },
  endLabel: { textAlign: 'center', color: theme.muted, fontSize: 15, paddingVertical: 16 },
  analysis: { paddingHorizontal: 15, paddingTop: 8 },
  segments: { flexDirection: 'row', borderBottomColor: theme.line, borderBottomWidth: StyleSheet.hairlineWidth },
  segment: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  activeSegment: { borderBottomColor: theme.primary, borderBottomWidth: 2 },
  segmentText: { fontSize: 16, color: theme.muted },
  activeText: { color: theme.primary },
  analysisBody: { paddingVertical: 12, paddingHorizontal: 2, gap: 4 },
  analysisText: { fontSize: 17, lineHeight: 27, color: theme.ink },
  footer: { flexDirection: 'row', backgroundColor: theme.bgRoot, borderTopColor: theme.line, borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 11 },
  footerButton: { flex: 1, minHeight: 54, flexDirection: 'row', gap: 4, alignItems: 'center', justifyContent: 'center' },
  footerText: { color: theme.primaryDeep, fontSize: 17 },
  pressed: { opacity: 0.65 },
  disabled: { opacity: 0.36 },
});