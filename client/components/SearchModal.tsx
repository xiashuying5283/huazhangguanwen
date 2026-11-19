import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Image, Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { Api, hasBackend, type AuthorSummary, type PoemSummary, type WorkSummary } from '@/utils/api';
import { getDeviceId } from '@/utils/device';
import { theme } from '@/theme';
import { Avatar, BookCover, GenreTag, Ink } from '@/components/Paper';
import { poemArt } from '@/data/art';
import { collapseDramas, routeForTitle } from '@/utils/drama';
import { readingGenreLabel } from '@/utils/readingLayout';

interface SearchResult {
  authors: AuthorSummary[];
  works: WorkSummary[];
  poems: PoemSummary[];
  has_more?: boolean;
}

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function SearchModal({ visible, onClose }: Props) {
  const [query, setQuery] = useState('');
  const close = () => { setQuery(''); onClose(); };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable style={styles.panel} onPress={() => Keyboard.dismiss()}>
          {visible && <>
            <SearchInput value={query} onChange={setQuery} autoFocus />
            {query.trim() ? (
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <SearchResults query={query.trim()} onOpen={close} />
              </ScrollView>
            ) : null}
          </>}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function SearchInput({ value, onChange, autoFocus, style }: {
  value: string;
  onChange: (text: string) => void;
  autoFocus?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.inputRow, style]}>
      <Ionicons name="search-outline" size={20} color={theme.primaryDeep} />
      <TextInput
        accessibilityLabel="搜索诗文、作者、文集"
        style={styles.input}
        placeholder="搜诗人、作品或诗句…"
        placeholderTextColor={theme.muted}
        value={value}
        onChangeText={onChange}
        autoFocus={autoFocus}
        returnKeyType="search"
      />
      {value ? (
        <Pressable accessibilityRole="button" accessibilityLabel="清空搜索" onPress={() => onChange('')} hitSlop={8}>
          <Text style={styles.clear}>✕</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function SearchResults(props: { query: string; onOpen: () => void }) {
  return <SearchPage key={props.query} {...props} />;
}

function SearchPage({ query, onOpen }: { query: string; onOpen: () => void }) {
  const router = useSafeRouter();
  const [offset, setOffset] = useState(0);
  const [response, setResponse] = useState<{ offset: number; data: SearchResult | null }>();
  const result = response?.offset === offset ? response.data : undefined;
  const loading = result === undefined;
  const error = result === null;
  const works = result?.works ?? [];
  const { dramas, poems } = collapseDramas(result?.poems ?? []);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const data = await Api.get<SearchResult>(`/api/v1/search?q=${encodeURIComponent(query)}&offset=${offset}&limit=20`);
        if (active) setResponse({ offset, data });
      } catch {
        if (active) setResponse({ offset, data: null });
      }
    }, 350);
    return () => { active = false; clearTimeout(timer); };
  }, [query, offset]);

  const openPoem = (p: PoemSummary) => {
    if (hasBackend) void getDeviceId().then((deviceId) => Api.post('/api/v1/history', { device_id: deviceId, poem_id: p.id, action: 'search' })).catch(() => undefined);
    const route = routeForTitle(p.title, p.id);
    router.push(route.path, { id: route.id });
    onOpen();
  };

  const openAuthor = (a: AuthorSummary) => {
    router.push('/poet-detail', { id: a.id });
    onOpen();
  };

  const openWork = (w: WorkSummary) => {
    router.push('/work-detail', { id: w.id });
    onOpen();
  };

  return (
    <>
      {!loading && (result?.authors.length || works.length || poems.length || dramas.length) ? (
        <>
          {dramas.length > 0 && <ResultGroup title="作品">
            {dramas.map((drama) => <Pressable key={drama.base} accessibilityRole="button" style={styles.row} onPress={() => {
              router.push('/drama', { id: drama.firstId }); onOpen();
            }}>
              <View style={styles.rowInfo}>
                <View style={styles.titleRow}>
                  <Ink style={styles.rowTitle} numberOfLines={2}>{drama.base}</Ink>
                  <GenreTag label="杂剧" />
                </View>
                <Text style={styles.rowMeta}>{[drama.author, '查看作品目录'].filter(Boolean).join(' · ')}</Text>
              </View><Text style={styles.chevron}>›</Text>
            </Pressable>)}
          </ResultGroup>}
          {!!result?.authors.length && <ResultGroup title="诗人">
            {result.authors.map((a) => (
              <Pressable key={a.id} accessibilityRole="button" style={styles.row} onPress={() => openAuthor(a)}>
                <Avatar name={a.name} size={42} />
                <View style={styles.rowInfo}>
                  <Ink style={styles.rowTitle} numberOfLines={1}>{a.name}</Ink>
                  <Text style={styles.rowMeta} numberOfLines={1}>{a.dynasty}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            ))}
          </ResultGroup>}
          {works.length > 0 && <ResultGroup title="作品集">
            {works.map((w) => (
              <Pressable key={w.id} accessibilityRole="button" style={styles.row} onPress={() => openWork(w)}>
                <BookCover name={w.name} width={32} height={42} />
                <View style={styles.rowInfo}>
                  <Ink style={styles.rowTitle} numberOfLines={1}>{w.name}</Ink>
                  <Text style={styles.rowMeta} numberOfLines={1}>{w.era ?? ''}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            ))}
          </ResultGroup>}
          {poems.length > 0 && <ResultGroup title="诗文">
            {poems.map((p) => (
              <Pressable key={p.id} accessibilityRole="button" style={styles.row} onPress={() => openPoem(p)}>
                <Image source={poemArt(p.title)} style={styles.poemArt} />
                <View style={styles.rowInfo}>
                  <View style={styles.titleRow}>
                    <Ink style={styles.rowTitle} numberOfLines={1}>{p.title}</Ink>
                    <GenreTag label={readingGenreLabel(p)} />
                  </View>
                  <Text style={styles.rowMeta} numberOfLines={1}>{p.author_name ?? ''}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            ))}
          </ResultGroup>}
        </>
      ) : loading ? (
        <ActivityIndicator color={theme.primary} style={styles.empty} />
      ) : error ? (
        <Ink style={styles.empty}>搜索暂时不可用，请稍后再试</Ink>
      ) : (
        <Ink style={styles.empty}>没有找到“{query}”相关的内容</Ink>
      )}
      {(query.match(/[\p{L}\p{N}]/gu)?.length ?? 0) < 3 && <Ink style={styles.partial}>当前匹配作者、文集和篇名；搜索正文请至少输入三个字。</Ink>}
      {(offset > 0 || result?.has_more) && <View style={styles.paging}>
        <Pressable accessibilityRole="button" disabled={loading || offset === 0} onPress={() => setOffset((value) => Math.max(0,value-20))}>
          <Ink style={{ opacity: offset === 0 ? 0.4 : 1 }}>上一页</Ink>
        </Pressable>
        <Ink>第 {offset / 20 + 1} 页</Ink>
        <Pressable accessibilityRole="button" disabled={loading || !result?.has_more} onPress={() => setOffset((value) => value+20)}>
          <Ink style={{ opacity: result?.has_more ? 1 : 0.4 }}>下一页</Ink>
        </Pressable>
      </View>}
    </>
  );
}

function ResultGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.group}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  paging: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 20 },
  backdrop: { flex: 1, backgroundColor: 'rgba(60,32,40,0.35)', justifyContent: 'flex-start' },
  panel: { marginTop: 90, marginHorizontal: 20, backgroundColor: theme.surface, borderRadius: 26, padding: 16, maxHeight: '60%' },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.bgSoft, borderRadius: 16, paddingHorizontal: 14, height: 46, gap: 8 },
  input: { flex: 1, fontSize: 15, color: theme.ink, fontWeight: '600' },
  clear: { fontSize: 16, color: theme.muted, paddingHorizontal: 4 },
  loading: { marginTop: 16 },
  poemArt: { width: 42, height: 42, borderRadius: 21 },
  group: { marginTop: 16 },
  sectionTitle: { fontSize: 12, fontWeight: '800', color: theme.primaryDeep, marginBottom: 6, letterSpacing: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: theme.line },
  rowInfo: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowTitle: { flexShrink: 1, fontSize: 15, fontWeight: '700', color: theme.ink },
  rowMeta: { fontSize: 12, color: theme.muted, marginTop: 1 },
  chevron: { fontSize: 20, color: theme.muted },
  empty: { textAlign: 'center', color: theme.muted, marginTop: 40, fontSize: 14 },
  partial: { color: theme.muted, marginTop: 12, fontSize: 13 },
});
