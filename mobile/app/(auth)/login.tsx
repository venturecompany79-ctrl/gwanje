import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Redirect } from "expo-router";
import * as Haptics from "expo-haptics";
import { AlertTriangle, Eye, EyeOff } from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import { colors, radius, spacing, typography } from "@/design/tokens";
import { PrimaryButton } from "@/ui/Primitives";

export default function LoginScreen() {
  const { session, signIn, envReady } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brand}>
          <Text style={styles.mark}>관</Text>
          <Text style={styles.brandName}>관제</Text>
          <Text style={styles.subtitle}>중소기업 인증·지원·융자 관제 데스크</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>로그인</Text>
            <Text style={styles.cardCopy}>
              기존 웹 계정으로 모바일 운영 앱에 접속합니다.
            </Text>
          </View>

          {!envReady ? (
            <View style={styles.notice}>
              <AlertTriangle size={17} color={colors.attention} />
              <Text style={styles.noticeText}>
                앱 설정을 확인하면 로그인할 수 있습니다.
              </Text>
            </View>
          ) : null}

          <View style={styles.field}>
            <Text style={styles.label}>이메일</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.stone}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>비밀번호</Text>
            <View style={styles.passwordBox}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="비밀번호"
                placeholderTextColor={colors.stone}
                secureTextEntry={!showPassword}
                style={styles.passwordInput}
              />
              <Pressable
                style={styles.eyeButton}
                onPress={() => setShowPassword((value) => !value)}
              >
                {showPassword ? (
                  <EyeOff size={18} color={colors.stone} />
                ) : (
                  <Eye size={18} color={colors.stone} />
                )}
              </Pressable>
            </View>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <AlertTriangle size={16} color={colors.critical} />
              <Text style={styles.error}>{error}</Text>
            </View>
          ) : null}

          <PrimaryButton
            disabled={pending || !email || !password}
            onPress={submit}
          >
            {pending ? "확인 중..." : "로그인"}
          </PrimaryButton>

          <Pressable>
            <Text style={styles.help}>
              회원가입과 결제 관리는 웹에서 진행합니다.
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.grouped,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.xl,
  },
  brand: {
    alignItems: "center",
    gap: spacing.sm,
  },
  mark: {
    width: 56,
    height: 56,
    borderRadius: radius.xl,
    overflow: "hidden",
    backgroundColor: colors.brand,
    color: colors.canvas,
    textAlign: "center",
    lineHeight: 56,
    fontSize: 24,
    fontWeight: "800",
    ...Platform.select({
      web: {
        boxShadow: "0 6px 18px rgba(0,100,224,.28)",
      },
      default: {},
    }),
  },
  brandName: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "800",
    color: colors.inkDeep,
    marginTop: spacing.xs,
  },
  subtitle: {
    ...typography.footnote,
    color: colors.stone,
    textAlign: "center",
  },
  card: {
    backgroundColor: colors.canvas,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairlineSoft,
    padding: spacing.xl,
    gap: spacing.base,
    ...Platform.select({
      web: {
        boxShadow: "0 4px 20px rgba(10,19,23,.06)",
      },
      default: {},
    }),
  },
  cardHeader: {
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  cardTitle: {
    ...typography.title2,
    color: colors.inkDeep,
  },
  cardCopy: {
    ...typography.footnote,
    color: colors.secondaryLabel,
  },
  notice: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start",
    backgroundColor: colors.attentionSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.attentionBorder,
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  noticeText: {
    ...typography.footnote,
    color: colors.attention,
    flex: 1,
    fontWeight: "700",
  },
  field: {
    gap: spacing.xs,
  },
  label: {
    ...typography.footnote,
    color: colors.ink,
    fontWeight: "700",
  },
  input: {
    minHeight: 46,
    borderRadius: radius.lg,
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: spacing.md,
    ...typography.callout,
    color: colors.ink,
  },
  passwordBox: {
    minHeight: 46,
    borderRadius: radius.lg,
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.hairline,
    flexDirection: "row",
    alignItems: "center",
  },
  passwordInput: {
    flex: 1,
    minHeight: 46,
    paddingHorizontal: spacing.md,
    ...typography.callout,
    color: colors.ink,
  },
  eyeButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  error: {
    ...typography.footnote,
    color: colors.critical,
    fontWeight: "700",
    flex: 1,
  },
  help: {
    ...typography.footnote,
    color: colors.stone,
    textAlign: "center",
    paddingTop: spacing.xs,
  },
});
