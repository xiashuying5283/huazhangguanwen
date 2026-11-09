import { memo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import type { PoemSummary } from '@/utils/api';
import { pickCardBg, theme } from '@/theme';

const CIRCLES = [
  require('@/assets/guanwen/circles/misty_mountains.png'),
  require('@/assets/guanwen/circles/sunset_river.png'),
  require('@/assets/guanwen/circles/bamboo_grove.png'),
  require('@/assets/guanwen/circles/lotus_pond.png'),
  require('@/assets/guanwen/circles/plum_branch.png'),
  require('@/assets/guanwen/circles/sailing_boats.png'),
  require('@/assets/guanwen/circles/autumn_maples.png'),
  require('@/assets/guanwen/circles/snowy_pines.png'),
  require('@/assets/guanwen/circles/plum_pavilion.png'),
  require('@/assets/guanwen/circles/golden_fields.png'),
  require('@/assets/guanwen/circles/mountain_waterfall.png'),
  require('@/assets/guanwen/circles/winter_village.png'),
];

function excerpt(content: string): string {
  return (content || '').split('\n').slice(0, 2).join('\n');
}

export const PoemCard = memo(function PoemCard({ poem }: { poem: PoemSummary }) {
  const router = useSafeRouter();
  const bg = pickCardBg(poem.background_hint);
  const stamp = CIRCLES[Math.abs(Number(poem.id) || 0) % CIRCLES.length];
  return (
    <Pressable
      onPress={() => router.push('/read', { id: poem.id })}
      style={({ pressed }) => [styles.card, { backgroundColor: bg }, pressed && styles.pressed]}
    >
      <View style={styles.topRow}>
        <Image source={stamp} style={styles.stamp} />
        <View style={styles.badges}>
          {poem.genre ? <View style={styles.badge}><Text style={styles.badgeText}>{poem.genre}</Text></View> : null}
          <View style={styles.badge}><Text style={styles.badgeText}>{poem.dynasty}</Text></View>
        </View>
      </View>
      <Text style={styles.title} numberOfLines={1}>{poem.title}</Text>
      <Text style={styles.byline}>
        {poem.author_name ?? (poem.work_name ? poem.work_name : '佚名')}
      </Text>
      <Text style={styles.excerpt} numberOfLines={2}>{excerpt(poem.content)}</Text>
      <View style={styles.readRow}>
        <Text style={styles.readTxt}>开卷细读</Text>
        <FontAwesome6 name="arrow-right" size={12} color={theme.primaryDeep} />
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    padding: 16,
    marginBottom: 14,
  },
  pressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stamp: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(53,87,67,0.10)' },
  badges: { flexDirection: 'row', gap: 6 },
  badge: { backgroundColor: 'rgba(255,255,255,0.75)', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  badgeText: { color: theme.inkSoft, fontSize: 11, fontWeight: '700' },
  title: { marginTop: 12, fontSize: 18, fontWeight: '800', color: theme.ink },
  byline: { marginTop: 3, fontSize: 12, color: theme.inkSoft, fontWeight: '600' },
  excerpt: { marginTop: 10, fontSize: 14, lineHeight: 24, color: theme.ink, opacity: 0.85 },
  readRow: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  readTxt: { fontSize: 12, fontWeight: '700', color: theme.primaryDeep },
});