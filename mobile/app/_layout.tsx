import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Platform, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { colors, typography } from "@/design/tokens";

function RootStack() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loading}>
        <Text style={styles.mark}>관</Text>
        <Text style={styles.loadingText}>관제 준비 중</Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.grouped },
        }}
      >
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="task/[id]"
          options={{
            presentation: "transparentModal",
            animation: "fade",
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="company/[id]"
          options={{
            headerShown: false,
          }}
        />
      </Stack>
    </>
  );
}

export default function Layout() {
  return (
    <GestureHandlerRootView style={styles.host}>
      <View style={styles.appFrame}>
        <SafeAreaProvider>
          <AuthProvider>
            <RootStack />
          </AuthProvider>
        </SafeAreaProvider>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
    backgroundColor: colors.stage,
    alignItems: "center",
  },
  appFrame: {
    flex: 1,
    width: "100%",
    backgroundColor: colors.grouped,
    ...Platform.select({
      web: {
        maxWidth: 430,
        minHeight: "100%",
        borderLeftWidth: StyleSheet.hairlineWidth,
        borderRightWidth: StyleSheet.hairlineWidth,
        borderColor: colors.hairlineSoft,
        shadowColor: colors.ink,
        shadowOpacity: 0.1,
        shadowRadius: 34,
        shadowOffset: { width: 0, height: 18 },
      },
      default: {},
    }),
  },
  loading: {
    flex: 1,
    backgroundColor: colors.grouped,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  mark: {
    width: 56,
    height: 56,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: colors.brand,
    color: colors.canvas,
    textAlign: "center",
    lineHeight: 56,
    fontSize: 24,
    fontWeight: "700",
  },
  loadingText: {
    ...typography.callout,
    color: colors.secondaryLabel,
  },
});
