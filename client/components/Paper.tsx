import { Children, type ReactNode } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View, type StyleProp, type TextProps, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { art, coverFor, portraitFor } from '@/data/art';
import { theme } from '@/theme';

const displayFont = Platform.select({
  ios: 'Kaiti SC',
  android: 'serif',
  web: '"Kaiti SC", STKaiti, KaiTi, "Noto Serif CJK SC", "Songti SC", serif',
});

export function Ink({ style, ...props }: TextProps) {
  return <Text {...props} style={[styles.ink, style]} />;
}

export function Paper({ children, tab = false, scene, warm = false }: {
  children: ReactNode;
  tab?: boolean;
  scene?: 'mountain' | 'blossom' | 'read' | 'people';
  warm?: boolean;
}) {
  return (
    <Screen
      backgroundColor={warm ? '#e9dfcc' : theme.bgRoot}
      safeAreaEdges={tab ? ['top', 'left', 'right'] : ['top', 'bottom', 'left', 'right']}
      style={styles.sheet}
    >
      {[<View key="art" pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Image source={art.paper} style={[styles.fullImage, { opacity: warm ? 0.45 : 0.75 }]} />
        {(scene === 'mountain' || scene === 'people' || scene === 'blossom') && <Image source={art.hills} style={styles.highHills} />}
        {(scene === 'blossom' || scene === 'read') && <Image source={art.plum} style={[styles.plum, scene === 'read' && styles.readPlum]} resizeMode="contain" />}
        {scene === 'read' && <>
          <Image source={art.moon} style={styles.moon} resizeMode="contain" />
          <Image source={art.hills} style={styles.readHills} />
        </>}
      </View>, ...Children.toArray(children)]}
    </Screen>
  );
}

export type IconName = keyof typeof Ionicons.glyphMap;

export function IconButton({ icon, label, onPress, color = theme.ink, size = 23 }: {
  icon: IconName; label: string; onPress: () => void; color?: string; size?: number;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
      <Ionicons name={icon} size={size} color={color} />
    </Pressable>
  );
}

export function PageHeader({ title, back, centered, children, caption, fallback = '/' }: {
  title?: string; back?: boolean; centered?: boolean; children?: ReactNode; caption?: string; fallback?: string;
}) {
  const router = useSafeRouter();
  return (
    <View style={styles.header}>
      {back && <IconButton icon="chevron-back-outline" label="返回" onPress={() => router.canGoBack() ? router.back() : router.replace(fallback)} />}
      <View pointerEvents="none" style={centered ? styles.centeredTitle : styles.heading}>
        <Ink accessibilityRole={title ? 'header' : undefined} style={[styles.title, centered && styles.smallTitle]}>{title}</Ink>
        {caption && <Ink style={styles.caption}>{caption}</Ink>}
      </View>
      <View style={styles.actions}>{children}</View>
    </View>
  );
}

export function Segments<T extends string>({ options, value, onChange, pills = false }: {
  options: readonly T[]; value: T; onChange: (value: T) => void; pills?: boolean;
}) {
  return (
    <View style={[styles.segments, pills && styles.pills]}>
      {options.map((option) => (
        <Pressable key={option} accessibilityRole="tab" accessibilityState={{ selected: value === option }} onPress={() => onChange(option)}
          style={[styles.segment, pills && styles.pill, pills && value === option && styles.activePill]}>
          <Ink style={[styles.segmentText, value === option && styles.activeText, pills && value === option && styles.white]}>{option}</Ink>
          {!pills && value === option && <View style={styles.underline} />}
        </Pressable>
      ))}
    </View>
  );
}

export function Avatar({ name, size = 60, style }: { name: string; size?: number; style?: StyleProp<ViewStyle> }) {
  const source = portraitFor(name);
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }, style]}>
      {source ? <Image source={source} style={styles.fullImage} /> : <Ink style={{ fontSize: size * 0.36, color: theme.primaryDeep }}>{name.slice(0, 1)}</Ink>}
    </View>
  );
}

export function BookCover({ name, width = 84, height = 105 }: { name: string; width?: number; height?: number }) {
  const source = coverFor(name);
  return source
    ? <Image source={source} style={{ width, height, borderRadius: 4 }} resizeMode="stretch" />
    : <View style={[styles.book, { width, height }]}><Ink numberOfLines={5} style={styles.bookTitle}>{Array.from(name).slice(0, 5).join('\n')}</Ink></View>;
}

export function Message({ children, retry }: { children: ReactNode; retry?: () => void }) {
  return (
    <View style={styles.message}>
      <Ink style={styles.caption}>{children}</Ink>
      {retry && <Pressable accessibilityRole="button" onPress={retry} style={styles.retry}><Ink style={{ color: theme.primaryDeep }}>重新载入</Ink></Pressable>}
    </View>
  );
}

export const paperStyles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingHorizontal: 18, paddingBottom: 24 },
  card: { backgroundColor: 'rgba(255,250,241,0.48)', borderRadius: 15, overflow: 'hidden' },
  divider: { borderBottomColor: theme.line, borderBottomWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  flex: { flex: 1, minWidth: 0 },
  section: { fontSize: 22, marginBottom: 8 },
  itemTitle: { fontSize: 21, letterSpacing: 1 },
  meta: { fontSize: 15, color: theme.inkSoft, marginTop: 3 },
  body: { fontSize: 17, lineHeight: 28, color: theme.ink },
});

const styles = StyleSheet.create({
  sheet: { paddingTop: Platform.OS === 'web' ? 24 : 0 },
  ink: { color: theme.ink, fontFamily: displayFont, fontSize: 17 },
  fullImage: { width: '100%', height: '100%' },
  highHills: { width: '86%', height: 167, right: -25, top: 11, position: 'absolute', opacity: 0.28 },
  plum: { position: 'absolute', width: '66%', height: 154, right: -5, top: -24, opacity: 0.82 },
  readPlum: { right: '25%', top: -26, width: '62%', height: 140, transform: [{ rotate: '-17deg' }] },
  moon: { position: 'absolute', width: 49, height: 43, right: 30, top: 122, opacity: 0.83 },
  readHills: { position: 'absolute', width: '100%', height: 220, top: 240, opacity: 0.2 },
  header: { minHeight: 57, marginHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heading: { flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 15, marginLeft: 8 },
  centeredTitle: { position: 'absolute', left: 44, right: 44, alignItems: 'center' },
  title: { fontSize: 32, letterSpacing: 1.8, color: '#171d18' },
  smallTitle: { fontSize: 28 },
  caption: { color: theme.inkSoft, fontSize: 15, textAlign: 'center' },
  actions: { flexDirection: 'row', alignItems: 'center' },
  iconButton: { minWidth: 43, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.56 },
  segments: { flexDirection: 'row', borderBottomColor: theme.line, borderBottomWidth: StyleSheet.hairlineWidth },
  segment: { flex: 1, minHeight: 40, paddingVertical: 6, justifyContent: 'center', alignItems: 'center' },
  pills: { gap: 8, borderBottomWidth: 0 },
  pill: { borderRadius: 19, backgroundColor: 'rgba(213,199,177,0.26)', minHeight: 35 },
  activePill: { backgroundColor: theme.primary },
  segmentText: { fontSize: 17, textAlign: 'center', color: theme.inkSoft },
  activeText: { color: theme.ink },
  white: { color: '#fff9ed' },
  underline: { width: '52%', height: 2, backgroundColor: theme.primaryDeep, position: 'absolute', bottom: 0 },
  avatar: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#e4d7be', borderWidth: 1, borderColor: '#fff8ed' },
  book: { backgroundColor: '#667566', borderRadius: 4, borderLeftWidth: 6, borderLeftColor: '#494d37', alignItems: 'flex-start', justifyContent: 'center', paddingHorizontal: 8 },
  bookTitle: { backgroundColor: '#e5d5b6', fontSize: 12, paddingHorizontal: 2, textAlign: 'center' },
  message: { padding: 25, alignItems: 'center', gap: 10 },
  retry: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: theme.bgSoft },
});
