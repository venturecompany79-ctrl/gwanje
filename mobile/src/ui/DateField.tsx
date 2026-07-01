import { Platform, StyleSheet, TextInput } from "react-native";
import { colors } from "@/design/tokens";

/** 자유 입력 문자열을 YYYY-MM-DD 형태로 정규화 (네이티브 폴백용) */
function formatDate(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  const parts = [digits.slice(0, 4), digits.slice(4, 6), digits.slice(6, 8)].filter(
    Boolean,
  );
  return parts.join("-");
}

/**
 * 마감일 입력 필드.
 * - 웹: 브라우저 네이티브 날짜 선택기(`<input type="date">`)를 그대로 사용.
 * - 네이티브(iOS/Android): 숫자 입력을 YYYY-MM-DD로 자동 포맷하는 텍스트 필드.
 */
export function DateField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  if (Platform.OS === "web") {
    return (
      <input
        type="date"
        value={value}
        onChange={(event) => onChange((event.target as { value: string }).value)}
        style={{
          border: "none",
          outline: "none",
          background: "transparent",
          fontSize: 16,
          fontWeight: 500,
          letterSpacing: -0.3,
          color: value ? colors.label : colors.tertiaryLabel,
          fontFamily: "inherit",
          textAlign: "right",
          padding: 0,
          colorScheme: "light",
        }}
      />
    );
  }

  return (
    <TextInput
      value={value}
      onChangeText={(text) => onChange(formatDate(text))}
      placeholder="YYYY-MM-DD"
      placeholderTextColor={colors.tertiaryLabel}
      keyboardType="number-pad"
      maxLength={10}
      style={styles.input}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    minWidth: 128,
    fontSize: 16,
    fontWeight: "500",
    letterSpacing: -0.3,
    color: colors.label,
    textAlign: "right",
    paddingVertical: 2,
  },
});
