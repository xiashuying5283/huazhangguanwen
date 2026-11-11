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
  const favorite = !!data && shelf.data.favorites.some((item) => item.kind === '诗文' && item.item.id === data.base_title);

  const openAct = (actId: string) => router.push('/drama-act', { id: actId });
  const startReading = () => {
    if (!first) return;
    recordRead(asSummary(first));     // 记录回到书架的最近阅读
    if (hasBackend) void getDeviceId().then((deviceId) => Api.post('/api/v1/history', { device_id: deviceId, poem_id: first.id, action: 'read' })).catch(() => undefined);
    openAct(first.id);
  };
  const toggleCollection = () => {
    if (!data) return;
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
            <Ink accessibilityRole="header" style={styles.title}>{data.base_title}</Ink>
            <Ink style={styles.byline}>元杂剧 · {data.author?.name ?? (data.acts[0]?.author_name ?? '佚名')}</Ink>
            <Pressable accessibilityRole="button" disabled={!first} onPress={startReading}
              style={({ pressed }) => [styles.start, pressed && styles.pressed]}>
              <Ionicons name="book-outline" size={17} color={theme.surface} />
              <Ink style={styles.startText}>{first ? `从${first.title.replace(/^.?/u, '')}开始` : '开始阅读'}</Ink>
            </Pressable>
          </View>
          <View style={styles.directoryHeading}>
            <Ink accessibilityRole="header" style={p.section}>作品目录</Ink>
            <Ink style={styles.count}>楔子与四折</Ink>
          </View>
          <View style={[p.card, styles.directory]}>
            {data.acts.map((act) => (
              <Pressable key={act.id} accessibilityRole="button" accessibilityLabel={`阅读${act.title}`}
                onPress={() => { recordRead(asSummary(act)); openAct(act.id); }} style={({ pressed }) => [
                  p.row, p.divider, styles.row, pressed && styles.pressed,
                ]}>
                <Ink style={styles.actTitle}>{act.title.replace(/^.*?・/u, '')}</Ink>
                <Ink style={[p.flex, styles.summary]} numberOfLines={1}>{summaryFor(act)}</Ink>
                <Ionicons name="chevron-forward-outline" size={16} color={theme.primary} />
              </Pressable>
            ))}
          </View>
        </>}
      </ScrollView>
    </Paper>
  );
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

/** 生成目录行副标题：优先取本折翻译开头一句话。 */
export function summaryFor(act: DramaAct): string {
  const text = act.translation || act.annotation || '';
  const plain = text.replace(/\s+/gu, ' ').trim();
  return plain ? plain.slice(0, 22) + (plain.length > 22 ? '…' : '') : act.content.slice(0, 22) + '…';
}

const styles = StyleSheet.create({
  loading: { marginTop: 40 },
  content: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 23 },
  hero: { alignItems: 'center', paddingTop: 24, paddingBottom: 24 },
  title: { fontSize: 34, lineHeight: 44, textAlign: 'center', letterSpacing: 3, color: theme.ink },
  byline: { fontSize: 16, color: theme.inkSoft, letterSpacing: 1.2, marginTop: 12 },
  start: { marginTop: 18, backgroundColor: theme.primary, paddingHorizontal: 24, minHeight: 47, borderRadius: 24, flexDirection: 'row', alignItems: 'center', gap: 9 },
  startText: { color: theme.surface, fontSize: 17 },
  directoryHeading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 3 },
  count: { color: theme.muted, fontSize: 14 },
  directory: { borderColor: theme.line, borderWidth: StyleSheet.hairlineWidth },
  row: { minHeight: 54, paddingVertical: 10, paddingHorizontal: 13 },
  actTitle: { fontSize: 18, width: 74, color: theme.ink },
  summary: { fontSize: 14, color: theme.inkSoft },
  pressed: { opacity: 0.64 },
});