import { Tabs } from 'expo-router';
import { Platform, type ViewStyle } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { theme } from '@/theme';

export default function TabLayout() {
  let tabBarStyle: ViewStyle = {
    backgroundColor: '#F7F2E8',
    borderTopWidth: 1,
    borderTopColor: theme.line,
    height: 66,
    paddingTop: 6,
    paddingBottom: 8,
  };

  if (Platform.OS === 'web') {
    tabBarStyle = {
      ...tabBarStyle,
      height: 'auto',
    };
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle,
        tabBarActiveTintColor: theme.primaryDeep,
        tabBarInactiveTintColor: '#8B8A80',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          marginTop: 1,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '首页',
          tabBarIcon: ({ color }) => <FontAwesome6 name="house" size={18} color={color} />,
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: '文库',
          tabBarIcon: ({ color }) => <FontAwesome6 name="book-open" size={18} color={color} />,
        }}
      />
      <Tabs.Screen
        name="poets"
        options={{
          title: '人物',
          tabBarIcon: ({ color }) => <FontAwesome6 name="user-pen" size={18} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '我的',
          tabBarIcon: ({ color }) => <FontAwesome6 name="user" size={18} color={color} />,
        }}
      />
    </Tabs>
  );
}
