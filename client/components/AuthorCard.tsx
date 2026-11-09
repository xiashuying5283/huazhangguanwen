import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import type { AuthorSummary } from '@/utils/api';
import { theme } from '@/theme';
import { Avatar, Ink } from '@/components/Paper';

export const AuthorCard = memo(function AuthorCard({ author }: { author: AuthorSummary }) {
  const router = useSafeRouter();
  return (
    <Pressable onPress={() => router.push('/poet-detail', { id: author.id })} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <Avatar name={author.name} size={54} />
      <View style={styles.info}>
        <Ink style={styles.name} numberOfLines={1}>{author.name}</Ink>
        <Ink style={styles.meta} numberOfLines={1}>{author.dynasty}</Ink>
        <Ink style={styles.bio} numberOfLines={1}>{author.bio ?? '暂无简介'}</Ink>
      </View>
      <View style={styles.countPill}><Ink style={styles.countTxt}>{author.poem_count ?? 0} 首</Ink></View>
      <FontAwesome6 name="angle-right" size={14} color={theme.muted} />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: theme.surface, borderRadius: 20, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: theme.line,
  },
  pressed: { opacity: 0.92 },
  thumb: { width: 54, height: 54, borderRadius: 27 },
  info: { flex: 1 },
  name: { fontSize: 17, fontWeight: '800', color: theme.ink },
  meta: { fontSize: 12, color: theme.primaryDeep, fontWeight: '700', marginTop: 2 },
  bio: { fontSize: 12, color: theme.muted, marginTop: 4, overflow: 'hidden' },
  countPill: { backgroundColor: '#ECE5D8', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  countTxt: { fontSize: 12, color: theme.primaryDeep, fontWeight: '700' },
});
