import { Tabs } from 'expo-router';
import { Platform, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/theme';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarStyle: styles.bar,
      tabBarActiveTintColor: theme.primaryDeep,
      tabBarInactiveTintColor: '#646550',
      tabBarLabelStyle: styles.label,
      sceneStyle: { backgroundColor: theme.bgRoot },
    }}>
      <Tabs.Screen name="index" options={{
        title: '首页',
        tabBarAccessibilityLabel: '首页',
        tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'home' : 'home-outline'} color={color} size={22} />,
      }} />
      <Tabs.Screen name="library" options={{
        title: '文库',
        tabBarAccessibilityLabel: '文库',
        tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'book' : 'book-outline'} color={color} size={22} />,
      }} />
      <Tabs.Screen name="poets" options={{
        title: '人物',
        tabBarAccessibilityLabel: '人物',
        tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'person' : 'person-outline'} color={color} size={22} />,
      }} />
      <Tabs.Screen name="profile" options={{
        title: '我的',
        tabBarAccessibilityLabel: '我的',
        tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'person-circle' : 'person-circle-outline'} color={color} size={23} />,
      }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: '#f4ece0',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.line,
    height: Platform.OS === 'web' ? 'auto' : undefined,
    paddingTop: 4,
    paddingBottom: Platform.OS === 'web' ? 8 : undefined,
  },
  label: {
    fontSize: 13,
    fontFamily: Platform.select({ ios: 'Kaiti SC', android: 'serif', web: '"Kaiti SC", STKaiti, KaiTi, serif' }),
  },
});
