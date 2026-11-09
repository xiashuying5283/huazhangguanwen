import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { Screen } from '@/components/Screen';
import { Api, type PoemDetail, type PinyinChar } from '@/utils/api';
import { getDeviceId } from '@/utils/device';
import { SHADOW_SOFT, theme } from '@/theme';

type TabKey = 'annotation' | 'translate' | 'appreciate';

export default function ReadScreen() {
  const insets = useSafeAreaInsets();
  const router = useSafeRouter();
  const { id } = useSafeSearchParams<{ id: string }>();
  const [poem, setPoem] = useState<PoemDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<TabKey>('annotation');
  const [traditional, setTraditional] = useState(false);
  const [showPinyin, setShowPinyin] = useState(true);
  const [genState, setGenState] = useState<'idle' | 'generating' | 'done'>('idle');
  const genDoneFor = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true); setError('');
      try {
        // 服务端文件：server/src/routes/content.ts
        // 接口：GET /api/v1/poems/:id ；Path 参数：id: string
        const data = await Api.get<PoemDetail>(`/api/v1/poems/${id}`);
        setPoem(data);
      } catch (e) { setError((e as Error).message); }
      setLoading(false);
    })();
  }, [id]);

  // 记录一次阅读习惯（用于个性化推荐）
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const deviceId = await getDeviceId();
      if (cancelled) return;
      // 服务端文件：server/src/routes/content.ts
      // 接口：POST /api/v1/history ；Body：device_id: string, poem_id: string, action?: 'read'|'search'
      Api.post('/api/v1/history', { device_id: deviceId, poem_id: id, action: 'read' }).catch(() => undefined);
    })();
    return () => { cancelled = true; };
  }, [id]);

  // 注解/翻译/赏析缺失时，自动调用大模型生成并缓存
  useEffect(() => {
    if (!poem || genState === 'generating') return;
    const hasAll = !!(poem.annotation && poem.translation && poem.appreciation);
    if (hasAll || genDoneFor.current.has(poem.id)) { setGenState('done'); return; }
    genDoneFor.current.add(poem.id);
    setGenState('generating');
    (async () => {
      try {
        await Api.post('/api/v1/ai/analysis', { poem_id: poem.id });
      } catch (e) {
        console.warn('ai/analysis failed', e);
      }
      try {
        const d: any = await Api.get(`/api/v1/poems/${poem.id}`);
        if (d) setPoem(d);
      } catch { /* 忽略刷新失败 */ }
      setGenState('done');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poem?.id]);

  const tabs: { key: TabKey; title: string }[] = [
    { key: 'annotation', title: '注解' },
    { key: 'translate', title: '翻译' },
    { key: 'appreciate', title: '赏析' },
  ];

  return (
    <Screen backgroundColor={theme.bgRoot} safeAreaEdges={['top', 'left', 'right']} style={{ flex: 1 }}>
      {/* 宣纸 + 隐现远山底纹 */}
      <Image source={require('@/assets/guanwen/backgrounds/mountains_fog.png')} style={styles.verseBg} resizeMode="cover" />
      <View style={{ paddingTop: insets.top + 6, flex: 1 }}>
        <View style={styles.navRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
            <Text style={styles.backIcon}>‹</Text>
          </Pressable>
          <Text style={styles.navTitle}>精读</Text>
          <Pressable style={styles.backBtn} onPress={() => setShowPinyin((v) => !v)} hitSlop={10}>
            <Text style={styles.navToggleTxt}>拼</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.center}><ActivityIndicator color={theme.primary} /></View>
        ) : error ? (
          <View style={styles.center}><Text style={styles.error}>{error}</Text></View>
        ) : poem ? (
          <View style={{ flex: 1 }}>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
              {/* 诗文头部 */}
              <View style={styles.hero}>
                <Image source={require('@/assets/guanwen/circles/plum_branch.png')} style={styles.heroOrn} />
                <Text style={styles.genrePill}>{poem.genre}{poem.work_name ? ` · ${poem.work_name}` : ''}</Text>
                <Text style={styles.title}>{poem.title}</Text>
                <Text style={styles.byline}>{poem.dynasty} · {poem.author_name}</Text>

                {/* 简繁切换 */}
                <View style={styles.transformRow}>
                  <Pressable style={[styles.transformBtn, !traditional && styles.transformActive]} onPress={() => setTraditional(false)}>
                    <Text style={[styles.transformTxt, !traditional && styles.transformTxtActive]}>简体</Text>
                  </Pressable>
                  <Pressable style={[styles.transformBtn, traditional && styles.transformActive]} onPress={() => setTraditional(true)}>
                    <Text style={[styles.transformTxt, traditional && styles.transformTxtActive]}>繁體</Text>
                  </Pressable>
                </View>

                {/* 原文 + 拼音 */}
                <PoemBody
                  content={traditional ? (poem.content_traditional ?? poem.content) : poem.content}
                  pinyin={showPinyin ? poem.pinyin : undefined}
                />
              </View>

              {/* 段落切换 */}
              <View style={styles.segRow}>
                {tabs.map((t) => (
                  <Pressable key={t.key} onPress={() => setTab(t.key)}
                    style={[styles.segItem, tab === t.key && styles.segItemActive]}>
                    <Text style={[styles.segTxt, tab === t.key && styles.segTxtActive]}>{t.title}</Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.detailCard}>
                {tab === 'annotation' && <Section label="注解" text={poem.annotation ?? ''} generating={genState === 'generating' && !poem.annotation} perLine />}
                {tab === 'translate' && <Section label="现代翻译" text={poem.translation ?? ''} generating={genState === 'generating' && !poem.translation} />}
                {tab === 'appreciate' && <Section label="赏析" text={poem.appreciation ?? ''} generating={genState === 'generating' && !poem.appreciation} />}
              </View>
            </ScrollView>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

function PoemBody({ content, pinyin }: { content: string; pinyin?: PinyinChar[][] | null }) {
  const lines = content.split('\n');
  return (
    <View style={styles.verseBlock}>
      {lines.map((line, i) => {
        if (!line) return <View key={i} style={{ height: 16 }} />;
        const chars = Array.from(line);
        const pyLine = pinyin?.[i];
        if (pinyin && pyLine) {
          return (
            <View key={i} style={styles.pyLine}>
              {chars.map((ch, j) => (
                <View key={j} style={styles.charCol}>
                  <Text style={styles.pyText}>{pyLine[j]?.p ?? (ch.match(/[\u4e00-\u9fff]/) ? '' : '')}</Text>
                  <Text style={styles.charText}>{ch}</Text>
                </View>
              ))}
            </View>
          );
        }
        return <Text key={i} style={styles.plainVerse}>{line}</Text>;
      })}
    </View>
  );
}

function Section({ label, text, generating, perLine }: { label: string; text: string; generating?: boolean; perLine?: boolean }) {
  let content: string;
  if (generating) {
    content = '正在用大模型生成中，请稍候…';
  } else if (text) {
    content = text;
  } else {
    content = '暂无' + label + '，可下拉或稍后重试。';
  }
  const lines: string[] = perLine && !!text
    ? content.replace(/[。！？;；]/g, (m) => m + '\n').split('\n').map((s) => s.trim()).filter(Boolean)
    : [content];
  return (
    <View>
      <Text style={styles.sectionLabel}>{label}{generating ? '（生成中…）' : ''}</Text>
      {lines.map((ln, i) => (
        <Text key={i} style={styles.sectionText}>{ln}</Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: 6 },
  backBtn: { width: 40, height: 40, borderRadius: 14, backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center', shadowColor: theme.shadowSoft, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10, shadowOpacity: 1, elevation: 3 },
  backIcon: { fontSize: 30, color: theme.ink, marginTop: -2 },
  navTitle: { fontSize: 16, fontWeight: '800', color: theme.ink },
  navToggleTxt: { fontSize: 15, fontWeight: '900', color: theme.primaryDeep },
  center: { alignItems: 'center', paddingTop: 100 },
  error: { color: theme.primaryDeep, fontWeight: '600' },
  body: { paddingHorizontal: 20, paddingBottom: 48 },
  verseBg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', opacity: 0.07 },
  hero: {
    backgroundColor: '#F3EBDB', borderRadius: 28, paddingVertical: 28, paddingHorizontal: 22, alignItems: 'center',
    ...SHADOW_SOFT, marginBottom: 18, overflow: 'hidden',
  },
  heroOrn: { position: 'absolute', top: 12, right: 12, width: 46, height: 46, borderRadius: 23, opacity: 0.92 },
  genrePill: { backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, fontSize: 11, color: theme.primaryDeep, fontWeight: '800', overflow: 'hidden' },
  title: { marginTop: 14, fontSize: 30, fontWeight: '900', color: theme.ink, letterSpacing: 2, textAlign: 'center' },
  byline: { marginTop: 8, fontSize: 14, color: theme.inkSoft, fontWeight: '700' },
  transformRow: { flexDirection: 'row', marginTop: 18, backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 999, padding: 3 },
  transformBtn: { borderRadius: 999, paddingHorizontal: 18, paddingVertical: 7 },
  transformActive: { backgroundColor: theme.primary },
  transformTxt: { fontSize: 13, color: theme.inkSoft, fontWeight: '700' },
  transformTxtActive: { color: '#fff' },
  verseBlock: { marginTop: 22, alignItems: 'center', width: '100%' },
  pyLine: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', rowGap: 2, marginBottom: 2 },
  charCol: { alignItems: 'center', marginHorizontal: 3, marginBottom: 8 },
  pyText: { fontSize: 9.5, color: theme.primaryDeep, fontWeight: '700', marginBottom: 2, height: 13 },
  charText: { fontSize: 21, color: theme.ink, fontWeight: '600' },
  plainVerse: { fontSize: 20, lineHeight: 36, color: theme.ink, textAlign: 'center', fontWeight: '600', marginBottom: 6 },
  segRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 18, padding: 4, marginBottom: 14, gap: 4 },
  segItem: { flex: 1, borderRadius: 14, paddingVertical: 9, alignItems: 'center' },
  segItemActive: { backgroundColor: theme.primary },
  segTxt: { fontSize: 13, color: theme.inkSoft, fontWeight: '700' },
  segTxtActive: { color: '#fff' },
  detailCard: { backgroundColor: theme.surface, borderRadius: 24, padding: 20, ...SHADOW_SOFT },
  sectionLabel: { fontSize: 14, fontWeight: '800', color: theme.primaryDeep, marginBottom: 10 },
  sectionText: { fontSize: 15, lineHeight: 27, color: theme.ink },
});