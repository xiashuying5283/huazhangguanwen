import { memo } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import type { PoemSummary } from '@/utils/api';
import { routeForTitle } from '@/utils/drama';
import { theme } from '@/theme';
import { Ink } from '@/components/Paper';
import { poemArt } from '@/data/art';

function excerpt(content: string): string {
  return (content || '').split('\n').slice(0, 2).join(' ');
}

export const PoemCard = memo(function PoemCard({ poem }: { poem: PoemSummary }) {
  const router = useSafeRouter();
  const stamp = poemArt(poem.title);
  return (
    <Pressable onPress={() => { const route = routeForTitle(poem.title, poem.id); router.push(route.path, { id: route.id }); }} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <Image source={stamp} style={styles.thumb} />
      <View style={styles.body}>
        <View style={styles.topRow}>
          <Ink style={styles.title} numberOfLines={1}>{poem.title}</Ink>
          <FontAwesome6 name="angle-right" size={14} color="rgba(42,42,42,0.45)" />
        </View>
        <Ink style={styles.meta} numberOfLines={1}>
          {poem.author_name ?? '佚名'}{poem.dynasty ? ` · ${poem.dynasty}` : ''}{poem.genre ? ` · ${poem.genre}` : ''}
        </Ink>
        <Ink style={styles.excerpt} numberOfLines={2}>{excerpt(poem.content)}</Ink>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.surface,
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
  title: { fontSize: 16, color: theme.ink, flex: 1 },
  meta: { marginTop: 4, fontSize: 11, color: theme.muted, fontWeight: '400' },
  excerpt: { marginTop: 7, fontSize: 12.5, lineHeight: 20, color: theme.inkSoft },
});
