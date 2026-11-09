import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Screen } from '@/components/Screen';
import { AuthorCard } from '@/components/AuthorCard';
import { SearchModal } from '@/components/SearchModal';
import { PaginationBar } from '@/components/PaginationBar';
import { Api, type AuthorSummary, type Paged } from '@/utils/api';
import { theme } from '@/theme';

const PAGE = 60;

export default function PoetsScreen() {
  const [authors, setAuthors] = useState<AuthorSummary[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  const loadPage = useCallback(async (p: number) => {
    setLoading(true);
    setError('');
    try {
      const offset = (p - 1) * PAGE;
      const data = await Api.get<Paged<AuthorSummary>>(`/api/v1/authors?limit=${PAGE}&offset=${offset}`);
      setAuthors(data.list);
      setPage(data.page);
      setTotalPages(data.totalPages);
      setTotal(data.total);
    } catch (e) {
      setError((e as Error).message);
    }
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { loadPage(1); }, [loadPage]));

  const featured = useMemo(() => authors[0] ?? null, [authors]);
  const rest = useMemo(() => authors.slice(1), [authors]);

  return (
    <Screen backgroundColor={theme.bgRoot} safeAreaEdges={['left', 'right', 'bottom']} style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Image source={require('@/assets/guanwen/decorations/mist_cloud.png')} style={styles.topMist} />
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.kicker}>人物图谱 · 诗人与时代</Text>
            <Text style={styles.title}>人物</Text>
          </View>
          <Pressable onPress={() => setSearchOpen(true)} style={styles.searchBtn}>
            <Text style={styles.searchTxt}>⌕</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.center}><ActivityIndicator color={theme.primary} /></View>
        ) : error ? (
          <View style={styles.center}><Text style={styles.error}>{error}</Text></View>
        ) : (
          <>
            {featured ? (
              <View style={styles.featuredCard}>
                <View style={styles.featuredText}>
                  <Text style={styles.featuredKicker}>本期人物</Text>
                  <Text style={styles.featuredName}>{featured.name}</Text>
                  <Text style={styles.featuredDynasty}>{featured.dynasty}</Text>
                  <Text style={styles.featuredBio} numberOfLines={3}>{featured.bio || '读其诗，知其人，观其世。'}</Text>
                  <View style={styles.featuredPill}>
                    <Text style={styles.featuredPillTxt}>{featured.poem_count ?? 0} 首诗文</Text>
                  </View>
                </View>
                <View style={styles.featuredPortraitWrap}>
                  <Image source={require('@/assets/guanwen/circles/plum_pavilion.png')} style={styles.featuredPortraitBg} />
                  <Text style={styles.featuredPortraitEmoji}>{featured.avatar_emoji ?? '人'}</Text>
                </View>
              </View>
            ) : null}

            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>文坛群星</Text>
              <Text style={styles.sectionMeta}>共 {total} 位</Text>
            </View>
            {(featured ? rest : authors).map((a) => <AuthorCard key={a.id} author={a} />)}
            <PaginationBar
              page={page}
              totalPages={totalPages}
              total={total}
              onPrev={() => loadPage(page - 1)}
              onNext={() => loadPage(page + 1)}
            />
          </>
        )}
      </ScrollView>
      <SearchModal visible={searchOpen} onClose={() => setSearchOpen(false)} afterSearch={() => { setSearchOpen(false); loadPage(1); }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  topMist: { position: 'absolute', top: 0, right: 0, width: 180, height: 70, opacity: 0.32 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, paddingBottom: 14 },
  kicker: { fontSize: 10, color: '#A28566', letterSpacing: 2 },
  title: { fontSize: 28, fontWeight: '900', color: theme.ink, marginTop: 5 },
  searchBtn: { width: 40, height: 40, borderRadius: 14, backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center' },
  searchTxt: { fontSize: 18, color: theme.primaryDeep, marginTop: -1 },
  center: { alignItems: 'center', paddingTop: 80 },
  error: { color: theme.primaryDeep, fontWeight: '600' },

  featuredCard: {
    backgroundColor: theme.surface,
    borderRadius: 24,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: theme.line,
    marginTop: 6,
  },
  featuredText: { flex: 1 },
  featuredKicker: { fontSize: 11, color: theme.primaryDeep, fontWeight: '800' },
  featuredName: { fontSize: 24, fontWeight: '900', color: theme.ink, marginTop: 9 },
  featuredDynasty: { fontSize: 12, color: theme.muted, marginTop: 3, fontWeight: '700' },
  featuredBio: { fontSize: 13, color: theme.inkSoft, lineHeight: 20, marginTop: 10 },
  featuredPill: { marginTop: 14, alignSelf: 'flex-start', backgroundColor: '#ECE5D8', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  featuredPillTxt: { fontSize: 11, color: theme.primaryDeep, fontWeight: '700' },
  featuredPortraitWrap: { width: 108, height: 144, borderRadius: 20, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEE6D8' },
  featuredPortraitBg: { position: 'absolute', width: '100%', height: '100%' },
  featuredPortraitEmoji: { fontSize: 50 },

  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 24, marginBottom: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: theme.ink },
  sectionMeta: { fontSize: 12, color: theme.muted, fontWeight: '700' },
});
