import { useCallback } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IconButton, Ink, Message, PageHeader, Paper, paperStyles as p } from '@/components/Paper';
import { recordRead, toggleFavorite, useReadingShelf } from '@/contexts/ReadingShelf';
import { useResource } from '@/hooks/useResource';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { Api, hasBackend } from '@/utils/api';
import { getDeviceId } from '@/utils/device';
import { theme } from '@/theme';

export interface DramaAct {
  id: string;
  title: string;
  dynasty: string;
  genre: string;
  content: string;
  content_traditional?: string | null;
  annotation?: string | null;
  translation?: string | null;
  appreciation?: string | null;
  creation_background?: string | null;
  annotation_notes?: import('@/utils/inlineAnnotations').AnchoredAnnotation[] | null;
  cover_emoji?: string | null;
  background_hint?: string | null;
  author_id?: string | null;
  author_name?: string | null;
  author_emoji?: string | null;
  work_id?: string | null;
  work_name?: string | null;
}

export interface DramaDetail {
  base_title: string;
  genre: string;
  dynasty: string;
  author: { name: string; dynasty?: string; avatar_emoji?: string | null } | null;
  work: { name?: string; description?: string | null } | null;
  acts: DramaAct[];
}

/** 取文本第一句（遇到句号/问号/叹号为止），用于剧情摘要 */
function firstSentence(text: string | null | undefined): string {
  const plain = (text || '').replace(/\s+/gu, ' ').trim();
  if (!plain) return '';
  const match = plain.match(/^[^。！？!?]*[。！？!?]/u);
  return (match ? match[0] : plain).replace(/\s+/gu, ''); 
}

/** 内容梗概：将各折剧情首句连成一段真实剧情叙述 */
export function buildIntro(acts: DramaAct[]): string {
  const lines = acts
    .map((a) => firstSentence(a.translation || a.annotation))
    .filter(Boolean);
  const text = `${lines.join('')}`;
  return text.slice(0, 90) + (text.length > 90 ? '……' : '');
}

/** 两行大标题拆分：对较长的杂剧名，"前段剧名＋后段"分两行（如㑳梅香 / 騙翰林風月） */
export function splitTitle(title: string): string[] {
  if (title.length >= 6) return [title.slice(0, 3), title.slice(3)];
  return [title];
}

export default function DramaScreen() {
  const router = useSafeRouter();
  const { id } = useSafeSearchParams<{ id?: string }>();
  const shelf = useReadingShelf();
  const load = useCallback(
    () => id ? Api.get<DramaDetail>(`/api/v1/dramas/by-poem/${encodeURIComponent(id)}`) : Promise.reject(new Error('缺少作品信息')),
    [id],
  );
  const { data, error, loading, retry } = useResource(load);

  const first = data?.acts[0];
  const favorite = !!data && shelf.data.favorites.some((item) => item.kind === '诗文' && data.acts.some((act) => act.id === item.item.id));
  const titleLines = data ? splitTitle(data.base_title) : [];

  const record = (act: DramaAct) => {
    recordRead(asSummary(act));
    if (hasBackend) void getDeviceId().then((deviceId) => Api.post('/api/v1/history', { device_id: deviceId, poem_id: act.id, action: 'read' })).catch(() => undefined);
  };

  const openAct = (actId: string) => router.push('/drama-act', { id: actId });
  const startReading = () => {
    if (!first) return;
    record(first);
    openAct(first.id);
  };
  const toggleCollection = () => {
    if (!data || !first) return;
    toggleFavorite({ kind: '诗文', item: asSummary(first ?? data.acts[0]) });
  };

  return (
    <Paper scene="blossom" warm={shelf.data.preferences.paper === '暖笺'}>
      <PageHeader title="作品" centered back fallback="/library">
        <IconButton icon={favorite ? 'heart' : 'heart-outline'} label={favorite ? '取消收藏作品' : '收藏作品'}
          color={favorite ? theme.cinnabar : theme.ink} onPress={toggleCollection} />
      </PageHeader>
      <ScrollView style={p.scroll} contentContainerStyle={[p.content, styles.content]} showsVerticalScrollIndicator={false}>
        {loading && <ActivityIndicator color={theme.primary} style={styles.loading} />}
        {error && <Message retry={retry}>{error}</Message>}
        {data && <>
          <View style={styles.hero}>
            {titleLines.map((line, idx) => (
              <Ink key={idx} accessibilityRole="header" style={styles.title}>{line}</Ink>
            ))}
            <Ink style={styles.byline}>{data.dynasty} · {data.author?.name ?? (data.acts[0]?.author_name ?? '佚名')}</Ink>
            <Ink style={styles.intro}>{buildIntro(data.acts)}</Ink>
            <Pressable accessibilityRole="button" disabled={!first} onPress={startReading}
              style={({ pressed }) => [styles.start, pressed && styles.pressed]}>
              <Ionicons name="book-outline" size={17} color={theme.surface} />
              <Ink style={styles.startText}>{first ? `从${actLabel(first.title)}开始` : '开始阅读'}</Ink>
            </Pressable>
          </View>

          <View style={styles.directoryHeading}>
            <Ink accessibilityRole="header" style={p.section}>作品目录</Ink>
            <Ink style={styles.count}>{`${data.acts.length} 折`}</Ink>
          </View>
          <View style={[p.card, styles.directory]}>
            {data.acts.map((act) => (
              <Pressable key={act.id} accessibilityRole="button" accessibilityLabel={`阅读${act.title}`}
                onPress={() => { record(act); openAct(act.id); }} style={({ pressed }) => [p.row, p.divider, styles.row, pressed && styles.pressed]}>
                <Ink style={styles.actTitle}>{actLabel(act.title)}</Ink>
                <Ink style={[p.flex, styles.summary]} numberOfLines={1}>{summaryFor(act)}</Ink>
                <Ionicons name="chevron-forward-outline" size={16} color={theme.primary} />
              </Pressable>
            ))}
          </View>

          <View style={styles.sourceBox}>
            <Ionicons name="link-outline" size={14} color={theme.muted} />
            <Ink style={styles.sourceText}>文本出自观文文库 · {data.work?.name ?? '元杂剧'}选集</Ink>
          </View>
        </>}
      </ScrollView>
    </Paper>
  );
}

/** 提取折名：形如 "㑳梅香騙翰林風月・楔子" → "楔子"；"第一折" → "第一折" */
export function actLabel(title: string): string {
  const m = title.match(/・(楔子|第[一二三四五六七八九十百\d]+折)$/u);
  return m ? m[1] : title;
}

/** 把某折转换成可入书架的诗文摘要。收藏以作品为基础标题、以楔子为正文。 */
export function asSummary(act: DramaAct) {
  return {
    id: act.id,
    title: act.title,
    dynasty: act.dynasty || '',
    genre: act.genre || '曲',
    content: act.content,
    cover_emoji: act.cover_emoji,
    background_hint: act.background_hint,
    author_id: act.author_id,
    author_name: act.author_name,
    work_id: act.work_id,
    work_name: act.work_name,
  };
}

/** 生成目录行副标题：优先取本折翻译首句（真实剧情梗概）。 */
export function summaryFor(act: DramaAct): string {
  const first = firstSentence(act.translation || act.annotation);
  if (first) return first.slice(0, 24) + (first.length > 24 ? '…' : '');
  const plain = act.content.replace(/\s+/gu, '').trim();
  return plain ? `${plain.slice(0, 24)}…` : '';
}

const styles = StyleSheet.create({
  loading: { marginTop: 40 },
  content: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 23 },
  hero: { alignItems: 'center', paddingTop: 26, paddingBottom: 24 },
  title: { fontSize: 40, lineHeight: 50, textAlign: 'center', letterSpacing: 5, fontWeight: '700', color: theme.ink },
  byline: { fontSize: 16, color: theme.inkSoft, letterSpacing: 1.2, marginTop: 8 },
  intro: { marginTop: 18, marginHorizontal: 4, fontSize: 15, lineHeight: 24, color: theme.inkSoft, letterSpacing: 0.6, textAlign: 'center' },
  start: { marginTop: 18, backgroundColor: '#6b6f45', paddingHorizontal: 24, minHeight: 47, borderRadius: 24, flexDirection: 'row', alignItems: 'center', gap: 9 },
  startText: { color: theme.surface, fontSize: 17 },
  directoryHeading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 3 },
  count: { color: theme.muted, fontSize: 14 },
  directory: { borderColor: theme.line, borderWidth: StyleSheet.hairlineWidth },
  row: { minHeight: 54, paddingVertical: 10, paddingHorizontal: 13 },
  actTitle: { fontSize: 18, width: 74, color: theme.primaryDeep, fontWeight: '600' },
  summary: { fontSize: 14, color: theme.inkSoft },
  sourceBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 18 },
  sourceText: { fontSize: 13, color: theme.muted, letterSpacing: 0.4 },
  pressed: { opacity: 0.64 },
});