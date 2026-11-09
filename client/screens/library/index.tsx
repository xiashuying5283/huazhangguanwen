import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeSearchParams } from '@/hooks/useSafeRouter';
import { Screen } from '@/components/Screen';
import { PoemCard } from '@/components/PoemCard';
import { SearchModal } from '@/components/SearchModal';
import { PaginationBar } from '@/components/PaginationBar';
import { Api, type AuthorSummary, type Paged, type PoemSummary, type WorkSummary } from '@/utils/api';
import { theme } from '@/theme';

const PAGE = 50;

/** 按作者/名称关键词匹配古风书封 */
const BOOK_COVERS: Record<string, number> = {
  libai: require('@/assets/guanwen/book_covers/libai_collection.png'),
  dufu: require('@/assets/guanwen/book_covers/dufu_collection.png'),
  wangwei: require('@/assets/guanwen/book_covers/wangwei_collection.png'),
  sushi: require('@/assets/guanwen/book_covers/sushi_collection.png'),
  lisangyin: require('@/assets/guanwen/book_covers/lisangyin_collection.png'),
  quantangshi: require('@/assets/guanwen/book_covers/complete_tang_poetry.png'),
};
const FALLBACK_COVER = require('@/assets/guanwen/backgrounds/mountains_fog.png');

function coverFor(name: string): number {
  const n = (name || '').toLowerCase();
  if (/全唐诗|唐诗/.test(n)) return BOOK_COVERS.quantangshi;
  if (/李白|li-bai/.test(n)) return BOOK_COVERS.libai;
  if (/杜甫|du-fu/.test(n)) return BOOK_COVERS.dufu;
  if (/王维|wang-wei/.test(n)) return BOOK_COVERS.wangwei;
  if (/苏轼|东坡|su-shi/.test(n)) return BOOK_COVERS.sushi;
  if (/李商隐|li-shang-yin/.test(n)) return BOOK_COVERS.lisangyin;
  return FALLBACK_COVER;
}

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
        // 接口：GET /api/v1/authors ；Query 参数：limit?: number
        Api.get<Paged<AuthorSummary>>('/api/v1/authors?limit=60'),
        // 服务端文件：server/src/routes/content.ts
        // 接口：GET /api/v1/works
        Api.get<WorkSummary[]>('/api/v1/works'),
      ]);
      setAuthors(a.list); setWorks(w);
    } catch { /* 不阻塞 */ }
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
  }, [authorId, workId]);

  // 筛选变化时回到第一页（异步触发，避免 effect 内同步 setState）
  useEffect(() => {
    const id = setTimeout(() => loadPoems(1), 0);
    return () => clearTimeout(id);
  }, [authorId, workId, loadPoems]);

  useFocusEffect(useCallback(() => { loadMeta(); loadPoems(1); }, [loadMeta, loadPoems]));

  return (
    <Screen backgroundColor={theme.bgRoot} safeAreaEdges={['left', 'right', 'bottom']} style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* 顶部导航行 */}
        <View style={styles.navRow}>
          <Text style={styles.navTitle}>文库</Text>
          <View style={styles.navIcons}>
            <Pressable onPress={() => setSearchOpen(true)} style={styles.navIcon} hitSlop={6}>
              <Image source={require('@/assets/guanwen/backgrounds/mountains_fog.png')} style={styles.hidden} />
              <Text style={styles.navIconTxt}>⌕</Text>
            </Pressable>
            <Pressable onPress={() => setFilterKind('work')} style={styles.navIcon} hitSlop={6}>
              <Text style={styles.navIconTxt}>≡</Text>
            </Pressable>
          </View>
        </View>

        {/* 搜索栏 */}
        <Pressable style={styles.searchBar} onPress={() => setSearchOpen(true)}>
          <Text style={styles.searchIcon}>⌕</Text>
          <Text style={styles.searchPlaceholder}>搜索诗文、作者、文集...</Text>
        </Pressable>

        {/* 收录诗集头部 */}
        <View style={styles.listHeader}>
          <Text style={styles.resultLabel}>
            {selectedWork ? `《${selectedWork}》 · ${total.toLocaleString()} 篇` : `共 ${total.toLocaleString()} 篇诗文`}
          </Text>
          {(authorId || workId) ? (
            <Pressable onPress={() => { setAuthorId(null); setWorkId(null); }} hitSlop={8}>
              <Text style={styles.clearTxt}>清除筛选</Text>
            </Pressable>
          ) : null}
        </View>

        {/* 作品集书封列表 */}
        <View style={styles.worksBlock}>
          {works.slice(0, 6).map((w) => {
            const active = w.id === workId;
            return (
              <Pressable key={w.id} style={({ pressed }) => [styles.workCard, active && styles.workCardActive, pressed && styles.pressed]}
                onPress={() => { setWorkId(active ? null : w.id); setAuthorId(null); }}>
                <View style={styles.workCover}>
                  <Image source={coverFor(w.name)} style={styles.workCoverImg} />
                  <Text style={styles.workCoverTitle}>{w.name.replace('全集', '').replace('乐府', '').replace('词集', '')}</Text>
                </View>
                <View style={styles.workBody}>
                  <Text style={styles.workName} numberOfLines={1}>{w.name}</Text>
                  <Text style={styles.workMeta}>{w.era || ''}</Text>
                  <Text style={styles.workCount}>{works.length} 部文集</Text>
                </View>
                <Text style={styles.workArrow}>›</Text>
              </Pressable>
            );
          })}
        </View>

        {/* 诗文列表 */}
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
        <Pressable style={styles.sheet} onPress={() => { /* 阻止穿透 */ }}>
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
  hidden: { position: 'absolute', opacity: 0, width: 1, height: 1 },

  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingTop: 4 },
  navTitle: { fontSize: 24, fontWeight: '900', color: theme.ink, letterSpacing: 1 },
  navIcons: { flexDirection: 'row', gap: 8 },
  navIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center' },
  navIconTxt: { fontSize: 22, color: 'rgba(42,42,42,0.7)', fontWeight: '600' },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, borderRadius: 24,
    paddingHorizontal: 16, paddingVertical: 12, marginTop: 6,
    shadowColor: '#000000', shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, shadowOpacity: 0.03, elevation: 1,
  },
  searchIcon: { fontSize: 18, color: theme.muted, marginRight: 8 },
  searchPlaceholder: { fontSize: 14, color: theme.muted },

  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 22, marginBottom: 12 },
  resultLabel: { fontSize: 14, color: theme.muted, fontWeight: '700' },
  clearTxt: { fontSize: 13, color: theme.primaryDeep, fontWeight: '700' },

  worksBlock: { marginBottom: 6 },
  workCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, borderRadius: 18,
    padding: 14, marginBottom: 12,
    shadowColor: '#000000', shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, shadowOpacity: 0.04, elevation: 2,
  },
  workCardActive: { borderWidth: 1, borderColor: theme.primary },
  pressed: { opacity: 0.85 },
  workCover: { width: 64, height: 88, borderRadius: 8, overflow: 'hidden', backgroundColor: theme.bgSoft, alignItems: 'center', justifyContent: 'center' },
  workCoverImg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  workCoverTitle: {
    fontSize: 12, fontWeight: '800', color: '#FFFDF6', textAlign: 'center', letterSpacing: 2,
    backgroundColor: 'rgba(42,42,42,0.32)', paddingHorizontal: 2, paddingVertical: 3, borderRadius: 4,
  },
  workBody: { flex: 1, marginLeft: 14 },
  workName: { fontSize: 16, fontWeight: '900', color: theme.ink },
  workMeta: { fontSize: 13, color: theme.muted, marginTop: 4, fontWeight: '600' },
  workCount: { fontSize: 13, color: theme.muted, marginTop: 4, fontWeight: '600' },
  workArrow: { fontSize: 24, color: 'rgba(42,42,42,0.35)', marginLeft: 8, marginTop: -2 },

  sheetMask: { flex: 1, backgroundColor: 'rgba(15,10,15,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: theme.bgRoot, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 18, paddingBottom: 30, paddingHorizontal: 20, maxHeight: '70%' },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: theme.ink, marginBottom: 6, textAlign: 'center' },
  sheetItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.line },
  sheetItemPressed: { opacity: 0.7 },
  sheetItemTxt: { fontSize: 15, color: theme.ink, fontWeight: '700' },
  sheetItemTxtActive: { color: theme.primaryDeep },
  sheetItemCheck: { fontSize: 16, color: theme.primaryDeep, fontWeight: '800' },
  center: { alignItems: 'center', paddingTop: 60, paddingBottom: 40 },
  emptyTxt: { color: theme.muted, fontWeight: '600' },
});