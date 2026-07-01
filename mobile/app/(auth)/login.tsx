import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Redirect } from "expo-router";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/context/AuthContext";
import { colors, radius, spacing, typography } from "@/design/tokens";
import { PrimaryButton } from "@/ui/Primitives";

export default function LoginScreen() {
  const { session, signIn, envReady } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!envReady) {
      setError("모바일 env를 먼저 설정해 주세요.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await signIn(email, password);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setError(err instanceof Error ? err.message : "로그인에 실패했습니다.");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setPending(false);
    }
  }

  if (session) {
    return <Redirect href="/" />;
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.root}
    >
      <View style={styles.card}>
        <View style={styles.brand}>
          <Text style={styles.mark}>관</Text>
          <View>
            <Text style={styles.title}>관제</Text>
            <Text style={styles.subtitle}>모바일 운영 보조 앱</Text>
          </View>
        </View>

        {!envReady ? (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>
              `.env`에 Supabase URL, publishable key, Web API base URL을 설정하면
              로그인할 수 있습니다.
            </Text>
          </View>
        ) : null}

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="이메일"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="비밀번호"
          secureTextEntry
          style={styles.input}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <PrimaryButton
          disabled={pending || !email || !password}
          onPress={submit}
        >
          {pending ? "확인 중..." : "로그인"}
        </PrimaryButton>

        <Pressable>
          <Text style={styles.help}>회원가입과 결제 관리는 웹에서 진행합니다.</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.grouped,
    justifyContent: "center",
    padding: spacing.lg,
  },
  card: {
    gap: spacing.base,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  mark: {
    width: 58,
    height: 58,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: colors.ink,
    color: colors.canvas,
    textAlign: "center",
    lineHeight: 58,
    fontSize: 24,
    fontWeight: "800",
  },
  title: {
    ...typography.largeTitle,
    color: colors.label,
  },
  subtitle: {
    ...typography.callout,
    color: colors.secondaryLabel,
  },
  notice: {
    backgroundColor: colors.attentionSoft,
    padding: spacing.base,
    borderRadius: radius.lg,
  },
  noticeText: {
    ...typography.callout,
    color: colors.attention,
  },
  input: {
    minHeight: 54,
    borderRadius: radius.lg,
    backgroundColor: colors.canvas,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
    paddingHorizontal: spacing.base,
    ...typography.body,
    color: colors.label,
  },
  error: {
    ...typography.callout,
    color: colors.critical,
  },
  help: {
    ...typography.footnote,
    color: colors.secondaryLabel,
    textAlign: "center",
  },
});
