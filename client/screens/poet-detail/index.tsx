import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { TabView, TabBar } from 'react-native-tab-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { Screen } from '@/components/Screen';
import { Api, type AuthorDetail } from '@/utils/api';
import { theme } from '@/theme';

export default function PoetDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useSafeRouter();
  const { id } = useSafeSearchParams<{ id: string }>();
  const layout = useWindowDimensions();
  const [author, setAuthor] = useState<AuthorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [index, setIndex] = useState(0);
  const [bioState, setBioState] = useState<'idle' | 'generating' | 'done'>('idle');
  const bioDoneFor = useRef<Set<string>>(new Set());

  const routes = [
    { key: 'bio', title: '生平' },
    { key: 'works', title: '作品集' },
    { key: 'rel', title: '关系' },
    { key: 'poems', title: '诗作' },
  ];

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true); setError('');
    try {
      // 服务端文件：server/src/routes/content.ts
      // 接口：GET /api/v1/authors/:id ；Path 参数：id: string
      const data = await Api.get<AuthorDetail>(`/api/v1/authors/${id}`);
      setAuthor(data);
    } catch (e) { setError((e as Error).message); }
    setLoading(false);
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // 缺少生平时自动用大模型生成，并回写数据库
  useEffect(() => {
    if (!author) return;
    if (author.bio && author.bio.trim()) { setBioState('done'); return; }
    if (bioDoneFor.current.has(author.id)) { setBioState('done'); return; }
    bioDoneFor.current.add(author.id);
    setBioState('generating');
    (async () => {
      try {
        // 服务端文件：server/src/routes/ai.ts
        // 接口：POST /api/v1/ai/bio ；Body 参数：author_id: string
        await Api.post('/api/v1/ai/bio', { author_id: author.id });
      } catch { /* 生成失败不阻塞 */ }
      await load();
      setBioState('done');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [author?.id]);

  const renderScene = ({ route }: { route: { key: string } }) => {
    if (!author) return <View />;
    if (route.key === 'bio') return <BioTab author={author} bioState={bioState} />;
    if (route.key === 'works') return <WorksTab author={author} />;
    if (route.key === 'rel') return <RelTab author={author} />;
    return <PoemsTab author={author} />;
  };

  return (
    <Screen backgroundColor={theme.bgRoot} safeAreaEdges={['top', 'left', 'right']} style={{ flex: 1 }}>
      <View style={{ paddingTop: insets.top + 6 }}>
        <View style={styles.navRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
            <Text style={styles.backIcon}>‹</Text>
          </Pressable>
          <Text style={styles.navTitle}>诗人档案</Text>
          <View style={{ width: 40 }} />
        </View>

        {loading ? (
          <View style={styles.center}><ActivityIndicator color={theme.primary} /></View>
        ) : error ? (
          <View style={styles.center}><Text style={styles.error}>{error}</Text></View>
        ) : author ? (
          <View style={{ flex: 1 }}>
            <View style={styles.hero}>
              <View style={styles.avatarWrap}>
                <Text style={styles.avatarEmoji}>{author.avatar_emoji ?? ''}</Text>
              </View>
              <Text style={styles.name}>{author.name}</Text>
              <Text style={styles.dynasty}>{author.dynasty}</Text>
              {author.bio ? <Text style={styles.slogan} numberOfLines={2}>{author.bio}</Text> : null}
              <View style={styles.statsRow}>
                <Stat label="诗作" value={author.poems.length} />
                <Stat label="作品集" value={author.works.length} />
                <Stat label="人际" value={author.relationships.length} />
              </View>
            </View>

            <TabView
              navigationState={{ index, routes }}
              renderScene={renderScene}
              onIndexChange={setIndex}
              initialLayout={{ width: layout.width }}
              lazy
              renderTabBar={(props) => (
                <TabBar
                  {...props}
                  scrollEnabled
                  indicatorStyle={{ backgroundColor: theme.primary, height: 3, borderRadius: 3 }}
                  indicatorContainerStyle={{ marginHorizontal: 20 }}
                  style={styles.tabBar}
                  tabStyle={{ width: 'auto', paddingHorizontal: 16 }}
                  activeColor={theme.primaryDeep}
                  inactiveColor={theme.muted}
                />
              )}
            />
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function BioTab({ author, bioState }: { author: AuthorDetail; bioState: 'idle' | 'generating' | 'done' }) {
  const hasBio = !!(author.bio && author.bio.trim());
  return (
    <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>生平简介</Text>
        {hasBio ? (
          <Text style={styles.bioText}>{author.bio}</Text>
        ) : bioState === 'generating' ? (
          <View style={styles.genRow}>
            <ActivityIndicator color={theme.primary} />
            <Text style={styles.genTxt}>正在生成生平介绍…</Text>
          </View>
        ) : (
          <Text style={styles.bioText}>暂无生平介绍</Text>
        )}
      </View>
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>朝代</Text>
        <Text style={styles.bioText}>{author.dynasty}</Text>
      </View>
    </ScrollView>
  );
}

function WorksTab({ author }: { author: AuthorDetail }) {
  if (!author.works.length) {
    return <View style={styles.center}><Text style={styles.emptyTxt}>暂无作品集</Text></View>;
  }
  return (
    <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
      {author.works.map((w) => (
        <View key={w.id} style={styles.workCard}>
          <Text style={styles.workEmoji}>{w.cover_emoji ?? ''}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.workName}>《{w.name}》</Text>
            {w.era ? <Text style={styles.workMeta}>{w.era} · {w.poem_count ?? 0} 篇</Text> : null}
            {w.description ? <Text style={styles.workDesc} numberOfLines={2}>{w.description}</Text> : null}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

function RelTab({ author }: { author: AuthorDetail }) {
  if (!author.relationships.length) {
    return <View style={styles.center}><Text style={styles.emptyTxt}>暂无关系资料</Text></View>;
  }
  return (
    <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
      {author.relationships.map((r) => (
        <View key={r.id} style={styles.relCard}>
          <View style={styles.relAvatar}>
            <Text style={{ fontSize: 22 }}>{r.related_author?.avatar_emoji ?? ''}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.relTop}>
              <Text style={styles.relName}>{r.related_author?.name ?? (r.related_author_id ?? '未知')}</Text>
              <View style={styles.relTag}><Text style={styles.relTagTxt}>{r.relation}</Text></View>
            </View>
            {r.note ? <Text style={styles.relNote}>{r.note}</Text> : null}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

function PoemsTab({ author }: { author: AuthorDetail }) {
  const router = useSafeRouter();
  if (!author.poems.length) {
    return <View style={styles.center}><Text style={styles.emptyTxt}>暂无诗作</Text></View>;
  }
  return (
    <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
      {author.poems.map((p) => (
        <Pressable key={p.id} style={styles.poemRow} onPress={() => router.push('/read', { id: p.id })}>
          <View style={styles.poemDot} />
          <Text style={styles.poemRowTitle} numberOfLines={1}>{p.title}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: 8 },
  backBtn: { width: 40, height: 40, borderRadius: 14, backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center', shadowColor: theme.shadowSoft, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10, shadowOpacity: 1, elevation: 3 },
  backIcon: { fontSize: 30, color: theme.ink, marginTop: -2 },
  navTitle: { fontSize: 16, fontWeight: '800', color: theme.ink },
  center: { alignItems: 'center', paddingTop: 80, paddingBottom: 60 },
  error: { color: theme.primaryDeep, fontWeight: '600' },
  emptyTxt: { color: theme.muted, fontWeight: '600' },
  hero: { alignItems: 'center', paddingVertical: 20, paddingHorizontal: 20 },
  avatarWrap: { width: 92, height: 92, borderRadius: 30, backgroundColor: '#E9EFE6', alignItems: 'center', justifyContent: 'center', shadowColor: theme.shadowPrimary, shadowOffset: { width: 0, height: 8 }, shadowRadius: 16, shadowOpacity: 1, elevation: 6 },
  avatarEmoji: { fontSize: 46 },
  name: { marginTop: 14, fontSize: 26, fontWeight: '900', color: theme.ink, letterSpacing: 1 },
  dynasty: { marginTop: 4, fontSize: 13, color: theme.primaryDeep, fontWeight: '800' },
  slogan: { marginTop: 8, fontSize: 13, color: theme.inkSoft, textAlign: 'center', paddingHorizontal: 24, lineHeight: 20 },
  statsRow: { flexDirection: 'row', gap: 28, marginTop: 18, backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 20, paddingVertical: 12, paddingHorizontal: 24 },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '900', color: theme.ink },
  statLabel: { fontSize: 11, color: theme.muted, fontWeight: '600', marginTop: 2 },
  tabBar: { backgroundColor: theme.bgRoot, shadowColor: 'transparent', elevation: 0, borderBottomWidth: 1, borderBottomColor: theme.line },
  tabContent: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 40 },
  sectionCard: { backgroundColor: theme.surface, borderRadius: 22, padding: 18, marginBottom: 14, shadowColor: theme.shadowSoft, shadowOffset: { width: 0, height: 5 }, shadowRadius: 12, shadowOpacity: 1, elevation: 3 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: theme.primaryDeep, marginBottom: 10 },
  bioText: { fontSize: 15, lineHeight: 26, color: theme.ink },
  genRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  genTxt: { fontSize: 13, color: theme.muted, fontWeight: '600' },
  workCard: { flexDirection: 'row', gap: 12, backgroundColor: theme.surface, borderRadius: 20, padding: 16, marginBottom: 12, shadowColor: theme.shadowSoft, shadowOffset: { width: 0, height: 5 }, shadowRadius: 12, shadowOpacity: 1, elevation: 3 },
  workEmoji: { fontSize: 28 },
  workName: { fontSize: 16, fontWeight: '800', color: theme.ink },
  workMeta: { fontSize: 12, color: theme.muted, marginTop: 3, fontWeight: '600' },
  workDesc: { fontSize: 13, color: theme.inkSoft, marginTop: 6, lineHeight: 19 },
  relCard: { flexDirection: 'row', gap: 12, backgroundColor: theme.surface, borderRadius: 20, padding: 14, marginBottom: 12, shadowColor: theme.shadowSoft, shadowOffset: { width: 0, height: 5 }, shadowRadius: 12, shadowOpacity: 1, elevation: 3 },
  relAvatar: { width: 44, height: 44, borderRadius: 14, backgroundColor: theme.bgSoft, alignItems: 'center', justifyContent: 'center' },
  poemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.surface, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 10, shadowColor: theme.shadowSoft, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10, shadowOpacity: 1, elevation: 3 },
  poemDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.primary },
  poemRowTitle: { fontSize: 15, fontWeight: '700', color: theme.ink, flex: 1 },
  relTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  relName: { fontSize: 15, fontWeight: '800', color: theme.ink },
  relTag: { backgroundColor: theme.bgSoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  relTagTxt: { fontSize: 11, color: theme.primaryDeep, fontWeight: '700' },
  relNote: { fontSize: 13, color: theme.inkSoft, marginTop: 6, lineHeight: 19 },
});