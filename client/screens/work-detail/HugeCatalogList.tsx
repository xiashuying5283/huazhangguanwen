import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { Ink, Message, paperStyles as p } from '@/components/Paper';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { Api } from '@/utils/api';
import { routeForTitle } from '@/utils/drama';
import { theme } from '@/theme';

interface WorkEntry {
  id: string;
  entry_title: string;
  poem_id: string;
  poems?: { id: string; title: string };
}
interface VolItem {
  volume: string;
  count: number;
}

/** 巨型文集（如全唐诗）目录：按作者分卷，虚拟化滚动 + 作者搜索 + 点开展开该作者篇目 */
export default function HugeCatalogList({ workId }: { workId?: string }) {
  const router = useSafeRouter();
  const [catalog, setCatalog] = useState<VolItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string>();
  const [volEntries, setVolEntries] = useState<Record<string, WorkEntry[]>>({});
  const [volLoading, setVolLoading] = useState<string>();
  const [volError, setVolError] = useState('');

  const fetchCatalog = useCallback(async () => {
    if (!workId) return;
    setLoading(true);
    setError('');
    try {
      const d = await Api.get<{ catalog: VolItem[] }>(`/api/v1/works/${encodeURIComponent(workId)}/catalog`);
      setCatalog(d.catalog ?? []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '加载目录失败');
    } finally {
      setLoading(false);
    }
  }, [workId]);

  useFocusEffect(
    useCallback(() => {
      fetchCatalog();
    }, [fetchCatalog])
  );

  const openVolume = async (volume: string) => {
    if (open === volume) {
      setOpen(undefined);
      return;
    }
    setOpen(volume);
    if (volEntries[volume]) return;
    setVolLoading(volume);
    setVolError('');
    try {
      const d = await Api.get<{ entries: WorkEntry[] }>(
        `/api/v1/works/${encodeURIComponent(workId!)}/entries?volume=${encodeURIComponent(volume)}&limit=500&offset=0`
      );
      const list = d.entries ?? [];
      setVolEntries((prev) => ({ ...prev, [volume]: list }));
    } catch (reason) {
      setVolError(reason instanceof Error ? reason.message : '加载失败');
    } finally {
      setVolLoading(undefined);
    }
  };

  const q = query.trim().toLowerCase();
  const filtered = q ? catalog.filter((v) => v.volume.toLowerCase().includes(q)) : catalog;

  return (
    <View style={styles.root}>
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color={theme.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="搜索作者，如：李白 / 杜甫"
          placeholderTextColor={theme.muted}
          style={styles.search}
          selectionColor={theme.primary}
        />
        {query !== '' && (
          <Pressable accessibilityRole="button" onPress={() => setQuery('')}>
            <Ionicons name="close-circle-outline" size={18} color={theme.muted} />
          </Pressable>
        )}
      </View>

      {loading && <ActivityIndicator color={theme.primary} />}
      {!loading && error !== '' && <Message retry={fetchCatalog}>{error}</Message>}
      {!loading && error === '' && catalog.length === 0 && <Message>暂未收录篇目</Message>}
      {!loading && error === '' && q !== '' && filtered.length === 0 && <Message>没有匹配的作者</Message>}
      {!loading && error === '' && catalog.length > 0 && (
        <Ink style={styles.count}>{filtered.length > 0 ? `共 ${filtered.length} 位作者` : ''}</Ink>
      )}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.volume}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={30}
        maxToRenderPerBatch={30}
        removeClippedSubviews
        renderItem={({ item }) => {
          const expanded = open === item.volume;
          const items = volEntries[item.volume];
          return (
            <View style={p.divider}>
              <Pressable
                style={[p.row, styles.volume]}
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                onPress={() => openVolume(item.volume)}
              >
                <Ink style={styles.volumeLabel}>{item.volume}</Ink>
                <Ink style={[p.flex, styles.volumeLabel]}>{item.count} 篇</Ink>
                {expanded && volLoading === item.volume && <ActivityIndicator size="small" color={theme.primary} />}
                <Ionicons name={expanded ? 'chevron-up-outline' : 'chevron-down-outline'} size={18} color={theme.primary} />
              </Pressable>
              {expanded && volError !== '' && <Message retry={() => openVolume(item.volume)}>{volError}</Message>}
              {expanded && !volLoading && items && items.map((entry) => (
                <Pressable
                  key={entry.id}
                  accessibilityRole="button"
                  style={[p.row, styles.poem]}
                  onPress={() => { if (entry.poems?.id) { const r = routeForTitle(entry.poems.title, entry.poems.id); router.push(r.path, { id: r.id }); } }}
                >
                  <Ink style={p.flex}>{entry.entry_title || entry.poems?.title}</Ink>
                  <Ionicons name="chevron-forward-outline" size={16} color={theme.primary} />
                </Pressable>
              ))}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 14,
    marginVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: theme.surface,
  },
  search: { flex: 1, paddingVertical: 10, fontSize: 15, color: theme.ink },
  count: { marginHorizontal: 16, marginBottom: 4, color: theme.muted },
  volume: { minHeight: 57, justifyContent: 'center', paddingHorizontal: 15 },
  volumeLabel: { fontSize: 20 },
  poem: { paddingLeft: 19, minHeight: 44 },
});