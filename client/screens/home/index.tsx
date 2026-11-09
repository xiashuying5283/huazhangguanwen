import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { FontAwesome6 } from '@expo/vector-icons';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { Screen } from '@/components/Screen';
import { SearchModal } from '@/components/SearchModal';
import { getDeviceId } from '@/utils/device';
import { Api, type PoemDetail } from '@/utils/api';
import { SHADOW_PINK, theme } from '@/theme';

interface Daily {
  date: string; reason: string; poem: PoemDetail;
}

export default function HomeScreen() {
  const router = useSafeRouter();
  const [daily, setDaily] = useState<Daily | null>(null);
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
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openDaily = async () => {
    if (!daily) return;
    router.push('/read', { id: daily.poem.id });
  };

  return (
    <Screen backgroundColor={theme.bgRoot} safeAreaEdges={['left', 'right', 'bottom']} style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.banner}>
          <Image source={require('@/assets/guanwen/backgrounds/mountains_fog.png')} style={styles.bannerBg} resizeMode="cover" />
          <View style={styles.bannerShade} />
          <Image source={require('@/assets/guanwen/decorations/pink_plum_branch.png')} style={styles.bannerPlum} />
          <View style={styles.bannerBody}>
            <View style={styles.brandRow}>
              <Text style={styles.brandTitle}>观文</Text>
              <View style={styles.brandSloganCol}>
                {['读', '诗', '·', '读', '人', '·', '读', '典', '籍'].map((ch, i) => (
                  <Text key={i} style={styles.brandSloganChar}>{ch}</Text>
                ))}
              </View>
            </View>
          </View>
          <Pressable onPress={() => setSearchOpen(true)} style={styles.bannerSearch}>
            <FontAwesome6 name="magnifying-glass" size={17} color={theme.primaryDeep} />
          </Pressable>
        </View>

        <Text style={styles.dayTitle}>今日荐诗</Text>

        {loading ? (
          <View style={styles.center}><ActivityIndicator color={theme.primary} /></View>
        ) : error ? (
          <View style={styles.center}><Text style={styles.error}>{error}</Text></View>
        ) : daily ? (
          <>
            <View style={styles.hero}>
              <Image source={require('@/assets/guanwen/circles/misty_mountains.png')} style={styles.heroMedal} />
              <Image source={require('@/assets/guanwen/decorations/distant_mountain.png')} style={styles.heroMount} />
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeTxt}>今日推荐</Text>
              </View>
              <Text style={styles.heroTitle}>{daily.poem.title}</Text>
              <Text style={styles.heroAuthor}>
                {daily.poem.dynasty} · {daily.poem.author_name}
              </Text>
              <View style={styles.heroDivider} />
              <Text style={styles.heroLines}>
                {daily.poem.content.split('\n').slice(0, 4).join('\n')}
              </Text>
              <View style={styles.heroTags}>
                <View style={styles.heroTag}><Text style={styles.heroTagTxt}>{daily.poem.genre}</Text></View>
                {daily.poem.work_name ? <View style={styles.heroTag}><Text style={styles.heroTagTxt}>{daily.poem.work_name}</Text></View> : null}
              </View>
              <Pressable style={({ pressed }) => [styles.heroBtn, pressed && styles.heroBtnPressed]} onPress={openDaily}>
                <Text style={styles.heroBtnTxt}>立即精读</Text>
                <Text style={styles.heroBtnArrow}>→</Text>
              </Pressable>
              <Text style={styles.heroFoot}>{daily.reason}</Text>
            </View>

            <View style={styles.quickSection}>
              <Text style={styles.sectionTitle}>去逛一逛</Text>
              <View style={styles.quickRow}>
                <QuickBtn icon="user-pen" label="人物中心" color="#E0EADF" onPress={() => router.push('/poets')} />
                <QuickBtn icon="book-open" label="诗库" color="#EFE3D4" onPress={() => router.push('/library')} />
                <QuickBtn icon="magnifying-glass" label="搜一搜" color="#F2DCD3" onPress={() => setSearchOpen(true)} />
              </View>
            </View>
          </>
        ) : null}
      </ScrollView>

      <SearchModal visible={searchOpen} onClose={() => setSearchOpen(false)} afterSearch={load} />
    </Screen>
  );
}

function QuickBtn({ icon, label, color, onPress }: { icon: keyof typeof FontAwesome6.glyphMap; label: string; color: string; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.quickCard, { backgroundColor: color }, pressed && styles.quickPressed]} onPress={onPress}>
      <View style={styles.quickIconWrap}>
        <FontAwesome6 name={icon} size={22} color={theme.primaryDeep} />
      </View>
      <Text style={styles.quickLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  center: { alignItems: 'center', paddingTop: 80 },
  error: { color: theme.primaryDeep, fontWeight: '600' },

  banner: {
    height: 200, borderRadius: 26, marginBottom: 8, marginTop: 8, overflow: 'hidden',
    ...SHADOW_PINK,
  },
  bannerBg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  bannerShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,252,244,0.16)' },
  bannerPlum: { position: 'absolute', top: -14, left: 4, width: 120, height: 100, opacity: 0.92 },
  bannerBody: { ...StyleSheet.absoluteFillObject, justifyContent: 'center' },
  bannerSearch: {
    position: 'absolute', top: 14, right: 14, width: 38, height: 38, borderRadius: 14,
    backgroundColor: 'rgba(255,252,244,0.72)', alignItems: 'center', justifyContent: 'center',
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', marginLeft: 30 },
  brandTitle: { fontSize: 46, fontWeight: '900', color: theme.ink, letterSpacing: 10 },
  brandSloganCol: { flexDirection: 'column', marginLeft: 14 },
  brandSloganChar: { fontSize: 11, fontWeight: '700', color: theme.primaryDeep, lineHeight: 15, letterSpacing: 0 },
  dayTitle: {
    fontSize: 22, fontWeight: '900', color: theme.ink, letterSpacing: 1,
    marginTop: 18, marginBottom: 14,
  },
  hero: {
    backgroundColor: '#F6EEDD', borderRadius: 28, padding: 24, marginBottom: 20,
    overflow: 'hidden',
    ...SHADOW_PINK,
  },
  heroMedal: { position: 'absolute', top: 16, right: 16, width: 58, height: 58, borderRadius: 29, opacity: 0.92 },
  heroMount: { position: 'absolute', bottom: -6, right: 0, width: 150, height: 56, opacity: 0.5, tintColor: theme.secondary },
  heroBadge: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.75)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  heroBadgeTxt: { color: theme.primaryDeep, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  heroTitle: { marginTop: 14, fontSize: 30, fontWeight: '900', color: theme.ink },
  heroAuthor: { marginTop: 6, fontSize: 14, color: theme.inkSoft, fontWeight: '700' },
  heroDivider: { height: 1.5, backgroundColor: 'rgba(53,87,67,0.14)', marginVertical: 16 },
  heroLines: { fontSize: 18, lineHeight: 34, color: theme.ink, fontWeight: '600', fontStyle: 'italic' },
  heroTags: { flexDirection: 'row', gap: 8, marginTop: 16 },
  heroTag: { backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  heroTagTxt: { fontSize: 11, color: theme.primaryDeep, fontWeight: '700' },
  heroBtn: {
    marginTop: 18, backgroundColor: theme.primary, borderRadius: 999, paddingVertical: 13, paddingHorizontal: 22,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  heroBtnPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  heroBtnTxt: { color: '#FFFDF6', fontSize: 16, fontWeight: '800' },
  heroBtnArrow: { color: '#FFFDF6', fontSize: 16, fontWeight: '800' },
  heroFoot: { marginTop: 12, fontSize: 12, color: theme.inkSoft, fontWeight: '600', textAlign: 'center' },
  quickSection: { marginTop: 6 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: theme.ink, marginBottom: 14, letterSpacing: 0.5 },
  quickRow: { flexDirection: 'row', gap: 12 },
  quickCard: { flex: 1, borderRadius: 22, paddingVertical: 22, alignItems: 'center', gap: 10 },
  quickPressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  quickIconWrap: { width: 46, height: 46, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.85)', alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontSize: 13, color: theme.ink, fontWeight: '700' },
});