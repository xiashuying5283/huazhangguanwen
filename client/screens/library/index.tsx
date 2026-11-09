import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import { Avatar, BookCover, IconButton, Ink, Message, PageHeader, Paper, Segments, paperStyles as p } from '@/components/Paper';
import { PoemCard } from '@/components/PoemCard';
import { PaginationBar } from '@/components/PaginationBar';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { useResource } from '@/hooks/useResource';
import { Api, hasBackend, type AuthorSummary, type Paged, type PoemSummary, type WorkSummary } from '@/utils/api';
import { getDeviceId } from '@/utils/device';
import { loadWorks } from '@/data/works';
import { poemArt, workType } from '@/data/art';
import { shareText } from '@/utils/share';
import { theme } from '@/theme';

const filters = ['诗集', '词集', '文集', '总集'] as const;
const featuredOrder = ['王维集', '李白集', '杜甫集'];

interface SearchResult {
  authors: AuthorSummary[];
  works: WorkSummary[];
  poems: PoemSummary[];
}

export default function LibraryScreen() {
  const router = useSafeRouter();
  const { work } = useSafeSearchParams<{ work?: string }>();
  const [kw, setKw] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [searchRes, setSearchRes] = useState<SearchResult | null>(null);
  const [filter, setFilter] = useState<(typeof filters)[number]>('诗集');
  const [showPoems, setShowPoems] = useState(false);
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState('');
  const books = useResource(loadWorks);
  const loadPoems = useCallback(() => showPoems ? Api.get<Paged<PoemSummary>>(`/api/v1/poems?limit=20&offset=${(page - 1) * 20}`) : Promise.resolve(undefined), [page, showPoems]);
  const poems = useResource(loadPoems);
  const rank = (name: string) => featuredOrder.includes(name) ? featuredOrder.indexOf(name) : featuredOrder.length;
  const works = books.data?.filter((item) => workType(item.name) === filter).sort((a, b) => rank(a.name) - rank(b.name));
  const searching = kw.trim() !== '';

  // 就地搜索：输入防抖后调后端
  useEffect(() => {
    let active = true;
    const t = setTimeout(async () => {
      if (!searching) {
        if (active) { setSearchRes(null); setSearchLoading(false); setSearchError(false); }
        return;
      }
      setSearchLoading(true);
      setSearchError(false);
      try {
        // 服务端文件：server/src/routes/content.ts
        // 接口：GET /api/v1/search ；Query 参数：q: string
        const data = await Api.get<SearchResult>(`/api/v1/search?q=${encodeURIComponent(kw.trim())}`);
        if (active) setSearchRes(data);
      } catch {
        if (active) { setSearchRes(null); setSearchError(true); }
      }
      if (active) setSearchLoading(false);
    }, searching ? 350 : 0);
    return () => { active = false; clearTimeout(t); };
  }, [kw, searching]);

  if (work) return <Redirect href={{ pathname: '/work-detail', params: { id: work } }} />;

  const shareLibrary = async () => {
    try { setNotice(await shareText('观文 · 文库', '观文 · 文库\n读诗 · 读人 · 读典籍') ?? ''); }
    catch (reason) { if ((reason as Error).name !== 'AbortError') setNotice('当前无法分享'); }
  };

  const openAuthor = (a: AuthorSummary) => router.push('/poet-detail', { id: a.id });
  const openWork = (w: WorkSummary) => router.push('/work-detail', { id: w.id });
  const openPoem = (poem: PoemSummary) => {
    if (hasBackend) void getDeviceId().then((deviceId) => Api.post('/api/v1/history', { device_id: deviceId, poem_id: poem.id, action: 'search' })).catch(() => undefined);
    router.push('/read', { id: poem.id });
  };

  const hasResult = searchRes && (searchRes.authors.length || searchRes.works.length || searchRes.poems.length);

  return (
    <Paper tab scene="mountain">
      <PageHeader title="文库"><IconButton icon="share-social-outline" label="分享文库" onPress={shareLibrary} /></PageHeader>
      <ScrollView style={p.scroll} contentContainerStyle={p.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {!!notice && <Message>{notice}</Message>}
        <View style={styles.search}>
          <Ionicons name="search-outline" size={20} color={theme.primaryDeep} />
          <TextInput
            style={styles.input}
            placeholder="搜索诗文、作者、文集..."
            placeholderTextColor={theme.muted}
            value={kw}
            onChangeText={setKw}
            returnKeyType="search"
          />
          {kw ? <Pressable onPress={() => setKw('')} hitSlop={8} accessibilityRole="button"><Ink style={styles.clear}>✕</Ink></Pressable> : null}
        </View>

        {searching ? (
          <>
            {searchLoading && <ActivityIndicator color={theme.primary} style={styles.status} />}
            {!searchLoading && searchError && <Message>{searchError ? '搜索暂时不可用，请稍后再试' : ''}</Message>}
            {searchRes && !searchLoading && !hasResult && <Ink style={styles.empty}>没有找到“{kw.trim()}”相关的内容</Ink>}
            {searchRes && hasResult && (
              <>
                {searchRes.authors.length > 0 && (
                  <View style={styles.card}>
                    <Ink style={styles.sectionTitle}>诗人</Ink>
                    {searchRes.authors.map((a) => (
                      <Pressable key={a.id} style={styles.row} accessibilityRole="button" onPress={() => openAuthor(a)}>
                        <Avatar name={a.name} size={42} />
                        <View style={p.flex}><Ink style={styles.rowTitle} numberOfLines={1}>{a.name}</Ink>
                        <Ink style={styles.rowMeta} numberOfLines={1}>{a.dynasty}</Ink></View>
                        <Ionicons name="chevron-forward-outline" size={16} color={theme.primary} />
                      </Pressable>
                    ))}
                  </View>
                )}
                {searchRes.works.length > 0 && (
                  <View style={styles.card}>
                    <Ink style={styles.sectionTitle}>作品集</Ink>
                    {searchRes.works.map((w) => (
                      <Pressable key={w.id} style={styles.row} accessibilityRole="button" onPress={() => openWork(w)}>
                        <BookCover name={w.name} width={32} height={42} />
                        <View style={p.flex}><Ink style={styles.rowTitle} numberOfLines={1}>{w.name}</Ink>
                        <Ink style={styles.rowMeta} numberOfLines={1}>{w.era ?? ''}</Ink></View>
                        <Ionicons name="chevron-forward-outline" size={16} color={theme.primary} />
                      </Pressable>
                    ))}
                  </View>
                )}
                {searchRes.poems.length > 0 && (
                  <View style={styles.card}>
                    <Ink style={styles.sectionTitle}>诗文</Ink>
                    {searchRes.poems.map((poem) => (
                      <Pressable key={poem.id} style={styles.row} accessibilityRole="button" onPress={() => openPoem(poem)}>
                        <Image source={poemArt(poem.title)} style={{ width: 42, height: 42, borderRadius: 21 }} />
                        <View style={p.flex}><Ink style={styles.rowTitle} numberOfLines={1}>{poem.title}</Ink>
                        <Ink style={styles.rowMeta} numberOfLines={1}>{poem.author_name ?? ''}</Ink></View>
                        <Ionicons name="chevron-forward-outline" size={16} color={theme.primary} />
                      </Pressable>
                    ))}
                  </View>
                )}
              </>
            )}
          </>
        ) : (
          <>
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
          </>
        )}
      </ScrollView>
    </Paper>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 19, paddingHorizontal: 15, minHeight: 47, backgroundColor: 'rgba(255,251,243,0.82)', marginBottom: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.line },
  input: { flex: 1, fontSize: 15, color: theme.ink, paddingVertical: 0 },
  clear: { fontSize: 16, color: theme.muted },
  status: { marginTop: 32 },
  books: { marginTop: 16 },
  book: { paddingHorizontal: 8, paddingVertical: 8, gap: 17 },
  description: { lineHeight: 20, marginTop: 5 },
  browse: { minHeight: 51, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, marginTop: 13 },
  card: { backgroundColor: theme.surface, borderRadius: 16, paddingHorizontal: 13, paddingTop: 12, marginBottom: 3 },
  sectionTitle: { fontSize: 12, fontWeight: '800', color: theme.primaryDeep, marginBottom: 5, letterSpacing: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: theme.line, width: '100%' },
  rowTitle: { fontSize: 15, fontWeight: '700', color: theme.ink },
  rowMeta: { fontSize: 12, color: theme.muted, marginTop: 1 },
  empty: { textAlign: 'center', color: theme.muted, marginTop: 40, fontSize: 14 },
});