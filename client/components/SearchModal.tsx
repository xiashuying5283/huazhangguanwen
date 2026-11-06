import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { Api, type AuthorSummary, type PoemSummary, type WorkSummary } from '@/utils/api';
import { getDeviceId } from '@/utils/device';
import { theme } from '@/theme';

interface SearchResult {
  authors: AuthorSummary[];
  works: WorkSummary[];
  poems: PoemSummary[];
}

interface Props {
  visible: boolean;
  onClose: () => void;
  afterSearch?: () => void;
}

export function SearchModal({ visible, onClose, afterSearch }: Props) {
  const router = useSafeRouter();
  const [kw, setKw] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => {
      setKw('');
      setResult(null);
    }, 0);
    return () => clearTimeout(t);
  }, [visible]);

  useEffect(() => {
    const t = setTimeout(async () => {
      const q = kw.trim();
      if (!q) {
        setResult(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      // 服务端文件：server/src/routes/content.ts
      // 接口：GET /api/v1/search ；Query 参数：q: string
      try {
        const data = await Api.get<SearchResult>(`/api/v1/search?q=${encodeURIComponent(q)}`);
        setResult(data);
      } catch {
        setResult(null);
      }
      setLoading(false);
    }, 350);
    return () => clearTimeout(t);
  }, [kw, visible]);

  const openPoem = async (p: PoemSummary) => {
    const deviceId = await getDeviceId();
    // 服务端文件：server/src/routes/content.ts
    // 接口：POST /api/v1/history ；Body 参数：device_id: string, poem_id: string, action?: 'read'|'search'
    Api.post('/api/v1/history', { device_id: deviceId, poem_id: p.id, action: 'search' }).catch(() => undefined);
    router.push('/read', { id: p.id });
    onClose(); afterSearch?.();
  };

  const openAuthor = (a: AuthorSummary) => {
    router.push('/poet-detail', { id: a.id });
    onClose(); afterSearch?.();
  };

  const openWork = (w: WorkSummary) => {
    router.push('/library', { work: w.id });
    onClose(); afterSearch?.();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.panel} onPress={() => Keyboard.dismiss()}>
          <View style={styles.inputRow}>
            <FontAwesome6 name="magnifying-glass" size={16} color={theme.primaryDeep} />
            <TextInput
              style={styles.input}
              placeholder="搜诗人、作品或诗句…"
              placeholderTextColor={theme.muted}
              value={kw}
              onChangeText={setKw}
              autoFocus
              returnKeyType="search"
            />
            {kw ? (
              <Pressable onPress={() => setKw('')} hitSlop={8}><Text style={styles.clear}>✕</Text></Pressable>
            ) : null}
          </View>

          {loading ? (
            <ActivityIndicator color={theme.primary} style={{ marginTop: 40 }} />
          ) : result && (result.authors.length || result.works.length || result.poems.length) ? (
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {result.authors.length > 0 ? (
                <ResultGroup title="诗人">
                  {result.authors.map((a) => (
                    <Pressable key={a.id} style={styles.row} onPress={() => openAuthor(a)}>
                      <Text style={styles.rowIcon}>{a.avatar_emoji ?? ''}</Text>
                      <View style={styles.rowInfo}>
                        <Text style={styles.rowTitle} numberOfLines={1}>{a.name}</Text>
                        <Text style={styles.rowMeta} numberOfLines={1}>{a.dynasty}</Text>
                      </View>
                      <Text style={styles.chevron}>›</Text>
                    </Pressable>
                  ))}
                </ResultGroup>
              ) : null}
              {result.works.length > 0 ? (
                <ResultGroup title="作品集">
                  {result.works.map((w) => (
                    <Pressable key={w.id} style={styles.row} onPress={() => openWork(w)}>
                      <Text style={styles.rowIcon}>{w.cover_emoji ?? ''}</Text>
                      <View style={styles.rowInfo}>
                        <Text style={styles.rowTitle} numberOfLines={1}>{w.name}</Text>
                        <Text style={styles.rowMeta} numberOfLines={1}>{w.era ?? ''}</Text>
                      </View>
                      <Text style={styles.chevron}>›</Text>
                    </Pressable>
                  ))}
                </ResultGroup>
              ) : null}
              {result.poems.length > 0 ? (
                <ResultGroup title="诗文">
                  {result.poems.map((p) => (
                    <Pressable key={p.id} style={styles.row} onPress={() => openPoem(p)}>
                      <Text style={styles.rowIcon}>{p.cover_emoji ?? ''}</Text>
                      <View style={styles.rowInfo}>
                        <Text style={styles.rowTitle} numberOfLines={1}>{p.title}</Text>
                        <Text style={styles.rowMeta} numberOfLines={1}>{p.author_name ?? ''}</Text>
                      </View>
                      <Text style={styles.chevron}>›</Text>
                    </Pressable>
                  ))}
                </ResultGroup>
              ) : null}
            </ScrollView>
          ) : result ? (
            <Text style={styles.empty}>没有找到“{kw.trim()}”相关的内容</Text>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
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
  backdrop: { flex: 1, backgroundColor: 'rgba(60,32,40,0.35)', justifyContent: 'flex-start' },
  panel: { marginTop: 90, marginHorizontal: 20, backgroundColor: theme.surface, borderRadius: 26, padding: 16, maxHeight: '60%' },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.bgSoft, borderRadius: 16, paddingHorizontal: 14, height: 46, gap: 8 },
  input: { flex: 1, fontSize: 15, color: theme.ink, fontWeight: '600' },
  clear: { fontSize: 16, color: theme.muted, paddingHorizontal: 4 },
  group: { marginTop: 16 },
  sectionTitle: { fontSize: 12, fontWeight: '800', color: theme.primaryDeep, marginBottom: 6, letterSpacing: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: theme.line },
  pressed: { opacity: 0.7 },
  rowIcon: { fontSize: 22, width: 26, textAlign: 'center' },
  rowInfo: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '700', color: theme.ink },
  rowMeta: { fontSize: 12, color: theme.muted, marginTop: 1 },
  chevron: { fontSize: 20, color: theme.muted },
  empty: { textAlign: 'center', color: theme.muted, marginTop: 40, fontSize: 14 },
});