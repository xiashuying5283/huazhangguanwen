import { Stack, usePathname } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { Provider } from '@/components/Provider';
import { Welcome } from '@/components/Welcome';
import { dismissWelcome, useReadingShelf } from '@/contexts/ReadingShelf';
import { theme } from '@/theme';

import '../global.css';

export default function RootLayout() {
  const pathname = usePathname();
  const { data, ready } = useReadingShelf();
  return (
    <Provider>
      <View style={styles.app}>
        <Stack screenOptions={{
          animation: 'slide_from_right',
          gestureEnabled: true,
          gestureDirection: 'horizontal',
          headerShown: false,
          contentStyle: { backgroundColor: theme.bgRoot },
        }}>
          <Stack.Screen name="(tabs)" options={{ title: '观文' }} />
        </Stack>
        {ready && !data.welcomed && pathname === '/' && (
          <View style={styles.welcome}><Welcome automatic onClose={dismissWelcome} /></View>
        )}
        <Toast />
      </View>
    </Provider>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, width: '100%', maxWidth: Platform.OS === 'web' ? 510 : undefined, alignSelf: 'center' },
  welcome: { ...StyleSheet.absoluteFillObject, zIndex: 10 },
});
