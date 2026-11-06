import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { theme } from '@/theme';

interface Props {
  title: string;
  icon?: keyof typeof FontAwesome6.glyphMap;
  subtitle?: string;
  onSearch?: () => void;
}

export const AppHeader = memo(function AppHeader({ title, icon, subtitle, onSearch }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.left}>
        {icon ? (
          <View style={styles.iconWrap}>
            <FontAwesome6 name={icon} size={22} color={theme.primaryDeep} />
          </View>
        ) : null}
        <View>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      {onSearch ? (
        <Pressable onPress={onSearch} style={({ pressed }) => [styles.searchBtn, pressed && styles.pressed]}>
          <FontAwesome6 name="magnifying-glass" size={18} color={theme.primaryDeep} />
        </Pressable>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: {
    width: 46, height: 46, borderRadius: 16, backgroundColor: '#FFE3E6',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 26, fontWeight: '900', color: theme.ink, letterSpacing: 1 },
  subtitle: { fontSize: 12, color: theme.inkSoft, fontWeight: '600', marginTop: 3 },
  searchBtn: {
    width: 44, height: 44, borderRadius: 16, backgroundColor: theme.surface,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: theme.shadowSoft, shadowOffset: { width: 0, height: 5 }, shadowRadius: 12, shadowOpacity: 1, elevation: 4,
  },
  pressed: { opacity: 0.8, transform: [{ scale: 0.95 }] },
});