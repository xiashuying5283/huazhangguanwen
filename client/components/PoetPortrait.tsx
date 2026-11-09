import { Image, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, Ink, type IconName, paperStyles as p } from '@/components/Paper';
import { art } from '@/data/art';
import type { AuthorSummary } from '@/utils/api';
import { theme } from '@/theme';

export const poetActions = [
  { label: '生平年表', icon: 'calendar-outline' },
  { label: '代表作品', icon: 'book-outline' },
  { label: '人物关系', icon: 'people-outline' },
  { label: '评价', icon: 'ribbon-outline' },
] as const satisfies ReadonlyArray<{ label: string; icon: IconName }>;

export function PoetPortrait({ poet, onPress }: { poet: AuthorSummary; onPress?: () => void }) {
  const isLiBai = poet.name === '李白';
  const hero = <>
    <Image source={art.warm} style={styles.paper} />
    <Image source={art.hills} style={styles.mountains} />
    {isLiBai ? <View style={styles.illustration} pointerEvents="none">
      <Image source={art.liBai} style={styles.portraitImage} />
      <LinearGradient colors={['#efe4d4', '#efe4d400']} start={{ x: 0, y: 0 }} end={{ x: 0.2, y: 0 }} style={StyleSheet.absoluteFillObject} />
    </View> : <Avatar name={poet.name} size={116} style={styles.avatar} />}
    <View style={styles.copy}>
      <Ink style={styles.title}>{poet.name}</Ink>
      <Ink style={p.meta}>{poet.dynasty === '唐' ? '唐代诗人' : poet.dynasty}</Ink>
      {isLiBai && <><Ink style={p.meta}>诗仙</Ink><Ink style={styles.quote}>{'天生我材必有用，\n千金散尽还复来。'}</Ink></>}
    </View>
  </>;
  return onPress
    ? <Pressable accessibilityRole="button" accessibilityLabel={`查看${poet.name}`} onPress={onPress} style={styles.hero}>{hero}</Pressable>
    : <View style={styles.hero}>{hero}</View>;
}

export function PoetActions({ onSelect }: { onSelect: (action: typeof poetActions[number]['label']) => void }) {
  return <View style={[p.card, styles.actions]}>
    {poetActions.map(({ label, icon }) => (
      <Pressable key={label} style={styles.action} accessibilityRole="button" accessibilityLabel={label} onPress={() => onSelect(label)}>
        <Ionicons name={icon} size={22} color={theme.primaryDeep} />
        <Ink style={styles.actionLabel}>{label}</Ink>
      </Pressable>
    ))}
  </View>;
}

const styles = StyleSheet.create({
  hero: { borderRadius: 16, overflow: 'hidden', minHeight: 211, backgroundColor: '#ede1d1', justifyContent: 'center' },
  paper: { position: 'absolute', width: '100%', height: '100%' },
  mountains: { position: 'absolute', opacity: 0.33, right: 0, width: '100%', height: '100%' },
  illustration: { position: 'absolute', height: '100%', width: '46%', right: 0 },
  portraitImage: { width: '100%', height: '100%' },
  avatar: { position: 'absolute', right: 23 },
  copy: { padding: 20, alignSelf: 'flex-start', maxWidth: '63%' },
  title: { fontSize: 34, letterSpacing: 2 },
  quote: { marginTop: 15, fontSize: 17, lineHeight: 26 },
  actions: { flexDirection: 'row', gap: 8, padding: 9, marginTop: 3, marginBottom: 16 },
  action: { flex: 1, minHeight: 70, gap: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(215,197,172,0.20)', borderRadius: 11 },
  actionLabel: { fontSize: 14, textAlign: 'center' },
});
