import { Redirect, Tabs } from "expo-router";
import { StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import {
  Bell,
  Building2,
  CalendarDays,
  ClipboardList,
  Home,
} from "@/ui/Icons";
import { colors } from "@/design/tokens";
import { useAuth } from "@/context/AuthContext";

const ICON_SIZE = 25;

export default function TabLayout() {
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  // 웹은 insets.bottom이 0이라 최소 패딩을 보장해야 라벨이 화면 바닥에 붙지 않는다
  const bottomInset = Math.max(insets.bottom, 8);

  if (!session) {
    return <Redirect href="/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarLabelStyle: styles.label,
        tabBarIconStyle: styles.icon,
        tabBarStyle: [
          styles.tabBar,
          // 탭 아이템 자체 높이(패딩 10 + 아이콘 28 + 라벨 13)가 들어갈 공간 확보
          { height: 58 + bottomInset, paddingBottom: bottomInset, paddingTop: 4 },
        ],
        tabBarBackground: () => (
          <BlurView intensity={90} tint="light" style={StyleSheet.absoluteFill} />
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "홈",
          tabBarIcon: ({ color }) => <Home size={ICON_SIZE} color={color} strokeWidth={1.9} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "알림",
          tabBarIcon: ({ color }) => <Bell size={ICON_SIZE} color={color} strokeWidth={1.9} />,
        }}
      />
      <Tabs.Screen
        name="today"
        options={{
          title: "오늘",
          tabBarIcon: ({ color }) => (
            <CalendarDays size={ICON_SIZE} color={color} strokeWidth={1.9} />
          ),
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: "Task",
          tabBarIcon: ({ color }) => (
            <ClipboardList size={ICON_SIZE} color={color} strokeWidth={1.9} />
          ),
        }}
      />
      <Tabs.Screen
        name="companies"
        options={{
          title: "기업",
          tabBarIcon: ({ color }) => (
            <Building2 size={ICON_SIZE} color={color} strokeWidth={1.9} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: "absolute",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separatorStrong,
    backgroundColor: colors.tabBar,
    elevation: 0,
  },
  label: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "500",
    letterSpacing: -0.1,
    marginTop: 1,
  },
  icon: {
    marginBottom: 0,
  },
});
