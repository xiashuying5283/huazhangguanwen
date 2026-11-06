import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeSearchParams } from '@/hooks/useSafeRouter';
import { Screen } from '@/components/Screen';
import { AppHeader } from '@/components/AppHeader';
import { PoemCard } from '@/components/PoemCard';
import { SearchModal } from '@/components/SearchModal';
import { Api, type AuthorSummary, type PoemSummary, type WorkSummary } from '@/utils/api';
import { theme } from '@/theme';

export default function LibraryScreen() {
  const { work: initWork } = useSafeSearchParams<{ work?: string }>();
  const [authors, setAuthors] = useState<AuthorSummary[]>([]);
  const [works, setWorks] = useState<WorkSummary[]>([]);
  const [poems, setPoems] = useState<PoemSummary[]>([]);
  const [authorId, setAuthorId] = useState<string | null>(null);
  const [workId, setWorkId] = useState<string | null>(initWork ?? null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const poemsRef = useRef(0);

  const loadMeta = useCallback(async () => {
    try {
      const [a, w] = await Promise.all([
        // 服务端文件：server/src/routes/content.ts
        // 接口：GET /api/v1/authors
        Api.get<AuthorSummary[]>('/api/v1/authors?limit=60'),
        // 服务端文件：server/src/routes/content.ts
        // 接口：GET /api/v1/works
        Api.get<WorkSummary[]>('/api/v1/works'),
      ]);
      setAuthors(a); setWorks(w);
    } catch { /* chips 加载失败不阻塞 */ }
  }, []);

  const loadPoems = useCallback(async (reset: boolean) => {
    if (reset) setLoading(true); else setLoadingMore(true);
    try {
      // 服务端文件：server/src/routes/content.ts
      // 接口：GET /api/v1/poems ；Query 参数：author_id?: string, work_id?: string, limit?: number, offset?: number
      const params: string[] = [];
      if (authorId) params.push(`author_id=${authorId}`);
      if (workId) params.push(`work_id=${workId}`);
      const offset = reset ? 0 : poemsRef.current;
      params.push(`limit=50`, `offset=${offset}`);
      const data = await Api.get<PoemSummary[]>(`/api/v1/poems?${params.join('&')}`);
      setPoems((prev) => reset ? data : [...prev, ...data]);
      poemsRef.current = offset + data.length;
      setHasMore(data.length >= 50);
    } catch { if (reset) setPoems([]); }
    setLoading(false);
    setLoadingMore(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorId, workId]);

  useFocusEffect(useCallback(() => { loadMeta(); loadPoems(true); }, [loadMeta, loadPoems]));

  return (
    <Screen backgroundColor={theme.bgRoot} safeAreaEdges={['left', 'right', 'bottom']} style={{ flex: 1 }}>
      <AppHeader title="诗库" icon="book-open" subtitle="按人物或作品集翻阅" onSearch={() => setSearchOpen(true)} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* 人物筛选 */}
        <Text style={styles.filterLabel}>按人物</Text>
        <View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
            <Chip text="全部" active={!authorId} onPress={() => setAuthorId(null)} />
            {authors.map((a) => (
              <Chip key={a.id} text={a.name} active={authorId === a.id} onPress={() => { setAuthorId(a.id); setWorkId(null); }} />
            ))}
          </ScrollView>
        </View>

        {/* 作品集筛选 */}
        <Text style={[styles.filterLabel, { marginTop: 18 }]}>按作品集</Text>
        <View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
            <Chip text="全部" active={!workId} onPress={() => setWorkId(null)} />
            {works.map((w) => (
              <Chip key={w.id} text={`《${w.name}》`} active={workId === w.id} onPress={() => { setWorkId(w.id); setAuthorId(null); }} />
            ))}
          </ScrollView>
        </View>

        <View style={styles.listHeader}>
          <Text style={styles.resultLabel}>共 {poems.length} 篇</Text>
          {(authorId || workId) ? (
            <Pressable onPress={() => { setAuthorId(null); setWorkId(null); }} hitSlop={8}>
              <Text style={styles.clearTxt}>清除筛选</Text>
            </Pressable>
          ) : null}
        </View>

        {loading ? (
          <View style={styles.center}><ActivityIndicator color={theme.primary} /></View>
        ) : poems.length ? (
          <>
            {poems.map((p) => <PoemCard key={p.id} poem={p} />)}
            {hasMore && (
              <Pressable style={styles.moreBtn} onPress={() => loadPoems(false)} disabled={loadingMore}>
                {loadingMore
                  ? <ActivityIndicator color={theme.primaryDeep} />
                  : <Text style={styles.moreTxt}>加载更多</Text>}
              </Pressable>
            )}
          </>
        ) : (
          <View style={styles.center}><Text style={styles.emptyTxt}>没有找到符合条件的诗文</Text></View>
        )}
      </ScrollView>

      <SearchModal visible={searchOpen} onClose={() => setSearchOpen(false)} afterSearch={() => loadPoems(true)} />
    </Screen>
  );
}

function Chip({ text, active, onPress }: { text: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.chipPressed]}>
      <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>{text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  filterLabel: { fontSize: 15, fontWeight: '800', color: theme.ink, marginBottom: 10 },
  chipsRow: { gap: 8, paddingRight: 8 },
  chip: { backgroundColor: theme.surface, borderRadius: 999, paddingHorizontal: 15, paddingVertical: 8, borderWidth: 1, borderColor: theme.line },
  chipActive: { backgroundColor: theme.primary, borderColor: theme.primary },
  chipPressed: { opacity: 0.85 },
  chipTxt: { fontSize: 13, color: theme.inkSoft, fontWeight: '700' },
  chipTxtActive: { color: '#fff' },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 22, marginBottom: 14 },
  resultLabel: { fontSize: 14, color: theme.muted, fontWeight: '700' },
  clearTxt: { fontSize: 13, color: theme.primaryDeep, fontWeight: '700' },
  center: { alignItems: 'center', paddingTop: 60, paddingBottom: 40 },
  emptyTxt: { color: theme.muted, fontWeight: '600' },
  moreBtn: { alignItems: 'center', paddingVertical: 16, marginTop: 6 },
  moreTxt: { color: theme.primaryDeep, fontWeight: '800' },
});