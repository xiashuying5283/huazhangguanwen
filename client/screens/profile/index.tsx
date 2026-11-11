import { useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Ink, Message, Paper, Segments, type IconName, paperStyles as p } from '@/components/Paper';
import { DialogRow, PaperDialog } from '@/components/PaperDialog';
import { Welcome } from '@/components/Welcome';
import { setPreferences, useReadingShelf } from '@/contexts/ReadingShelf';
import { art } from '@/data/art';
import { useResource } from '@/hooks/useResource';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { Api, hasBackend } from '@/utils/api';
import { getDeviceId } from '@/utils/device';
import { routeForTitle } from '@/utils/drama';
import { shareText } from '@/utils/share';
import { theme } from '@/theme';

const settings = [
  ['阅读设置', 'settings-outline'],
  ['字体与排版', 'text-outline'],
  ['主题与背景', 'color-palette-outline'],
  ['数据与同步', 'sync-circle-outline'],
] as const satisfies ReadonlyArray<readonly [string, IconName]>;

const sizes = { 小字: 20, 中字: 23, 大字: 28 };
type FontLabel = keyof typeof sizes;
type Panel = typeof settings[number][0] | '读诗笔记' | '最近读过';

type History = {
  total: number; read_count: number; author_count: number;
  list: { poem_id: string; title: string; author_name?: string; dynasty?: string }[];
};

export default function ProfileScreen() {
  const router = useSafeRouter();
  const shelf = useReadingShelf();
  const { preferences, favorites, notes, history, readingDays } = shelf.data;
  const [panel, setPanel] = useState<Panel>();
  const [showWelcome, setShowWelcome] = useState(false);
  const [notice, setNotice] = useState('');
  const loadHistory = useCallback(async () => {
    if (!hasBackend || (panel !== '数据与同步' && panel !== '最近读过')) return undefined;
    const deviceId = await getDeviceId();
    return Api.get<History>(`/api/v1/history?device_id=${encodeURIComponent(deviceId)}&limit=30`);
  }, [panel]);
  const remote = useResource(loadHistory);
  const readings = new Map(history.map((poem) => [poem.id, poem]));
  const recent = [...history, ...(remote.data?.list ?? []).filter((poem) => !readings.has(poem.poem_id) && poem.title).map((poem) => ({ ...poem, id: poem.poem_id }))];
  const selectPanel = (value?: Panel) => { setNotice(''); setPanel(value); };

  if (showWelcome) return <Welcome onClose={() => setShowWelcome(false)} />;

  return (
    <Paper tab scene="blossom">
      <ScrollView style={p.scroll} contentContainerStyle={p.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Image source={art.mist} style={styles.avatar} />
          <Ink accessibilityRole="header" style={styles.name}>观文书客</Ink>
          <View style={styles.stats}>
            <Stat value={favorites.length} label="收藏" onPress={() => router.push('/profile/favorites')} />
            <Stat value={notes.length} label="笔记" onPress={() => selectPanel('读诗笔记')} />
            <Stat value={readingDays.length} label="阅读天数" last onPress={() => selectPanel('最近读过')} />
          </View>
        </View>
        <View style={[p.card, styles.settings]}>
          {settings.map(([label, icon]) => (
            <Pressable key={label} accessibilityRole="button" accessibilityLabel={label} onPress={() => selectPanel(label)} style={[p.row, p.divider, styles.setting]}>
              <Ionicons name={icon} size={23} color={theme.primaryDeep} />
              <Ink style={p.flex}>{label}</Ink>
              <Ionicons name="chevron-forward-outline" size={16} color={theme.primary} />
            </Pressable>
          ))}
        </View>
        {shelf.storageError && <Message>当前无法读取或保存本机数据</Message>}
      </ScrollView>
      {panel && <PaperDialog title={panel} onClose={() => selectPanel()}>
        {panel === '阅读设置' && <>
          <DialogRow onPress={() => setPreferences({ pinyin: !preferences.pinyin })}>{preferences.pinyin ? '关闭拼音标注' : '开启拼音标注'}</DialogRow>
          <DialogRow onPress={() => setPreferences({ traditional: !preferences.traditional })}>{preferences.traditional ? '切换简体正文' : '切换繁體正文'}</DialogRow>
        </>}
        {panel === '字体与排版' && <>
          <Segments options={Object.keys(sizes) as FontLabel[]} value={(Object.keys(sizes) as FontLabel[]).find((name) => sizes[name] === preferences.fontSize) ?? '中字'}
            onChange={(name) => setPreferences({ fontSize: sizes[name] })} />
          <Ink style={[styles.sample, { fontSize: preferences.fontSize }]}>明月松间照，清泉石上流。</Ink>
        </>}
        {panel === '主题与背景' && <>
          <Segments options={['宣纸', '暖笺']} value={preferences.paper} onChange={(paper) => setPreferences({ paper })} />
          <View style={[styles.sampleBox, preferences.paper === '暖笺' && styles.warm]}><Ink style={styles.sample}>松风入纸，展卷读诗。</Ink></View>
        </>}
        {panel === '数据与同步' && <>
          <Ink style={[p.meta, styles.info]}>{hasBackend ? '阅读记录通过当前设备编号与文库同步。收藏、笔记和设置保存在此设备。' : '当前使用内置选篇。收藏、笔记、设置与阅读记录保存在此设备。'}</Ink>
          {hasBackend && <DialogRow onPress={remote.retry}>{remote.loading ? '正在读取同步记录…' : `刷新同步记录 · ${remote.data?.read_count ?? 0} 次阅读`}</DialogRow>}
          {remote.error && <Message retry={remote.retry}>{remote.error}</Message>}
          <DialogRow onPress={async () => {
            try { setNotice(await shareText('观文书斋备份', JSON.stringify({ favorites, notes, preferences, history, readingDays }, null, 2)) ?? ''); }
            catch (error) { if ((error as Error).name !== 'AbortError') setNotice('当前无法导出'); }
          }}>导出本机数据</DialogRow>
          <DialogRow onPress={() => { selectPanel(); setShowWelcome(true); }}>查看观文扉页</DialogRow>
          {!!notice && <Message>{notice}</Message>}
        </>}
        {panel === '读诗笔记' && <>
          {notes.length === 0 && <Message>在精读页的阅读菜单中写下第一篇笔记</Message>}
          {notes.map(({ poem, text }) => <DialogRow key={poem.id} onPress={() => { selectPanel(); const r = routeForTitle(poem.title, poem.id); router.push(r.path, { id: r.id }); }}>{poem.title}{'\n'}{text.slice(0, 120)}</DialogRow>)}
        </>}
        {panel === '最近读过' && <>
          {recent.length === 0 && <Message>{remote.loading ? '正在载入阅读记录…' : '还没有阅读记录'}</Message>}
          {remote.error && <Message retry={remote.retry}>{remote.error}</Message>}
          {recent.map((poem) => <DialogRow key={poem.id} onPress={() => { selectPanel(); const r = routeForTitle(poem.title, poem.id); router.push(r.path, { id: r.id }); }}>{poem.title} · {poem.author_name ?? '佚名'}</DialogRow>)}
        </>}
      </PaperDialog>}
    </Paper>
  );
}

function Stat({ value, label, onPress, last }: { value: number; label: string; onPress: () => void; last?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={[styles.stat, last && styles.lastStat]}>
      <Ink style={styles.statNumber}>{value}</Ink><Ink style={styles.statLabel}>{label}</Ink>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', marginTop: 88, marginBottom: 21 },
  avatar: { width: 89, height: 89, borderRadius: 45, borderColor: '#fffaf1', borderWidth: 2 },
  name: { fontSize: 24, letterSpacing: 2, marginTop: 12 },
  stats: { flexDirection: 'row', alignItems: 'center', marginTop: 23, width: '90%' },
  stat: { flex: 1, alignItems: 'center', gap: 2, minHeight: 47, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: theme.line },
  lastStat: { borderRightWidth: 0 },
  statNumber: { fontSize: 24 },
  statLabel: { fontSize: 15, color: theme.inkSoft },
  settings: { paddingHorizontal: 17 },
  setting: { minHeight: 54, gap: 17 },
  sample: { textAlign: 'center', paddingVertical: 16 },
  sampleBox: { borderRadius: 10, marginTop: 12, backgroundColor: '#f5efe6' },
  warm: { backgroundColor: '#e9dfcc' },
  info: { marginBottom: 10, lineHeight: 24 },
});
