import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeSearchParams } from '@/hooks/useSafeRouter';
import { Screen } from '@/components/Screen';
import { AppHeader } from '@/components/AppHeader';
import { PoemCard } from '@/components/PoemCard';
import { SearchModal } from '@/components/SearchModal';
import { PaginationBar } from '@/components/PaginationBar';
import { Api, type AuthorSummary, type Paged, type PoemSummary, type WorkSummary } from '@/utils/api';
import { theme } from '@/theme';

const PAGE = 50;

export default function LibraryScreen() {
  const { work: initWork } = useSafeSearchParams<{ work?: string }>();
  const [authors, setAuthors] = useState<AuthorSummary[]>([]);
  const [works, setWorks] = useState<WorkSummary[]>([]);
  const [poems, setPoems] = useState<PoemSummary[]>([]);
  const [authorId, setAuthorId] = useState<string | null>(null);
  const [workId, setWorkId] = useState<string | null>(initWork ?? null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterKind, setFilterKind] = useState<'author' | 'work' | null>(null);

  const selectedAuthor = authors.find((a) => a.id === authorId)?.name;
  const selectedWork = works.find((w) => w.id === workId)?.name;

  const loadMeta = useCallback(async () => {
    try {
      const [a, w] = await Promise.all([
        // 服务端文件：server/src/routes/content.ts
        // 接口：GET /api/v1/authors
        Api.get<Paged<AuthorSummary>>('/api/v1/authors?limit=60'),
        // 服务端文件：server/src/routes/content.ts
        // 接口：GET /api/v1/works
        Api.get<WorkSummary[]>('/api/v1/works'),
      ]);
      setAuthors(a.list); setWorks(w);
    } catch { /* chips 加载失败不阻塞 */ }
  }, []);

  const loadPoems = useCallback(async (p: number) => {
    setLoading(true);
    try {
      // 服务端文件：server/src/routes/content.ts
      // 接口：GET /api/v1/poems ；Query 参数：author_id?: string, work_id?: string, limit?: number, offset?: number
      const params: string[] = [];
      if (authorId) params.push(`author_id=${authorId}`);
      if (workId) params.push(`work_id=${workId}`);
      params.push(`limit=${PAGE}`, `offset=${(p - 1) * PAGE}`);
      const data = await Api.get<Paged<PoemSummary>>(`/api/v1/poems?${params.join('&')}`);
      setPoems(data.list);
      setPage(data.page);
      setTotalPages(data.totalPages);
      setTotal(data.total);
    } catch { setPoems([]); setTotal(0); setTotalPages(1); }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorId, workId]);

  // 筛选变化时回到第一页
  useEffect(() => { loadPoems(1); }, [authorId, workId, loadPoems]);

  useFocusEffect(useCallback(() => { loadMeta(); loadPoems(1); }, [loadMeta, loadPoems]));

  return (
    <Screen backgroundColor={theme.bgRoot} safeAreaEdges={['left', 'right', 'bottom']} style={{ flex: 1 }}>
      <AppHeader title="诗库" icon="book-open" subtitle="按人物或作品集翻阅" onSearch={() => setSearchOpen(true)} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* 人物筛选 */}
        <Text style={styles.filterLabel}>按人物</Text>
        <Pressable style={({ pressed }) => [styles.filterBtn, pressed && styles.filterBtnPressed]} onPress={() => setFilterKind('author')}>
          <Text style={styles.filterBtnTxt} numberOfLines={1}>{selectedAuthor ?? '全部人物'}</Text>
          <Text style={styles.filterBtnCaret}>▾</Text>
        </Pressable>

        {/* 作品集筛选 */}
        <Text style={[styles.filterLabel, { marginTop: 18 }]}>按作品集</Text>
        <Pressable style={({ pressed }) => [styles.filterBtn, pressed && styles.filterBtnPressed]} onPress={() => setFilterKind('work')}>
          <Text style={styles.filterBtnTxt} numberOfLines={1}>{selectedWork ? `《${selectedWork}》` : '全部作品集'}</Text>
          <Text style={styles.filterBtnCaret}>▾</Text>
        </Pressable>

        <View style={styles.listHeader}>
          <Text style={styles.resultLabel}>共 {total.toLocaleString()} 篇</Text>
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
            <PaginationBar
              page={page}
              totalPages={totalPages}
              total={total}
              onPrev={() => loadPoems(page - 1)}
              onNext={() => loadPoems(page + 1)}
            />
          </>
        ) : (
          <View style={styles.center}><Text style={styles.emptyTxt}>没有找到符合条件的诗文</Text></View>
        )}
      </ScrollView>

      <SearchModal visible={searchOpen} onClose={() => setSearchOpen(false)} afterSearch={() => loadPoems(1)} />

      {filterKind === 'author' ? (
        <FilterSheet
          title="按人物筛选"
          options={[{ key: '', label: '全部人物' }, ...authors.map((a) => ({ key: a.id, label: a.name }))]}
          current={authorId ?? ''}
          onSelect={(key) => { setAuthorId(key || null); setWorkId(null); setFilterKind(null); }}
          onClose={() => setFilterKind(null)}
        />
      ) : null}
      {filterKind === 'work' ? (
        <FilterSheet
          title="按作品集筛选"
          options={[{ key: '', label: '全部作品集' }, ...works.map((w) => ({ key: w.id, label: `《${w.name}》` }))]}
          current={workId ?? ''}
          onSelect={(key) => { setWorkId(key || null); setAuthorId(null); setFilterKind(null); }}
          onClose={() => setFilterKind(null)}
        />
      ) : null}
    </Screen>
  );
}

function FilterSheet({ title, options, current, onSelect, onClose }: {
  title: string;
  options: { key: string; label: string }[];
  current: string;
  onSelect: (key: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetMask} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => { /* 阻止点击穿透到遮罩 */ }}>
          <Text style={styles.sheetTitle}>{title}</Text>
          <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
            {options.map((o) => {
              const active = o.key === current;
              return (
                <Pressable key={o.key} style={({ pressed }) => [styles.sheetItem, pressed && styles.sheetItemPressed]}
                  onPress={() => onSelect(o.key)}>
                  <Text style={[styles.sheetItemTxt, active && styles.sheetItemTxtActive]} numberOfLines={1}>{o.label}</Text>
                  {active ? <Text style={styles.sheetItemCheck}>✓</Text> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  filterLabel: { fontSize: 15, fontWeight: '800', color: theme.ink, marginBottom: 10 },
  filterBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: theme.surface, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1, borderColor: theme.line },
  filterBtnPressed: { opacity: 0.85 },
  filterBtnTxt: { fontSize: 14, color: theme.ink, fontWeight: '700', flex: 1, marginRight: 8 },
  filterBtnCaret: { fontSize: 14, color: theme.muted, fontWeight: '700' },
  sheetMask: { flex: 1, backgroundColor: 'rgba(15,10,15,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: theme.bgRoot, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 18, paddingBottom: 30, paddingHorizontal: 20, maxHeight: '70%' },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: theme.ink, marginBottom: 6, textAlign: 'center' },
  sheetItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.line },
  sheetItemPressed: { opacity: 0.7 },
  sheetItemTxt: { fontSize: 15, color: theme.ink, fontWeight: '700' },
  sheetItemTxtActive: { color: theme.primaryDeep },
  sheetItemCheck: { fontSize: 16, color: theme.primaryDeep, fontWeight: '800' },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 22, marginBottom: 14 },
  resultLabel: { fontSize: 14, color: theme.muted, fontWeight: '700' },
  clearTxt: { fontSize: 13, color: theme.primaryDeep, fontWeight: '700' },
  center: { alignItems: 'center', paddingTop: 60, paddingBottom: 40 },
  emptyTxt: { color: theme.muted, fontWeight: '600' },
});