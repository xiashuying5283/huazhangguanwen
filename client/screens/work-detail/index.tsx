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
import HugeCatalogList from './HugeCatalogList';

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

  // 目录渲染模式：普通 ScrollView（分页）或 HugeCatalogList（虚拟化 + 作者搜索）
  const [dirMode, setDirMode] = useState<'loading' | 'huge' | 'normal'>('normal');

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

  useFocusEffect(
    useCallback(() => {
      if (tab !== '目录') return;
      if (!work) return;
      const poemCount = work?.poem_count ?? 0;
      // 非巨型（≤3000 篇）一律走普通目录
      if (poemCount <= 3000) {
        setDirMode('normal');
        fetchEntries(0, false);
        return;
      }
      // 巨型文集需按真实卷数次定：仅当确实分成多卷时才用虚拟化目录
      // （否则像「元曲」这类 volume 全为空、仅一个"未分卷"的大集合，也该走普通分页目录）
      setDirMode('loading');
      Api.get<{ catalog: { volume: string; count: number }[] }>(`/api/v1/works/${encodeURIComponent(work.id)}/catalog`)
        .then((d) => {
          const huge = (d.catalog ?? []).length > 1;
          setDirMode(huge ? 'huge' : 'normal');
          if (!huge) fetchEntries(0, false);
        })
        .catch(() => {
          setDirMode('normal');
          fetchEntries(0, false);
        });
    }, [tab, work, fetchEntries])
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
      {dirMode === 'huge' && tab === '目录' ? (
        <HugeCatalogList workId={id} />
      ) : (
      <ScrollView style={p.scroll} contentContainerStyle={p.content} showsVerticalScrollIndicator={false}>
        {catalog.loading && <ActivityIndicator color={theme.primary} />}
        {(dirMode === 'loading' && tab === '目录') && <ActivityIndicator color={theme.primary} style={p.card} />}
        {catalog.error && <Message retry={catalog.retry}>{catalog.error}</Message>}
        {catalog.data && !work && <Message>未找到这本文集</Message>}
        {work && <>
          <View style={[p.row, styles.hero]}>
            <BookCover name={work.name} width={123} height={166} />
            <View style={p.flex}>
              <Ink style={styles.title}>{work.name}</Ink>
              <Ink style={p.meta}>{[work.era, work.author_name].filter(Boolean).join(' · ')}</Ink>
              <View style={styles.tags}>
                {[workType(work.name), ...(work.name === '王右丞集' ? ['田园', '山水'] : [])].map((tag) => <Ink key={tag} style={styles.tag}>{tag}</Ink>)}
              </View>
            </View>
          </View>
          <Ink style={[p.body, styles.summary]}>{work.description ?? '翻开文集，按篇阅读。'}</Ink>
          {!!notice && <Message>{notice}</Message>}
          <View style={p.card}><Segments options={tabs} value={tab} onChange={setTab} /></View>
          {tab === '目录' && <View style={[p.card, styles.panel]}>
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
      )}
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