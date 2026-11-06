import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Screen } from '@/components/Screen';
import { AppHeader } from '@/components/AppHeader';
import { AuthorCard } from '@/components/AuthorCard';
import { SearchModal } from '@/components/SearchModal';
import { Api, type AuthorSummary } from '@/utils/api';
import { theme } from '@/theme';

export default function PoetsScreen() {
  const [authors, setAuthors] = useState<AuthorSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      // 服务端文件：server/src/routes/content.ts
      // 接口：GET /api/v1/authors ；Query 参数：无
      const data = await Api.get<AuthorSummary[]>('/api/v1/authors');
      setAuthors(data);
    } catch (e) { setError((e as Error).message); }
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <Screen backgroundColor={theme.bgRoot} safeAreaEdges={['left', 'right', 'bottom']} style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <AppHeader title="人物" icon="user-pen" subtitle="遇见诗人，走进他们的世界" onSearch={() => setSearchOpen(true)} />

        {loading ? (
          <View style={styles.center}><ActivityIndicator color={theme.primary} /></View>
        ) : error ? (
          <View style={styles.center}><Text style={styles.error}>{error}</Text></View>
        ) : (
          authors.map((a) => <AuthorCard key={a.id} author={a} />)
        )}
      </ScrollView>
      <SearchModal visible={searchOpen} onClose={() => setSearchOpen(false)} afterSearch={load} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  center: { alignItems: 'center', paddingTop: 80 },
  error: { color: theme.primaryDeep, fontWeight: '600' },
});