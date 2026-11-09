import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { Screen } from '@/components/Screen';
import { Api } from '@/utils/api';
import { getDeviceId } from '@/utils/device';
import { theme } from '@/theme';

interface HistoryItem {
  id: string; poem_id: string; title: string; dynasty?: string | null; genre?: string | null;
  work_id?: string | null; work_name?: string | null;
  author_id?: string | null; author_name: string; created_at?: string;
}

interface HistoryResp {
  total: number; read_count: number; author_count: number;
  page: number; pageSize: number; totalPages: number; list: HistoryItem[];
}

const genIcon = (genre?: string | null): string => {
  switch (genre) {
    case '词': return 'leaf';
    case '曲': return 'music';
    case '文': return 'scroll';
    case '骚体': return 'water';
    case '诗': return 'flower';
    default: return 'book';
  }
};

export default function ProfileScreen() {
  const router = useSafeRouter();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [readTotal, setReadTotal] = useState(0);
  const [readCount, setReadCount] = useState(0);
  const [authorCount, setAuthorCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const deviceId = await getDeviceId();
      // 服务端文件：server/src/routes/content.ts
      // 接口：GET /api/v1/history ；Query 参数：device_id: string, limit?: number, offset?: number
      const data = await Api.get<HistoryResp>(`/api/v1/history?device_id=${encodeURIComponent(deviceId)}&limit=30`);
      setHistory(data.list);
      setReadTotal(data.total);
      setReadCount(data.read_count);
      setAuthorCount(data.author_count);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  // 返回本页时刷新（阅读后统计与历史会变化）
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <Screen backgroundColor={theme.bgRoot} safeAreaEdges={['left', 'right', 'bottom']} style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* 顶部红梅装饰 */}
        <Image source={require('@/assets/guanwen/decorations/pink_plum_branch.png')} style={styles.topPlum} />

        {/* 个人中心：居中圆头像 + 用户名 + 数据 */}
        <View style={styles.userCard}>
          <View style={styles.avatarBig}>
            <Image source={require('@/assets/guanwen/circles/misty_mountains.png')} style={styles.avatarImg} />
          </View>
          <Text style={styles.nickname}>观文书客</Text>
          <Text style={styles.motto}>读书破万卷，下笔如有神</Text>
          <View style={styles.statsRow}>
            <StatCard value={readTotal} label="读过篇数" />
            <StatCard value={readCount} label="阅读次数" />
            <StatCard value={authorCount} label="涉猎作家" />
          </View>
        </View>

        {/* 最近阅读 */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>最近阅读</Text>
          {history.length > 0 ? <Text style={styles.sectionSub}>共 {readTotal} 篇</Text> : null}
        </View>

        {loading ? (
          <View style={styles.center}><ActivityIndicator color={theme.primary} /></View>
        ) : history.length ? (
          <View style={styles.historyList}>
            {history.map((h) => (
              <Pressable key={h.id} style={({ pressed }) => [styles.historyRow, pressed && styles.historyRowPressed]}
                onPress={() => router.push('/read', { id: h.poem_id })}>
                <View style={styles.historyEmoji}><FontAwesome6 name={genIcon(h.genre) as any} size={16} color={theme.primaryDeep} /></View>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.historyTitle} numberOfLines={1}>{h.title}</Text>
                  <Text style={styles.historyMeta} numberOfLines={1}>
                    [{h.author_name}]{h.work_name ? ` · 《${h.work_name}》` : ''}{h.dynasty ? ` · ${h.dynasty}` : ''}
                  </Text>
                </View>
                <Text style={styles.historyArrow}>›</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}><FontAwesome6 name="mug-hot" size={26} color={theme.muted} /></View>
            <Text style={styles.emptyTxt}>还没有阅读记录，去发现一首心仪的诗吧</Text>
          </View>
        )}

        {/* 关于 */}
        <View style={styles.aboutCard}>
          <Text style={styles.aboutLine}>「古诗文精读」· 亲测可用的萌系阅读小站</Text>
          <Text style={styles.aboutLine2}>收录全唐诗、全宋词、全宋诗、元曲、楚辞、诗经、四书及蒙学等典籍</Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value.toLocaleString()}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40 },
  topPlum: { position: 'absolute', top: -6, right: 0, width: 118, height: 96, opacity: 0.9 },
  userCard: { alignItems: 'center', paddingTop: 6 },
  avatarBig: { width: 84, height: 84, borderRadius: 42, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(90,107,69,0.35)', backgroundColor: theme.surface },
  avatarImg: { width: '100%', height: '100%' },
  nickname: { fontSize: 18, fontWeight: '900', color: theme.ink, marginTop: 12 },
  motto: { fontSize: 12, color: theme.muted, marginTop: 5, fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 22, width: '100%' },
  statCard: { flex: 1, backgroundColor: theme.surface, borderRadius: 16, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: theme.line },
  statValue: { fontSize: 22, fontWeight: '900', color: theme.primaryDeep },
  statLabel: { fontSize: 12, color: theme.muted, fontWeight: '700', marginTop: 4 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 26, marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '900', color: theme.ink },
  sectionSub: { fontSize: 12, color: theme.muted, fontWeight: '700' },
  historyList: { backgroundColor: theme.surface, borderRadius: 18, borderWidth: 1, borderColor: theme.line, overflow: 'hidden' },
  historyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.line },
  historyRowPressed: { opacity: 0.7 },
  historyEmoji: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#E9EFE6', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  historyTitle: { fontSize: 15, fontWeight: '800', color: theme.ink },
  historyMeta: { fontSize: 12, color: theme.muted, fontWeight: '600', marginTop: 3 },
  historyArrow: { fontSize: 20, color: '#8A9489', fontWeight: '700' },
  center: { alignItems: 'center', paddingVertical: 50 },
  emptyCard: { alignItems: 'center', paddingVertical: 40, backgroundColor: theme.surface, borderRadius: 18, borderWidth: 1, borderColor: theme.line },
  emptyIcon: { marginBottom: 12 },
  emptyTxt: { fontSize: 13, color: theme.muted, fontWeight: '600' },
  aboutCard: { marginTop: 20, paddingHorizontal: 4 },
  aboutLine: { fontSize: 12, color: theme.muted, fontWeight: '700', textAlign: 'center' },
  aboutLine2: { fontSize: 11, color: '#8A9489', marginTop: 6, textAlign: 'center', lineHeight: 16 },
});