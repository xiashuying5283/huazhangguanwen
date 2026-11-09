import { Stack } from 'expo-router';
import { theme } from '@/theme';

export const unstable_settings = { initialRouteName: 'index' };

export default function ProfileLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.bgRoot } }} />;
}
