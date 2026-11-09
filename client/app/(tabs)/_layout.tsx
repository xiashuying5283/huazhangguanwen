import { Tabs } from 'expo-router';
import { Platform, type ViewStyle } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { theme } from '@/theme';

export default function TabLayout() {
  let tabBarStyle: ViewStyle = {
    backgroundColor: theme.surface,
    borderTopWidth: 1,
    borderTopColor: theme.line,
  };

  // 用于修复 Web 上高度异常的问题（这个 if 逻辑必须添加）
  if (Platform.OS === 'web') {
    tabBarStyle = {
      ...tabBarStyle,
      height: 'auto',
    }
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle,
        tabBarActiveTintColor: theme.primaryDeep,
        tabBarInactiveTintColor: theme.muted,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '700' },
      }}
    >
      {/* name 必须与文件名完全一致 */}
      <Tabs.Screen
        name="index"
        options={{
          title: '首页',
          tabBarIcon: ({ color }) => (
            <FontAwesome6 name="house" size={19} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="poets"
        options={{
          title: '人物',
          tabBarIcon: ({ color }) => (
            <FontAwesome6 name="user-pen" size={20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: '文库',
          tabBarIcon: ({ color }) => (
            <FontAwesome6 name="book-open" size={19} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '我的',
          tabBarIcon: ({ color }) => (
            <FontAwesome6 name="heart" size={19} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}