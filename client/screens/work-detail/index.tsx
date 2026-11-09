import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { BookCover, IconButton, Ink, Message, PageHeader, Paper, Segments, paperStyles as p } from '@/components/Paper';
import { toggleFavorite, useReadingShelf } from '@/contexts/ReadingShelf';
import { workType } from '@/data/art';
import { loadWorks } from '@/data/works';
import { useResource } from '@/hooks/useResource';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { Api, hasBackend } from '@/utils/api';
import { shareText } from '@/utils/share';
import { theme } from '@/theme';

const tabs = ['简介', '目录', '版本', '相关'] as const;
const PAGE_SIZE = 500;

interface WorkEntry {
  id: string;
  volume: string | null;
  sort_order: number;
  entry_title: string;
  poem_id: string;
  poems?: { id: string; title: string; dynasty?: string; genre?: string };
}

export default function WorkDetailScreen() {
  const router = useSafeRouter();
  const { id } = useSafeSearchParams<{ id?: string }>();
  const [tab, setTab] = useState<(typeof tabs)[number]>('目录');
  const [open, setOpen] = useState<string>();
  const [notice, setNotice] = useState('');
  const shelf = useReadingShelf();
  const catalog = useResource(loadWorks);
  const work = catalog.data?.find((item) => item.id === id);

  // 真实卷次目录：来自 collection_entries（/works/:id/entries）
  const [entries, setEntries] = useState<WorkEntry[]>([]);
  const [entriesTotal, setEntriesTotal] = useState(0);
  const [entriesError, setEntriesError] = useState('');
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [loadMore, setLoadMore] = useState(false); // 是否还有更多
  const [page, setPage] = useState(0);
  const [moreLoading, setMoreLoading] = useState(false);

  // 巨型文集（如全唐诗）：目录按作者分卷分层，先聚合再点开展开拉取
  const isHuge = (work?.poem_count ?? 0) > 3000;
  const [catalogVols, setCatalogVols] = useState<{ volume: string; count: number }[]>([]);
  const [catLoading, setCatLoading] = useState(false);
  const [catError, setCatError] = useState('');
  const [volEntries, setVolEntries] = useState<Record<string, WorkEntry[]>>({});
  const [volLoading, setVolLoading] = useState<string>();
  const [volError, setVolError] = useState('');
  const [volMore, setVolMore] = useState<Record<string, { loaded: number; total: number }>>({});

  const fetchEntries = useCallback(async (targetPage: number, append: boolean) => {
    if (!id) return;
    if (append) setMoreLoading(true); else setEntriesLoading(true);
    setEntriesError('');
    try {
      const d = await Api.get<{ entries: WorkEntry[]; total: number }>(
        `/api/v1/works/${encodeURIComponent(id)}/entries?limit=${PAGE_SIZE}&offset=${targetPage * PAGE_SIZE}`
      );
      setEntries((prev) => (append ? [...prev, ...(d.entries ?? [])] : (d.entries ?? [])));
      setEntriesTotal(d.total ?? 0);
      setLoadMore(((targetPage + 1) * PAGE_SIZE) < (d.total ?? 0));
      setPage(targetPage);
    } catch (reason) {
      setEntriesError(reason instanceof Error ? reason.message : '加载目录失败');
    } finally {
      setEntriesLoading(false);
      setMoreLoading(false);
    }
  }, [id]);

  const fetchCatalog = useCallback(async () => {
    if (!id) return;
    setCatLoading(true);
    setCatError('');
    try {
      const d = await Api.get<{ catalog: { volume: string; count: number }[] }>(
        `/api/v1/works/${encodeURIComponent(id)}/catalog`
      );
      setCatalogVols(d.catalog ?? []);
    } catch (reason) {
      setCatError(reason instanceof Error ? reason.message : '加载目录失败');
    } finally {
      setCatLoading(false);
    }
  }, [id]);

  const openVolume = async (volume: string) => {
    if (!id) return;
    if (open === volume) { setOpen(undefined); return; }
    setOpen(volume);
    if (volEntries[volume]) return;
    setVolLoading(volume);
    setVolError('');
    try {
      const d = await Api.get<{ entries: WorkEntry[]; total?: number }>(
        `/api/v1/works/${encodeURIComponent(id)}/entries?volume=${encodeURIComponent(volume)}&limit=500&offset=0`
      );
      const list = d.entries ?? [];
      setVolEntries((prev) => ({ ...prev, [volume]: list }));
      setVolMore((prev) => ({ ...prev, [volume]: { loaded: list.length, total: d.total ?? list.length } }));
    } catch (reason) {
      setVolError(reason instanceof Error ? reason.message : '加载失败');
    } finally {
      setVolLoading(undefined);
    }
  };

  const loadMoreVolume = async (volume: string) => {
    if (!id) return;
    setVolLoading(volume);
    setVolError('');
    try {
      const cur = volMore[volume];
      const offset = cur ? cur.loaded : (volEntries[volume]?.length ?? 0);
      const d = await Api.get<{ entries: WorkEntry[]; total?: number }>(
        `/api/v1/works/${encodeURIComponent(id)}/entries?volume=${encodeURIComponent(volume)}&limit=500&offset=${offset}`
      );
      const list = d.entries ?? [];
      setVolEntries((prev) => ({ ...prev, [volume]: [...(prev[volume] ?? []), ...list] }));
      setVolMore((prev) => ({ ...prev, [volume]: { loaded: offset + list.length, total: d.total ?? offset + list.length } }));
    } catch (reason) {
      setVolError(reason instanceof Error ? reason.message : '加载失败');
    } finally {
      setVolLoading(undefined);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (tab !== '目录') return;
      if (!work) return;
      if (isHuge) fetchCatalog(); else fetchEntries(0, false);
    }, [tab, work, isHuge, fetchCatalog, fetchEntries])
  );

  // 按卷分组（保持目录顺序）
  const volumeGroups = new Map<string, WorkEntry[]>();
  for (const e of entries) {
    const key = e.volume || '未分卷';
    volumeGroups.set(key, [...(volumeGroups.get(key) ?? []), e]);
  }
  const volumeList = Array.from(volumeGroups.keys());

  const favorite = shelf.data.favorites.some((item) => item.kind === '文集' && item.item.id === id);

  const loadMoreEntries = () => fetchEntries(page + 1, true);

  return (
    <Paper scene="mountain">
      <PageHeader back>
        {work && <>
          <IconButton icon={favorite ? 'heart' : 'heart-outline'} label={favorite ? '取消收藏文集' : '收藏文集'} color={favorite ? theme.cinnabar : theme.ink} onPress={() => toggleFavorite({ kind: '文集', item: work })} />
          <IconButton icon="share-outline" label="分享文集" onPress={async () => {
            try { setNotice(await shareText(work.name, [work.name, work.author_name, work.description].filter(Boolean).join('\n')) ?? ''); }
            catch (reason) { if ((reason as Error).name !== 'AbortError') setNotice('当前无法分享'); }
          }} />
        </>}
      </PageHeader>
      <ScrollView style={p.scroll} contentContainerStyle={p.content} showsVerticalScrollIndicator={false}>
        {catalog.loading && <ActivityIndicator color={theme.primary} />}
        {catalog.error && <Message retry={catalog.retry}>{catalog.error}</Message>}
        {catalog.data && !work && <Message>未找到这本文集</Message>}
        {work && <>
          <View style={[p.row, styles.hero]}>
            <BookCover name={work.name} width={123} height={166} />
            <View style={p.flex}>
              <Ink style={styles.title}>{work.name}</Ink>
              <Ink style={p.meta}>{[work.era, work.author_name].filter(Boolean).join(' · ')}</Ink>
              <View style={styles.tags}>
                {[workType(work.name), ...(work.name === '王维集' ? ['田园', '山水'] : [])].map((tag) => <Ink key={tag} style={styles.tag}>{tag}</Ink>)}
              </View>
            </View>
          </View>
          <Ink style={[p.body, styles.summary]}>{work.description ?? '翻开文集，按篇阅读。'}</Ink>
          {!!notice && <Message>{notice}</Message>}
          <View style={p.card}><Segments options={tabs} value={tab} onChange={setTab} /></View>
          {tab === '目录' && <View style={[p.card, styles.panel]}>
            {isHuge ? (
              <>
                {catLoading && <ActivityIndicator color={theme.primary} />}
                {!catLoading && catError !== '' && <Message retry={fetchCatalog}>{catError}</Message>}
                {!catLoading && catError === '' && catalogVols.length === 0 && <Message>暂未收录篇目</Message>}
                {catalogVols.map((v) => {
                  const expanded = open === v.volume;
                  const items = volEntries[v.volume];
                  return (
                    <View key={v.volume} style={p.divider}>
                      <Pressable style={[p.row, styles.volume]} accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => openVolume(v.volume)}>
                        <Ink style={styles.volumeLabel}>{v.volume}</Ink>
                        <Ink style={[p.flex, styles.volumeLabel]}>{v.count} 篇</Ink>
                        {expanded && volLoading === v.volume && <ActivityIndicator size="small" color={theme.primary} />}
                        <Ionicons name={expanded ? 'chevron-up-outline' : 'chevron-down-outline'} size={18} color={theme.primary} />
                      </Pressable>
                      {expanded && volError !== '' && <Message retry={() => openVolume(v.volume)}>{volError}</Message>}
                      {expanded && !volLoading && items && items.map((entry) => (
                        <Pressable key={entry.id} accessibilityRole="button" style={[p.row, styles.poem]} onPress={() => entry.poems?.id && router.push('/read', { id: entry.poems.id })}>
                          <Ink style={p.flex}>{entry.entry_title || entry.poems?.title}</Ink>
                          <Ionicons name="chevron-forward-outline" size={16} color={theme.primary} />
                        </Pressable>
                      ))}
                      {expanded && items && volMore[v.volume] && volMore[v.volume].loaded < volMore[v.volume].total && (
                        <Pressable style={styles.more} accessibilityRole="button" disabled={volLoading === v.volume} onPress={() => loadMoreVolume(v.volume)}>
                          {volLoading === v.volume ? <ActivityIndicator size="small" color={theme.primary} /> : <Ink style={styles.moreText}>载入更多该作者（已载 {volMore[v.volume].loaded}/{volMore[v.volume].total} 篇）</Ink>}
                        </Pressable>
                      )}
                    </View>
                  );
                })}
              </>
            ) : (
            <>
            {entriesLoading && <ActivityIndicator color={theme.primary} />}
            {!entriesLoading && entriesError !== '' && <Message retry={() => fetchEntries(0, false)}>{entriesError}</Message>}
            {!entriesLoading && entriesError === '' && entries.length === 0 && <Message>暂未收录篇目</Message>}
            {volumeList.map((volume) => (
              <View key={volume} style={p.divider}>
                <Pressable style={[p.row, styles.volume]} accessibilityRole="button" accessibilityState={{ expanded: open === volume }} onPress={() => setOpen(open === volume ? undefined : volume)}>
                  <Ink style={styles.volumeLabel}>{volume}</Ink>
                  <Ink style={[p.flex, styles.volumeLabel]}>{(volumeGroups.get(volume) ?? []).length} 篇</Ink>
                  <Ionicons name={open === volume ? 'chevron-up-outline' : 'chevron-down-outline'} size={18} color={theme.primary} />
                </Pressable>
                {open === volume && (volumeGroups.get(volume) ?? []).map((entry) => (
                  <Pressable key={entry.id} accessibilityRole="button" style={[p.row, styles.poem]} onPress={() => entry.poems?.id && router.push('/read', { id: entry.poems.id })}>
                    <Ink style={p.flex}>{entry.entry_title || entry.poems?.title}</Ink>
                    <Ionicons name="chevron-forward-outline" size={16} color={theme.primary} />
                  </Pressable>
                ))}
              </View>
            ))}
            {loadMore && (
              <Pressable style={styles.more} accessibilityRole="button" disabled={moreLoading} onPress={loadMoreEntries}>
                {moreLoading ? <ActivityIndicator color={theme.primary} size="small" /> : <Ink style={styles.moreText}>展开余卷（已载 {entries.length}/{entriesTotal} 篇）</Ink>}
              </Pressable>
            )}
            </>
            )}
          </View>}
          {tab === '简介' && <View style={[p.card, styles.textPanel]}><Ink style={p.body}>{work.description || work.name}{'\n'}收录篇目 {(work.poem_count ?? entriesTotal) || '—'} 篇</Ink></View>}
          {tab === '版本' && <View style={[p.card, styles.textPanel]}><Ink style={p.body}>{hasBackend ? '文本来源为观文文库。' : '文本来源为观文内置选篇。'}目录按本集的真实卷次与篇次编排。</Ink></View>}
          {tab === '相关' && <View style={[p.card, styles.panel]}>
            {work.author_id && <Pressable style={styles.volume} accessibilityRole="button" onPress={() => router.push('/poet-detail', { id: work.author_id })}><Ink>查看人物 · {work.author_name}</Ink></Pressable>}
            {catalog.data?.filter((item) => item.id !== id && workType(item.name) === workType(work.name)).slice(0, 4).map((item) => (
              <Pressable key={item.id} style={[styles.volume, p.divider]} accessibilityRole="button" onPress={() => router.push('/work-detail', { id: item.id })}><Ink>{item.name}</Ink></Pressable>
            ))}
          </View>}
        </>}
      </ScrollView>
    </Paper>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: 13, paddingTop: 11, gap: 20 },
  title: { fontSize: 32, letterSpacing: 1.2 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 18 },
  tag: { paddingHorizontal: 7, paddingVertical: 2, fontSize: 14, borderColor: theme.line, borderWidth: 1, borderRadius: 9 },
  summary: { marginTop: 16, marginBottom: 18, marginHorizontal: 10, letterSpacing: 1 },
  panel: { paddingHorizontal: 15, marginTop: 14 },
  textPanel: { padding: 15, marginTop: 14 },
  volume: { minHeight: 57, justifyContent: 'center' },
  volumeLabel: { fontSize: 20 },
  poem: { paddingLeft: 19, minHeight: 44 },
  more: { marginTop: 14, paddingVertical: 13, alignItems: 'center' },
  moreText: { color: theme.primary, fontSize: 16 },
});