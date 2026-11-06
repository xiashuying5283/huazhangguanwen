import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Screen } from '@/components/Screen';
import { AppHeader } from '@/components/AppHeader';
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
      // 服务端文件：server/src/routes/content.ts
      // 接口：GET /api/v1/authors ；Query：limit?: number, offset?: number
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(useCallback(() => { loadPage(1); }, [loadPage]));

  return (
    <Screen backgroundColor={theme.bgRoot} safeAreaEdges={['left', 'right', 'bottom']} style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <AppHeader title="人物" icon="user-pen" subtitle="遇见诗人，走进他们的世界" onSearch={() => setSearchOpen(true)} />

        {loading ? (
          <View style={styles.center}><ActivityIndicator color={theme.primary} /></View>
        ) : error ? (
          <View style={styles.center}><Text style={styles.error}>{error}</Text></View>
        ) : (
          <>
            {authors.map((a) => <AuthorCard key={a.id} author={a} />)}
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
  center: { alignItems: 'center', paddingTop: 80 },
  error: { color: theme.primaryDeep, fontWeight: '600' },
});