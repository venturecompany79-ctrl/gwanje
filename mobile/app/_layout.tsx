import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { colors, typography } from "@/design/tokens";

function RootStack() {
  const { session, loading } = useAuth();

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
        {session ? (
          <>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="task/[id]"
              options={{
                presentation: "modal",
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="company/[id]"
              options={{
                headerShown: false,
              }}
            />
          </>
        ) : (
          <Stack.Screen name="(auth)" />
        )}
      </Stack>
    </>
  );
}

export default function Layout() {
  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <AuthProvider>
          <RootStack />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
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
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: colors.ink,
    color: colors.canvas,
    textAlign: "center",
    lineHeight: 56,
    fontSize: 24,
    fontWeight: "800",
  },
  loadingText: {
    ...typography.callout,
    color: colors.secondaryLabel,
  },
});
