import { Stack, useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useEffect } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useColorScheme } from "react-native";
import { takeLicenseAcceptCallback } from "../lib/license-handoff";
import { LICENSE_TERMS_TEXT } from "../lib/licenseTerms";
import { radius, resolveTheme, spacing } from "../lib/theme";

// Static license-terms screen — the same fixed text every priced post is
// licensed under (see lib/licenseTerms.ts). Linked from both sides of a
// sale: the price-setting consent checkbox (capture.tsx, media/[id].tsx)
// and the Buy button on the media detail screen, so a buyer can read
// exactly what they're getting before paying.
//
// When opened with ?consent=1 (uploader agreeing to license a priced
// post), backing out or tapping I agree marks the checkbox on the
// previous screen via lib/license-handoff.ts.
export default function LicenseTermsScreen() {
  const scheme = useColorScheme();
  const c = resolveTheme(scheme);
  const router = useRouter();
  const navigation = useNavigation();
  const { consent } = useLocalSearchParams<{ consent?: string }>();
  const isConsent = consent === "1";

  useEffect(() => {
    if (!isConsent) return;
    const unsub = navigation.addListener("beforeRemove", () => {
      takeLicenseAcceptCallback()?.();
    });
    return unsub;
  }, [isConsent, navigation]);

  function acceptAndBack() {
    takeLicenseAcceptCallback()?.();
    router.back();
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: "License Terms",
          headerRight: isConsent
            ? () => (
                <Pressable onPress={acceptAndBack} hitSlop={8}>
                  <Text style={{ color: c.secondary, fontWeight: "600" }}>I agree</Text>
                </Pressable>
              )
            : undefined,
        }}
      />
      <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={styles.scroll}>
        <Text style={[styles.text, { color: c.text }]}>{LICENSE_TERMS_TEXT}</Text>
        {isConsent ? (
          <Pressable onPress={acceptAndBack} style={[styles.agreeButton, { backgroundColor: c.accent }]}>
            <Text style={[styles.agreeText, { color: c.accentText }]}>I agree</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, paddingBottom: spacing.xl },
  text: { fontSize: 14, lineHeight: 21 },
  agreeButton: {
    marginTop: spacing.lg,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 4,
    alignItems: "center",
  },
  agreeText: { fontWeight: "600", fontSize: 14 },
});
