import { useCallback, useMemo, useState } from 'react';
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

const genIcon = (genre?: string | null): keyof typeof FontAwesome6.glyphMap => {
  switch (genre) {
    case '词': return 'leaf';
    case '曲': return 'music';
    case '文': return 'scroll';
    case '骚体': return 'water';
    case '诗': return 'feather';
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
    setLoading(true);
    try {
      const deviceId = await getDeviceId();
      const data = await Api.get<HistoryResp>(`/api/v1/history?device_id=${encodeURIComponent(deviceId)}&limit=30`);
      setHistory(data.list);
      setReadTotal(data.total);
      setReadCount(data.read_count);
      setAuthorCount(data.author_count);
    } catch {
      setHistory([]);
    }
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const recent = useMemo(() => history.slice(0, 4), [history]);

  return (
    <Screen backgroundColor={theme.bgRoot} safeAreaEdges={['left', 'right', 'bottom']} style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Image source={require('@/assets/guanwen/decorations/pink_plum_branch.png')} style={styles.topBranch} />
        <View style={styles.header}>
          <Text style={styles.title}>我的书斋</Text>
          <Text style={styles.subtitle}>藏诗、阅卷、记人、修心</Text>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.avatarRing}>
            <Image source={require('@/assets/guanwen/circles/misty_mountains.png')} style={styles.avatar} />
          </View>
          <Text style={styles.nickname}>观文书客</Text>
          <Text style={styles.bio}>把一日烟火，读成半卷清诗。</Text>

          <View style={styles.statsRow}>
            <Stat value={readTotal} label="读过篇数" />
            <Stat value={authorCount} label="涉猎作者" />
            <Stat value={readCount} label="阅读次数" />
          </View>
        </View>

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>最近读过</Text>
          {history.length > 0 ? <Text style={styles.sectionMeta}>共 {readTotal} 篇</Text> : null}
        </View>

        {loading ? (
          <View style={styles.center}><ActivityIndicator color={theme.primary} /></View>
        ) : recent.length ? (
          <View style={styles.blockCard}>
            {recent.map((h, idx) => (
              <Pressable
                key={h.id}
                style={[styles.historyRow, idx === recent.length - 1 && styles.historyLastRow]}
                onPress={() => router.push('/read', { id: h.poem_id })}
              >
                <Image source={require('@/assets/guanwen/circles/misty_mountains.png')} style={styles.historyCircle} />
                <View style={{ flex: 1, marginHorizontal: 12 }}>
                  <Text style={styles.historyTitle} numberOfLines={1}>{h.title}</Text>
                  <Text style={styles.historyMeta} numberOfLines={1}>{h.author_name}{h.dynasty ? ` · ${h.dynasty}` : ''}</Text>
                </View>
                <Pressable hitSlop={6}>
                  <FontAwesome6 name="heart" size={16} color={idx < 2 ? theme.cinnabar : '#B7B2A5'} />
                </Pressable>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <FontAwesome6 name="mug-hot" size={24} color={theme.muted} />
            <Text style={styles.emptyTxt}>还没有阅读记录，去首页读一首诗吧。</Text>
          </View>
        )}

        <View style={styles.settingsCard}>
          {[
            ['阅读设置', 'sliders'],
            ['字体与排版', 'text-height'],
            ['主题与背景', 'palette'],
            ['数据与同步', 'database'],
          ].map(([label, icon], idx) => (
            <Pressable key={label} style={[styles.settingRow, idx === 3 && styles.settingLastRow]}>
              <View style={styles.settingIconWrap}>
                <FontAwesome6 name={icon as keyof typeof FontAwesome6.glyphMap} size={14} color={theme.primaryDeep} />
              </View>
              <Text style={styles.settingLabel}>{label}</Text>
              <Text style={styles.settingArrow}>›</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.statCol}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  topBranch: { position: 'absolute', top: 0, right: 0, width: 140, height: 100, opacity: 0.95 },
  header: { paddingTop: 8 },
  title: { fontSize: 28, fontWeight: '900', color: theme.ink },
  subtitle: { fontSize: 12, color: theme.muted, marginTop: 6 },

  heroCard: { alignItems: 'center', marginTop: 20, paddingVertical: 20, paddingHorizontal: 18, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.34)' },
  avatarRing: { width: 102, height: 102, borderRadius: 51, padding: 7, backgroundColor: 'rgba(255,255,255,0.7)' },
  avatar: { width: '100%', height: '100%', borderRadius: 999 },
  nickname: { fontSize: 22, fontWeight: '900', color: theme.ink, marginTop: 14 },
  bio: { fontSize: 13, color: theme.inkSoft, marginTop: 8 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginTop: 24 },
  statCol: { alignItems: 'center', minWidth: 72 },
  statValue: { fontSize: 28, fontWeight: '900', color: theme.ink },
  statLabel: { fontSize: 11, color: theme.muted, marginTop: 4 },

  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 24, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: theme.ink },
  sectionMeta: { fontSize: 12, color: theme.muted, fontWeight: '700' },
  center: { alignItems: 'center', paddingTop: 40 },

  blockCard: { backgroundColor: theme.surface, borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: theme.line },
  historyRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.line },
  historyLastRow: { borderBottomWidth: 0 },
  historyCircle: { width: 52, height: 52, borderRadius: 26 },
  historyTitle: { fontSize: 16, fontWeight: '800', color: theme.ink },
  historyMeta: { fontSize: 12, color: theme.muted, marginTop: 4 },

  emptyCard: { backgroundColor: theme.surface, borderRadius: 18, padding: 24, alignItems: 'center', gap: 12 },
  emptyTxt: { fontSize: 13, color: theme.muted, marginTop: 12 },

  settingsCard: { backgroundColor: theme.surface, borderRadius: 22, marginTop: 20, overflow: 'hidden', borderWidth: 1, borderColor: theme.line },
  settingRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.line },
  settingLastRow: { borderBottomWidth: 0 },
  settingIconWrap: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#EEE8DA', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  settingLabel: { flex: 1, fontSize: 14, color: theme.ink, fontWeight: '700' },
  settingArrow: { fontSize: 18, color: theme.muted },
});
