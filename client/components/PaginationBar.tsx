import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '@/theme';

interface Props {
  page: number;
  totalPages: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  loading?: boolean;
}

export function PaginationBar({ page, totalPages, total, onPrev, onNext, loading }: Props) {
  const canPrev = page > 1;
  const canNext = page < totalPages;
  return (
    <View style={styles.wrap}>
      <Text style={styles.caption}>共 {total} 项</Text>
      <View style={styles.row}>
        <Pressable
          style={[styles.btn, !canPrev && styles.disabled]}
          onPress={onPrev}
          disabled={!canPrev || loading}
        >
          <Text style={[styles.btnTxt, !canPrev && styles.disabledTxt]}>‹ 上一页</Text>
        </Pressable>
        <View style={styles.center}>
          {loading ? (
            <ActivityIndicator color={theme.primaryDeep} />
          ) : (
            <Text style={styles.pageTxt}>第 {page}<Text style={styles.slash}> / </Text>{totalPages || 1} 页</Text>
          )}
        </View>
        <Pressable
          style={[styles.btn, !canNext && styles.disabled]}
          onPress={onNext}
          disabled={!canNext || loading}
        >
          <Text style={[styles.btnTxt, !canNext && styles.disabledTxt]}>下一页 ›</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingTop: 16, paddingBottom: 28 },
  caption: { fontSize: 12, color: theme.muted, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  btn: {
    backgroundColor: theme.surface,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.line,
  },
  disabled: { opacity: 0.4 },
  btnTxt: { color: theme.primaryDeep, fontWeight: '700', fontSize: 13 },
  disabledTxt: { color: theme.muted },
  center: { minWidth: 96, alignItems: 'center' },
  pageTxt: { color: theme.ink, fontWeight: '800', fontSize: 13 },
  slash: { color: theme.muted, fontWeight: '500' },
});