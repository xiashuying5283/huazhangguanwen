import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { IconButton, Ink } from '@/components/Paper';
import { theme } from '@/theme';

export function PaperDialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <Modal transparent visible animationType="fade" onRequestClose={onClose}>
    <View style={styles.overlay}>
      <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="关闭弹窗" onPress={onClose} />
      <View style={styles.panel} accessibilityViewIsModal>
        <View style={styles.header}><Ink style={styles.title}>{title}</Ink><IconButton icon="close-outline" label="关闭" onPress={onClose} /></View>
        <ScrollView keyboardShouldPersistTaps="handled" style={styles.content}>{children}</ScrollView>
      </View>
    </View>
  </Modal>;
}

export function DialogRow({ children, onPress }: { children: ReactNode; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={styles.row}><Ink>{children}</Ink></Pressable>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 18, backgroundColor: 'rgba(39,38,29,0.28)' },
  panel: { width: '100%', maxWidth: 430, maxHeight: '80%', backgroundColor: theme.bgRoot, borderRadius: 20, paddingHorizontal: 16, paddingBottom: 14 },
  header: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 24 },
  content: { flexGrow: 0 },
  row: { minHeight: 46, justifyContent: 'center', paddingHorizontal: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.line },
});
