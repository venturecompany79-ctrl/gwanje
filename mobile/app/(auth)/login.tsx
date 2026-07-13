import { useState } from "react";
import {
  Image,
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Lock, Mail } from "@/ui/Icons";
import { useAuth } from "@/context/AuthContext";
import { colors, radius } from "@/design/tokens";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { session, signIn, signInWithGoogle, gateError, clearGateError, envReady } =
    useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [googlePending, setGooglePending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = pending || googlePending;
  // 웹 리다이렉트 복귀 시 게이트 안내(예: 미가입 계정), 로컬 에러가 없을 때만 노출
  const shownError = error ?? gateError;

  async function submit() {
    if (busy) return;
    if (!envReady) {
      setError("모바일 env를 먼저 설정해 주세요.");
      return;
    }
    if (!email.trim() || !password) {
      setError("이메일과 비밀번호를 입력하세요.");
      return;
    }
    setPending(true);
    setError(null);
    clearGateError();
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

  async function submitGoogle() {
    if (busy) return;
    if (!envReady) {
      setError("모바일 env를 먼저 설정해 주세요.");
      return;
    }
    setGooglePending(true);
    setError(null);
    clearGateError();
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google 로그인에 실패했습니다.");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setGooglePending(false);
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
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 28 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brand}>
          <Image
            source={require("../../assets/images/gwanje-logo.png")}
            style={styles.logo}
            resizeMode="contain"
            accessible={false}
          />
          <Text style={styles.brandCopy}>컨설턴트 운영 콘솔</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.field}>
            <Mail size={18} color={colors.tertiaryLabel} strokeWidth={1.8} />
            <TextInput
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                setError(null);
              }}
              placeholder="이메일"
              placeholderTextColor={colors.tertiaryLabel}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="이메일"
              style={styles.input}
            />
          </View>
          <View style={styles.fieldSep} />
          <View style={styles.field}>
            <Lock size={18} color={colors.tertiaryLabel} strokeWidth={1.8} />
            <TextInput
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                setError(null);
              }}
              placeholder="비밀번호"
              placeholderTextColor={colors.tertiaryLabel}
              secureTextEntry={!showPassword}
              textContentType="password"
              autoComplete="current-password"
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="비밀번호"
              style={styles.input}
            />
            <Pressable
              onPress={() => setShowPassword((value) => !value)}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
              style={styles.toggleButton}
            >
              <Text style={styles.toggle}>{showPassword ? "숨김" : "보기"}</Text>
            </Pressable>
          </View>
        </View>

        {!envReady ? (
          <View style={styles.noticeRow}>
            <View style={styles.noticeDot} />
            <Text style={styles.noticeText}>앱 설정을 확인하면 로그인할 수 있습니다.</Text>
          </View>
        ) : null}

        {shownError ? (
          <View style={styles.errorRow}>
            <View style={styles.errorDot} />
            <Text accessibilityLiveRegion="polite" style={styles.errorText}>
              {shownError}
            </Text>
          </View>
        ) : null}

        <Pressable
          onPress={submit}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={pending ? "로그인 중" : "로그인"}
          accessibilityState={{ disabled: busy, busy: pending }}
          style={[styles.button, pending && styles.buttonPending]}
        >
          <Text style={styles.buttonText}>{pending ? "로그인 중…" : "로그인"}</Text>
        </Pressable>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>또는</Text>
          <View style={styles.dividerLine} />
        </View>

        <Pressable
          onPress={submitGoogle}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={googlePending ? "Google 인증 중" : "Google로 로그인"}
          accessibilityState={{ disabled: busy, busy: googlePending }}
          style={[styles.googleButton, googlePending && styles.googleButtonPending]}
        >
          <Text style={styles.googleG}>G</Text>
          <Text style={styles.googleText}>
            {googlePending ? "Google 인증 중…" : "Google로 로그인"}
          </Text>
        </Pressable>

        <View style={styles.spacer} />
        <Text style={styles.help}>
          회원가입과 결제 관리는 웹에서 진행합니다
        </Text>
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
    paddingHorizontal: 24,
  },
  brand: {
    alignItems: "center",
    gap: 15,
    paddingTop: "6%",
    paddingBottom: 34,
  },
  logo: {
    width: 274,
    height: 48,
  },
  brandCopy: {
    fontSize: 14.5,
    fontWeight: "500",
    letterSpacing: -0.2,
    color: colors.secondaryLabel,
    marginTop: -9,
  },
  form: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    overflow: "hidden",
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  fieldSep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.separator,
    marginLeft: 46,
  },
  input: {
    flex: 1,
    fontSize: 16,
    letterSpacing: -0.3,
    color: colors.label,
    padding: 0,
  },
  toggle: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: -0.2,
    color: colors.tertiaryLabel,
    width: 32,
    textAlign: "right",
  },
  toggleButton: {
    minWidth: 44,
    minHeight: 44,
    marginVertical: -12,
    marginRight: -8,
    alignItems: "center",
    justifyContent: "center",
  },
  noticeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 4,
    paddingTop: 11,
  },
  noticeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.attention,
  },
  noticeText: {
    fontSize: 13,
    fontWeight: "500",
    letterSpacing: -0.2,
    color: colors.attention,
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 4,
    paddingTop: 11,
  },
  errorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.critical,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "500",
    letterSpacing: -0.2,
    color: colors.critical,
  },
  button: {
    marginTop: 18,
    width: "100%",
    paddingVertical: 15,
    borderRadius: radius.card,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPending: {
    backgroundColor: "rgba(0,100,224,0.55)",
  },
  buttonText: {
    fontSize: 16.5,
    fontWeight: "600",
    letterSpacing: -0.3,
    color: colors.canvas,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 18,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.separator,
  },
  dividerText: {
    fontSize: 12.5,
    fontWeight: "500",
    letterSpacing: -0.2,
    color: colors.tertiaryLabel,
  },
  googleButton: {
    marginTop: 18,
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    paddingVertical: 14,
    borderRadius: radius.card,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separatorStrong,
  },
  googleButtonPending: {
    opacity: 0.6,
  },
  googleG: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.brand,
  },
  googleText: {
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: -0.3,
    color: colors.label,
  },
  spacer: {
    flexGrow: 1,
    minHeight: 24,
  },
  help: {
    textAlign: "center",
    fontSize: 12,
    fontWeight: "400",
    letterSpacing: -0.1,
    color: colors.tertiaryLabel,
    paddingTop: 18,
  },
});
