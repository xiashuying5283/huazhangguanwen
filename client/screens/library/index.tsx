import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import { BookCover, IconButton, Ink, Message, PageHeader, Paper, Segments, paperStyles as p } from '@/components/Paper';
import { SearchModal } from '@/components/SearchModal';
import { PoemCard } from '@/components/PoemCard';
import { PaginationBar } from '@/components/PaginationBar';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { useResource } from '@/hooks/useResource';
import { Api, type Paged, type PoemSummary } from '@/utils/api';
import { loadWorks } from '@/data/works';
import { workType } from '@/data/art';
import { shareText } from '@/utils/share';
import { theme } from '@/theme';

const filters = ['诗集', '词集', '文集', '总集'] as const;
const featuredOrder = ['王维集', '李白集', '杜甫集'];

export default function LibraryScreen() {
  const router = useSafeRouter();
  const { work } = useSafeSearchParams<{ work?: string }>();
  const [search, setSearch] = useState(false);
  const [filter, setFilter] = useState<(typeof filters)[number]>('诗集');
  const [showPoems, setShowPoems] = useState(false);
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState('');
  const books = useResource(loadWorks);
  const loadPoems = useCallback(() => showPoems ? Api.get<Paged<PoemSummary>>(`/api/v1/poems?limit=20&offset=${(page - 1) * 20}`) : Promise.resolve(undefined), [page, showPoems]);
  const poems = useResource(loadPoems);
  const rank = (name: string) => featuredOrder.includes(name) ? featuredOrder.indexOf(name) : featuredOrder.length;
  const works = books.data?.filter((item) => workType(item.name) === filter).sort((a, b) => rank(a.name) - rank(b.name));

  if (work) return <Redirect href={{ pathname: '/work-detail', params: { id: work } }} />;

  const shareLibrary = async () => {
    try { setNotice(await shareText('观文 · 文库', '观文 · 文库\n读诗 · 读人 · 读典籍') ?? ''); }
    catch (reason) { if ((reason as Error).name !== 'AbortError') setNotice('当前无法分享'); }
  };

  return (
    <Paper tab scene="mountain">
      <PageHeader title="文库"><IconButton icon="share-social-outline" label="分享文库" onPress={shareLibrary} /></PageHeader>
      <ScrollView style={p.scroll} contentContainerStyle={p.content} showsVerticalScrollIndicator={false}>
        {!!notice && <Message>{notice}</Message>}
        <Pressable style={styles.search} onPress={() => setSearch(true)} accessibilityRole="button">
          <Ionicons name="search-outline" size={20} color={theme.primaryDeep} />
          <Ink style={p.meta}>搜索诗文、作者、文集...</Ink>
        </Pressable>
        <Segments options={filters} value={filter} onChange={(value) => { setFilter(value); setShowPoems(false); }} pills />
        {books.loading && <ActivityIndicator color={theme.primary} style={styles.status} />}
        {books.error && <Message retry={books.retry}>{books.error}</Message>}
        {works?.length === 0 && <Message>这一类文集暂未收录</Message>}
        <View style={[p.card, styles.books]}>
          {works?.map((item) => (
            <Pressable key={item.id} accessibilityRole="button" style={[p.row, p.divider, styles.book]} onPress={() => router.push('/work-detail', { id: item.id })}>
              <BookCover name={item.name} width={83} height={107} />
              <View style={p.flex}>
                <Ink style={p.itemTitle}>{item.name}</Ink>
                <Ink style={p.meta}>{[item.era, item.author_name].filter(Boolean).join(' · ')}</Ink>
                <Ink style={[p.meta, styles.description]} numberOfLines={2}>{item.description || (item.poem_count != null ? `收录诗文 ${item.poem_count} 篇` : '打开文集，按篇阅读')}</Ink>
              </View>
              <Ionicons name="chevron-forward-outline" color={theme.primary} size={18} />
            </Pressable>
          ))}
        </View>
        <Pressable accessibilityRole="button" onPress={() => setShowPoems(!showPoems)} style={styles.browse}>
          <Ink style={p.itemTitle}>{showPoems ? '收起全部诗文' : '浏览全部诗文'}</Ink>
          <Ionicons name={showPoems ? 'chevron-up-outline' : 'chevron-down-outline'} color={theme.primary} size={18} />
        </Pressable>
        {showPoems && <>
          {poems.loading && <ActivityIndicator color={theme.primary} />}
          {poems.error && <Message retry={poems.retry}>{poems.error}</Message>}
          {poems.data?.list.map((poem) => <PoemCard key={poem.id} poem={poem} />)}
          {poems.data && poems.data.totalPages > 1 && <PaginationBar {...poems.data} onPrev={() => setPage(page - 1)} onNext={() => setPage(page + 1)} />}
        </>}
      </ScrollView>
      <SearchModal visible={search} onClose={() => setSearch(false)} />
    </Paper>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 19, paddingHorizontal: 15, minHeight: 47, backgroundColor: 'rgba(255,251,243,0.82)', marginBottom: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.line },
  status: { marginTop: 32 },
  books: { marginTop: 16 },
  book: { paddingHorizontal: 8, paddingVertical: 8, gap: 17 },
  description: { lineHeight: 20, marginTop: 5 },
  browse: { minHeight: 51, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, marginTop: 13 },
});
