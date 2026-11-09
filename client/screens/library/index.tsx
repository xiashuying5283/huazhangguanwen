import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeSearchParams } from '@/hooks/useSafeRouter';
import { Screen } from '@/components/Screen';
import { PoemCard } from '@/components/PoemCard';
import { SearchModal } from '@/components/SearchModal';
import { PaginationBar } from '@/components/PaginationBar';
import { Api, type AuthorSummary, type Paged, type PoemSummary, type WorkSummary } from '@/utils/api';
import { theme } from '@/theme';

const PAGE = 30;
const FILTERS = ['诗集', '词集', '文集', '总集'];

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

function inferType(name: string) {
  if (/词|乐府/.test(name)) return '词集';
  if (/全唐诗|总集|诗话/.test(name)) return '总集';
  if (/集|别集/.test(name)) return '诗集';
  return '文集';
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
  const [typeFilter, setTypeFilter] = useState('诗集');

  const selectedWork = works.find((w) => w.id === workId) ?? null;

  const loadMeta = useCallback(async () => {
    try {
      const [a, w] = await Promise.all([
        Api.get<Paged<AuthorSummary>>('/api/v1/authors?limit=60'),
        Api.get<WorkSummary[]>('/api/v1/works'),
      ]);
      setAuthors(a.list);
      setWorks(w);
    } catch {
      setAuthors([]);
      setWorks([]);
    }
  }, []);

  const loadPoems = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const params: string[] = [];
      if (authorId) params.push(`author_id=${authorId}`);
      if (workId) params.push(`work_id=${workId}`);
      params.push(`limit=${PAGE}`, `offset=${(p - 1) * PAGE}`);
      const data = await Api.get<Paged<PoemSummary>>(`/api/v1/poems?${params.join('&')}`);
      setPoems(data.list);
      setPage(data.page);
      setTotalPages(data.totalPages);
      setTotal(data.total);
    } catch {
      setPoems([]);
      setTotal(0);
      setTotalPages(1);
    }
    setLoading(false);
  }, [authorId, workId]);

  useEffect(() => {
    const id = setTimeout(() => loadPoems(1), 0);
    return () => clearTimeout(id);
  }, [authorId, workId, loadPoems]);

  useFocusEffect(useCallback(() => { loadMeta(); loadPoems(1); }, [loadMeta, loadPoems]));

  const filteredWorks = useMemo(() => works.filter((w) => inferType(w.name) === typeFilter).slice(0, 8), [works, typeFilter]);

  return (
    <Screen backgroundColor={theme.bgRoot} safeAreaEdges={['left', 'right', 'bottom']} style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Image source={require('@/assets/guanwen/decorations/distant_mountain.png')} style={styles.headerBg} />

        <View style={styles.headerRow}>
          <Text style={styles.title}>文库</Text>
          <Pressable onPress={() => setSearchOpen(true)} style={styles.searchIconBtn}>
            <Text style={styles.searchTxt}>⌕</Text>
          </Pressable>
        </View>

        <Pressable style={styles.searchBar} onPress={() => setSearchOpen(true)}>
          <Text style={styles.searchLeading}>⌕</Text>
          <Text style={styles.searchPlaceholder}>搜索诗文、作者、文集...</Text>
        </Pressable>

        <View style={styles.filterRow}>
          {FILTERS.map((item) => (
            <Pressable key={item} onPress={() => setTypeFilter(item)} style={[styles.filterPill, typeFilter === item && styles.filterPillActive]}>
              <Text style={[styles.filterPillTxt, typeFilter === item && styles.filterPillTxtActive]}>{item}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>典藏文集</Text>
          <Pressable onPress={() => setFilterKind('work')}><Text style={styles.sectionMeta}>全部文集</Text></Pressable>
        </View>

        <View style={styles.worksBlock}>
          {(filteredWorks.length ? filteredWorks : works.slice(0, 6)).map((w) => {
            const active = w.id === workId;
            return (
              <Pressable
                key={w.id}
                style={[styles.workCard, active && styles.workCardActive]}
                onPress={() => { setWorkId(active ? null : w.id); setAuthorId(null); }}
              >
                <Image source={coverFor(w.name)} style={styles.workCover} />
                <View style={styles.workBody}>
                  <Text style={styles.workName}>{w.name}</Text>
                  <Text style={styles.workMeta}>{w.author_name ? `${w.author_name} · ` : ''}{w.era || inferType(w.name)}</Text>
                  <Text style={styles.workDesc} numberOfLines={2}>{w.description || '按卷次与篇目连续阅读，进入作者作品体系。'}</Text>
                </View>
                <Text style={styles.workArrow}>›</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.poemsHead}>
          <View>
            <Text style={styles.sectionTitle}>{selectedWork ? `《${selectedWork.name}》` : '收录诗文'}</Text>
            <Text style={styles.poemsSub}>{selectedWork ? '选段与诗文篇目' : '按条件筛选的诗文结果'}</Text>
          </View>
          <Pressable onPress={() => setFilterKind('author')}>
            <Text style={styles.sectionMeta}>{authorId ? '切换人物' : `${total} 篇`}</Text>
          </Pressable>
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
          title="按文集筛选"
          options={[{ key: '', label: '全部文集' }, ...works.map((w) => ({ key: w.id, label: `《${w.name}》` }))]}
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
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.sheetTitle}>{title}</Text>
          <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
            {options.map((o) => {
              const active = o.key === current;
              return (
                <Pressable key={o.key} style={styles.sheetItem} onPress={() => onSelect(o.key)}>
                  <Text style={[styles.sheetItemTxt, active && styles.sheetItemTxtActive]}>{o.label}</Text>
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
  headerBg: { position: 'absolute', top: 0, left: 0, right: 0, width: '100%', height: 72, opacity: 0.18 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, paddingBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: theme.ink },
  searchIconBtn: { width: 40, height: 40, borderRadius: 14, backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center' },
  searchTxt: { fontSize: 18, color: theme.primaryDeep, marginTop: -1 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 46, backgroundColor: theme.surface, borderRadius: 18, paddingHorizontal: 14, borderWidth: 1, borderColor: '#EFE5D2' },
  searchLeading: { fontSize: 16, color: theme.muted },
  searchPlaceholder: { fontSize: 13, color: theme.muted },

  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14, marginBottom: 8 },
  filterPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: '#EEE7DA' },
  filterPillActive: { backgroundColor: theme.primary },
  filterPillTxt: { fontSize: 13, color: theme.inkSoft, fontWeight: '700' },
  filterPillTxtActive: { color: '#fff' },

  sectionRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 20, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: theme.ink },
  sectionMeta: { fontSize: 12, color: theme.muted, fontWeight: '700' },

  worksBlock: { gap: 12 },
  workCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.surface, borderRadius: 22, padding: 14, borderWidth: 1, borderColor: theme.line },
  workCardActive: { borderColor: theme.primary, backgroundColor: '#F3EEE2' },
  workCover: { width: 62, height: 82, borderRadius: 8 },
  workBody: { flex: 1 },
  workName: { fontSize: 17, fontWeight: '800', color: theme.ink },
  workMeta: { fontSize: 12, color: theme.primaryDeep, fontWeight: '700', marginTop: 4 },
  workDesc: { fontSize: 12, color: theme.inkSoft, lineHeight: 19, marginTop: 7 },
  workArrow: { fontSize: 18, color: theme.muted },

  poemsHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 12 },
  poemsSub: { fontSize: 12, color: theme.muted, marginTop: 4 },
  center: { alignItems: 'center', paddingTop: 40 },
  emptyTxt: { color: theme.muted, fontWeight: '600' },

  sheetMask: { flex: 1, backgroundColor: 'rgba(0,0,0,0.18)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: theme.bgRoot, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 16, paddingHorizontal: 20, paddingBottom: 24 },
  sheetTitle: { fontSize: 18, fontWeight: '900', color: theme.ink, marginBottom: 12 },
  sheetItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.line },
  sheetItemTxt: { fontSize: 15, color: theme.ink },
  sheetItemTxtActive: { color: theme.primaryDeep, fontWeight: '800' },
  sheetItemCheck: { fontSize: 16, color: theme.primaryDeep, fontWeight: '900' },
});
