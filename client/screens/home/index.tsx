import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { FontAwesome6 } from '@expo/vector-icons';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { Screen } from '@/components/Screen';
import { SearchModal } from '@/components/SearchModal';
import { getDeviceId } from '@/utils/device';
import { Api, type PoemDetail } from '@/utils/api';
import { theme } from '@/theme';

interface Daily { date: string; reason: string; poem: PoemDetail; }
interface RecItem { id: number; title: string; dynasty: string; genre?: string; author_name?: string; background_hint?: string; }

/** 分类圆图（对应截图：山水/咏物/思乡/边塞） */
const CATS: { label: string; img: any }[] = [
  { label: '山水', img: require('@/assets/guanwen/banners/landscape_topic.png') },
  { label: '咏物', img: require('@/assets/guanwen/banners/plum_sentiment.png') },
  { label: '思乡', img: require('@/assets/guanwen/banners/homesick_river.png') },
  { label: '边塞', img: require('@/assets/guanwen/banners/frontier_wall.png') },
];

const REC_IMGS = [
  require('@/assets/guanwen/banners/landscape_topic.png'),
  require('@/assets/guanwen/banners/plum_sentiment.png'),
  require('@/assets/guanwen/banners/homesick_river.png'),
  require('@/assets/guanwen/banners/four_seasons.png'),
  require('@/assets/guanwen/circles/sunset_river.png'),
];

function todayLabel(): string {
  const d = new Date();
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export default function HomeScreen() {
  const router = useSafeRouter();
  const [daily, setDaily] = useState<Daily | null>(null);
  const [recs, setRecs] = useState<RecItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const deviceId = await getDeviceId();
      // 服务端文件：server/src/routes/content.ts
      // 接口：GET /api/v1/recommend/daily ；Query 参数：device_id: string
      const data = await Api.get<Daily>(`/api/v1/recommend/daily?device_id=${deviceId}`);
      setDaily(data);
      // 服务端文件：server/src/routes/content.ts
      // 接口：GET /api/v1/recommend/list ；Query 参数：limit?: number
      const list = await Api.get<RecItem[]>('/api/v1/recommend/list?limit=5');
      setRecs(list || []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openDaily = () => { if (daily) router.push('/read', { id: daily.poem.id }); };

  return (
    <Screen backgroundColor={theme.bgRoot} safeAreaEdges={['left', 'right', 'bottom']} style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* 顶部导航行：观文 + 日期 + 搜索 */}
        <View style={styles.navRow}>
          <View style={styles.navLeft}>
            <Text style={styles.navTitle}>观文</Text>
            <Text style={styles.navDate}>{todayLabel()}</Text>
          </View>
          <Pressable onPress={() => setSearchOpen(true)} style={styles.navSearch}>
            <FontAwesome6 name="magnifying-glass" size={17} color="rgba(42,42,42,0.7)" />
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.center}><ActivityIndicator color={theme.primary} /></View>
        ) : error ? (
          <View style={styles.center}><Text style={styles.error}>{error}</Text></View>
        ) : daily ? (
          <>
            {/* 今日荐诗卡片：左文右圆图 */}
            <View style={styles.card}>
              <View style={styles.cardLeft}>
                <Text style={styles.cardKicker}>今日荐诗</Text>
                <Text style={styles.cardTitle}>{daily.poem.title}</Text>
                <Text style={styles.cardByline}>
                  {daily.poem.dynasty} · {daily.poem.author_name}
                </Text>
                <Text style={styles.cardLines} numberOfLines={4}>
                  {daily.poem.content.split('\n').slice(0, 4).join('\n')}
                </Text>
              </View>
              <View style={styles.cardRight}>
                <Image source={require('@/assets/guanwen/backgrounds/mountains_fog.png')} style={styles.cardImg} />
                <Pressable style={styles.playBtn} onPress={openDaily}>
                  <FontAwesome6 name="play" size={15} color="#FFFDF6" />
                </Pressable>
              </View>
            </View>

            {/* 分类圆形图标 */}
            <View style={styles.catRow}>
              {CATS.map((c) => {
                const go = () => router.push('/library');
                return (
                  <Pressable key={c.label} style={styles.cat} onPress={go}>
                    <View style={styles.catImgWrap}>
                      <Image source={c.img} style={styles.catImg} />
                    </View>
                    <Text style={styles.catLabel}>{c.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* 为你推荐 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>为你推荐</Text>
              {recs.map((r, i) => (
                <RecommendedRow key={r.id} item={r} img={REC_IMGS[Math.abs(Number(r.id) || 0) % REC_IMGS.length]} onPress={() => router.push('/read', { id: r.id })} />
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>

      <SearchModal visible={searchOpen} onClose={() => setSearchOpen(false)} afterSearch={load} />
    </Screen>
  );
}

function RecommendedRow({ item, img, onPress }: { item: RecItem; img: number; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.rec, pressed && styles.pressed]} onPress={onPress}>
      <Image source={img} style={styles.recImg} />
      <View style={styles.recBody}>
        <Text style={styles.recTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.recMeta}>{item.author_name ? `${item.author_name}·${item.dynasty}` : item.dynasty}</Text>
      </View>
      <FontAwesome6 name="angle-right" size={16} color="rgba(42,42,42,0.45)" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  center: { alignItems: 'center', paddingTop: 80 },
  error: { color: theme.primary, fontWeight: '600' },

  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingTop: 4 },
  navLeft: { flexDirection: 'row', alignItems: 'baseline', gap: 12 },
  navTitle: { fontSize: 26, fontWeight: '900', color: theme.ink, letterSpacing: 1 },
  navDate: { fontSize: 14, color: theme.muted, fontWeight: '600' },
  navSearch: { width: 40, height: 40, borderRadius: 14, backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center' },

  card: {
    flexDirection: 'row', backgroundColor: theme.surface, borderRadius: 20,
    padding: 20, marginTop: 14, alignItems: 'center',
    shadowColor: '#000000', shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, shadowOpacity: 0.04, elevation: 2,
  },
  cardLeft: { flex: 1, marginRight: 14 },
  cardKicker: { fontSize: 14, color: theme.muted, fontWeight: '700' },
  cardTitle: { fontSize: 22, fontWeight: '900', color: theme.ink, marginTop: 6, letterSpacing: 1 },
  cardByline: { fontSize: 14, color: theme.muted, marginTop: 2, fontWeight: '600' },
  cardLines: { fontSize: 16, color: theme.ink, lineHeight: 26, marginTop: 10, opacity: 0.9 },
  cardRight: { alignItems: 'center' },
  cardImg: { width: 104, height: 104, borderRadius: 52 },
  playBtn: {
    position: 'absolute', bottom: 4, right: 2, width: 36, height: 36, borderRadius: 18,
    backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000000', shadowOffset: { width: 0, height: 4 }, shadowRadius: 8, shadowOpacity: 0.2, elevation: 4,
  },

  catRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 24, paddingHorizontal: 4 },
  cat: { alignItems: 'center', width: 64 },
  catImgWrap: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: theme.surface, overflow: 'hidden',
  },
  catImg: { width: '100%', height: '100%' },
  catLabel: { marginTop: 6, fontSize: 14, color: theme.ink, fontWeight: '700' },

  section: { marginTop: 26 },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: theme.ink, marginBottom: 12 },
  rec: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, borderRadius: 18,
    padding: 12, marginBottom: 10,
    shadowColor: '#000000', shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, shadowOpacity: 0.04, elevation: 2,
  },
  pressed: { opacity: 0.85 },
  recImg: { width: 48, height: 48, borderRadius: 24 },
  recBody: { flex: 1, marginLeft: 12 },
  recTitle: { fontSize: 16, fontWeight: '800', color: theme.ink },
  recMeta: { fontSize: 13, color: theme.muted, marginTop: 3, fontWeight: '600' },
});