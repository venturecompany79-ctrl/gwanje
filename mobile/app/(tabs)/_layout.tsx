import { Tabs } from "expo-router";
import { StyleSheet } from "react-native";
import { BlurView } from "expo-blur";
import {
  Bell,
  Building2,
  ClipboardList,
  Home,
  ListTodo,
} from "lucide-react-native";
import { colors, typography } from "@/design/tokens";

const ICON_SIZE = 22;

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.tertiaryLabel,
        tabBarLabelStyle: {
          ...typography.caption,
          fontSize: 11,
        },
        tabBarStyle: styles.tabBar,
        tabBarBackground: () => (
          <BlurView intensity={88} tint="light" style={StyleSheet.absoluteFill} />
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "홈",
          tabBarIcon: ({ color }) => <Home size={ICON_SIZE} color={color} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "알림",
          tabBarIcon: ({ color }) => <Bell size={ICON_SIZE} color={color} />,
        }}
      />
      <Tabs.Screen
        name="today"
        options={{
          title: "오늘",
          tabBarIcon: ({ color }) => <ListTodo size={ICON_SIZE} color={color} />,
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: "Task",
          tabBarIcon: ({ color }) => <ClipboardList size={ICON_SIZE} color={color} />,
        }}
      />
      <Tabs.Screen
        name="companies"
        options={{
          title: "기업",
          tabBarIcon: ({ color }) => <Building2 size={ICON_SIZE} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: "absolute",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
    backgroundColor: "transparent",
  },
});
