import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Screen } from '@/components/Screen';
import { AppHeader } from '@/components/AppHeader';
import { AuthorCard } from '@/components/AuthorCard';
import { SearchModal } from '@/components/SearchModal';
import { Api, type AuthorSummary } from '@/utils/api';
import { theme } from '@/theme';

const PAGE = 60;

export default function PoetsScreen() {
  const [authors, setAuthors] = useState<AuthorSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const indexRef = useRef(0);

  const load = useCallback(async (reset: boolean) => {
    if (reset) setLoading(true); else setLoadingMore(true);
    setError('');
    try {
      // 服务端文件：server/src/routes/content.ts
      // 接口：GET /api/v1/authors ；Query 参数：limit?: number, offset?: number
      const offset = reset ? 0 : indexRef.current;
      const data = await Api.get<AuthorSummary[]>(`/api/v1/authors?limit=${PAGE}&offset=${offset}`);
      setAuthors((prev) => reset ? data : [...prev, ...data]);
      indexRef.current = offset + data.length;
      setHasMore(data.length >= PAGE);
    } catch (e) { setError((e as Error).message); }
    setLoading(false);
    setLoadingMore(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(useCallback(() => { load(true); }, [load]));

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
            {hasMore && (
              <Pressable style={styles.moreBtn} onPress={() => load(false)} disabled={loadingMore}>
                {loadingMore
                  ? <ActivityIndicator color={theme.primaryDeep} />
                  : <Text style={styles.moreTxt}>加载更多诗人</Text>}
              </Pressable>
            )}
          </>
        )}
      </ScrollView>
      <SearchModal visible={searchOpen} onClose={() => setSearchOpen(false)} afterSearch={() => { setSearchOpen(false); load(true); }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  center: { alignItems: 'center', paddingTop: 80 },
  error: { color: theme.primaryDeep, fontWeight: '600' },
  moreBtn: { alignItems: 'center', paddingVertical: 16, marginTop: 6 },
  moreTxt: { color: theme.primaryDeep, fontWeight: '800' },
});