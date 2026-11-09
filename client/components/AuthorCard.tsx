import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import type { AuthorSummary } from '@/utils/api';
import { theme } from '@/theme';

export const AuthorCard = memo(function AuthorCard({ author }: { author: AuthorSummary }) {
  const router = useSafeRouter();
  return (
    <Pressable
      onPress={() => router.push('/poet-detail', { id: author.id })}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={[styles.avatar, { backgroundColor: pick(author.id) }]}>
        <Text style={styles.avatarEmoji}>{author.avatar_emoji ?? ''}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{author.name}</Text>
        <Text style={styles.meta} numberOfLines={1}>{author.dynasty}</Text>
        <Text style={styles.bio} numberOfLines={1}>{author.bio ?? ''}</Text>
      </View>
      <View style={styles.countPill}>
        <Text style={styles.countTxt}>{author.poem_count ?? 0} 首</Text>
      </View>
      <FontAwesome6 name="chevron-right" size={14} color={theme.muted} />
    </Pressable>
  );
});

const AVATAR_BG = ['#E9EFE6', '#DCE8DA', '#E9E2D4', '#EFE3D2', '#E7E0D2', '#F0E9DD'];
function pick(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h + id.charCodeAt(i)) % 9973;
  return AVATAR_BG[h % AVATAR_BG.length];
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: theme.surface, borderRadius: 20, padding: 14, marginBottom: 12,
    shadowColor: theme.shadowSoft, shadowOffset: { width: 0, height: 6 }, shadowRadius: 14, shadowOpacity: 1, elevation: 3,
  },
  pressed: { opacity: 0.92 },
  avatar: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarEmoji: { fontSize: 26 },
  info: { flex: 1 },
  name: { fontSize: 17, fontWeight: '800', color: theme.ink },
  meta: { fontSize: 12, color: theme.primaryDeep, fontWeight: '700', marginTop: 2 },
  bio: { fontSize: 12, color: theme.muted, marginTop: 4, overflow: 'hidden' },
  countPill: { backgroundColor: theme.bgSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  countTxt: { fontSize: 12, color: theme.primaryDeep, fontWeight: '700' },
});