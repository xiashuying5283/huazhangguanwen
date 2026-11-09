import { useEffect } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Ink, Paper } from '@/components/Paper';
import { art } from '@/data/art';
import { theme } from '@/theme';

export function Welcome({ onClose, automatic = false }: { onClose: () => void; automatic?: boolean }) {
  useEffect(() => {
    if (!automatic) return;
    const timer = setTimeout(onClose, 2200);
    return () => clearTimeout(timer);
  }, [onClose, automatic]);

  return (
    <Paper>
      <Pressable accessibilityLabel="进入观文" accessibilityRole="button" onPress={onClose} style={styles.cover}>
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Image source={art.welcomePlum} style={styles.plum} />
          <Image source={art.pines} style={styles.hills} />
          <Image source={art.welcomeLake} style={styles.lake} />
        </View>
        <View style={styles.brand}>
          <Ink style={styles.wordmark}>{'观\n文'}</Ink>
          <Ink style={styles.seal}>{'观\n阅'}</Ink>
          <Ink style={styles.motto}>{'读\n诗\n·\n读\n人\n·\n读\n典\n籍'}</Ink>
        </View>
      </Pressable>
    </Paper>
  );
}

const styles = StyleSheet.create({
  cover: { flex: 1, overflow: 'hidden', minHeight: 400 },
  plum: { position: 'absolute', left: 0, top: -3, width: '71%', height: '24%' },
  hills: { position: 'absolute', width: '100%', height: '49%', top: '19%', opacity: 0.49 },
  lake: { position: 'absolute', width: '100%', height: '41%', bottom: 0 },
  brand: { alignSelf: 'center', alignItems: 'center', marginTop: '26%' },
  wordmark: { fontSize: 70, lineHeight: 70, color: '#293229' },
  seal: { position: 'absolute', top: 100, right: -24, color: '#fff0df', backgroundColor: '#a54f37', fontSize: 11, lineHeight: 12, padding: 2, borderRadius: 4, textAlign: 'center' },
  motto: { color: theme.ink, fontSize: 17, lineHeight: 21, marginTop: 28, textAlign: 'center' },
});
