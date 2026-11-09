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
  return (content || '').split('\n').slice(0, 2).join(' ');
}

export const PoemCard = memo(function PoemCard({ poem }: { poem: PoemSummary }) {
  const router = useSafeRouter();
  const bg = pickCardBg(poem.background_hint);
  const stamp = CIRCLES[Math.abs(Number(poem.id) || 0) % CIRCLES.length];
  return (
    <Pressable onPress={() => router.push('/read', { id: poem.id })} style={({ pressed }) => [styles.card, { backgroundColor: bg }, pressed && styles.pressed]}>
      <Image source={stamp} style={styles.thumb} />
      <View style={styles.body}>
        <View style={styles.topRow}>
          <Text style={styles.title} numberOfLines={1}>{poem.title}</Text>
          <FontAwesome6 name="angle-right" size={14} color="rgba(42,42,42,0.45)" />
        </View>
        <Text style={styles.meta} numberOfLines={1}>
          {poem.author_name ?? '佚名'}{poem.dynasty ? ` · ${poem.dynasty}` : ''}{poem.genre ? ` · ${poem.genre}` : ''}
        </Text>
        <Text style={styles.excerpt} numberOfLines={2}>{excerpt(poem.content)}</Text>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(228,219,198,0.55)',
  },
  pressed: { opacity: 0.9 },
  thumb: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(53,87,67,0.10)' },
  body: { flex: 1, marginLeft: 12 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { fontSize: 16, fontWeight: '800', color: theme.ink, flex: 1 },
  meta: { marginTop: 4, fontSize: 11, color: theme.muted, fontWeight: '700' },
  excerpt: { marginTop: 7, fontSize: 12.5, lineHeight: 20, color: theme.inkSoft },
});
