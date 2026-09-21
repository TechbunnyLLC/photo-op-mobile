import { useStripe } from "@stripe/stripe-react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { useLicenseCart } from "../../lib/license-cart";
import { formatUsPrice } from "../../lib/media";
import { createLicensePaymentIntent } from "../../lib/payment";
import { radius, resolveTheme, spacing } from "../../lib/theme";
import type { MediaItem } from "../../lib/types";

const COL_GAP = spacing.sm;

export default function LicenseScreen() {
  const scheme = useColorScheme();
  const c = resolveTheme(scheme);
  const router = useRouter();
  const { user } = useAuth();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const {
    campaignName,
    campaignUse,
    setCampaignName,
    setCampaignUse,
    items: selected,
    add,
    remove,
    has,
    clear,
    total,
  } = useLicenseCart();

  const [listed, setListed] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);

  const load = useCallback(async () => {
    try {
      const feed = await api.getFeed();
      const forSale = feed.filter((item) => !!item.price && item.uploader.id !== user?.userId);
      setListed(forSale);
      setError(null);
    } catch (err: any) {
      const message =
        err?.errors?.[0]?.message ?? (err instanceof Error ? err.message : "Unknown error");
      setError(message);
    }
  }, [user?.userId]);

  useFocusEffect(
    useCallback(() => {
      load().finally(() => setLoading(false));
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  function toggle(item: MediaItem) {
    if (has(item.id)) remove(item.id);
    else add(item);
  }

  async function checkout() {
    const name = campaignName.trim();
    if (!name) {
      Alert.alert("Name the campaign", "Give this license package a name so you know what the spend is for.");
      return;
    }
    if (selected.length === 0) {
      Alert.alert("Nothing selected", "Tap assets below to add them to this campaign.");
      return;
    }
    if (!user) {
      Alert.alert("Sign in required", "Sign in to license media.");
      return;
    }

    setCheckingOut(true);
    try {
      const { clientSecret } = await createLicensePaymentIntent(selected.map((item) => item.id));
      const initResult = await initPaymentSheet({
        paymentIntentClientSecret: clientSecret,
        merchantDisplayName: "Photo-OP",
      });
      if (initResult.error) throw new Error(initResult.error.message);

      const presentResult = await presentPaymentSheet();
      if (presentResult.error) {
        if (presentResult.error.code !== "Canceled") {
          throw new Error(presentResult.error.message);
        }
        return;
      }

      const count = selected.length;
      const spent = formatUsPrice(total);
      clear();
      Alert.alert(
        "Licenses purchased",
        `${count} asset${count === 1 ? "" : "s"} licensed for “${name}” — ${spent}. They’re on your Licensed shelf.`,
        [{ text: "View licenses", onPress: () => router.push("/(tabs)/profile?shelf=licensed") }]
      );
    } catch (err) {
      Alert.alert("Couldn't complete purchase", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setCheckingOut(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: c.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <FlatList
        data={listed}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{ gap: COL_GAP, paddingHorizontal: spacing.md }}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={[styles.title, { color: c.text }]}>License a campaign</Text>
            <Text style={[styles.lede, { color: c.textMuted }]}>
              Name the use, pick priced media, pay. Photo-OP records the licenses — this isn’t ad serving.
            </Text>

            <TextInput
              value={campaignName}
              onChangeText={setCampaignName}
              placeholder="Campaign name (e.g. Super Bowl recap)"
              placeholderTextColor={c.textMuted}
              style={[styles.input, { borderColor: c.border, color: c.text, backgroundColor: c.surface }]}
            />
            <TextInput
              value={campaignUse}
              onChangeText={setCampaignUse}
              placeholder="Where it runs (optional)"
              placeholderTextColor={c.textMuted}
              style={[styles.input, { borderColor: c.border, color: c.text, backgroundColor: c.surface }]}
            />

            <Text style={[styles.sectionLabel, { color: c.text }]}>For sale</Text>
            {error ? (
              <Text style={[styles.empty, { color: c.textMuted }]}>Couldn't load listings: {error}</Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          !loading && !error ? (
            <Text style={[styles.empty, { color: c.textMuted }]}>
              Nothing listed for sale yet. Priced posts from Capture show up here.
            </Text>
          ) : null
        }
        renderItem={({ item }) => {
          const picked = has(item.id);
          return (
            <Pressable
              onPress={() => toggle(item)}
              onLongPress={() => router.push(`/media/${item.id}`)}
              style={[
                styles.tile,
                {
                  backgroundColor: c.surface,
                  borderColor: picked ? c.accent : c.border,
                },
              ]}
            >
              {item.thumbnailUrl ? (
                <Image source={{ uri: item.thumbnailUrl }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, { backgroundColor: c.background, alignItems: "center", justifyContent: "center" }]}>
                  <Text style={{ color: c.textMuted, fontSize: 11 }}>Processing…</Text>
                </View>
              )}
              <View style={styles.tileBody}>
                <Text style={[styles.tileTitle, { color: c.text }]} numberOfLines={2}>
                  {item.title || item.caption || "Untitled"}
                </Text>
                <Text style={[styles.tilePrice, { color: c.accent }]}>{formatUsPrice(item.price ?? 0)}</Text>
              </View>
              {picked ? (
                <View style={[styles.picked, { backgroundColor: c.accent }]}>
                  <Text style={{ color: c.accentText, fontWeight: "700", fontSize: 12 }}>✓</Text>
                </View>
              ) : null}
            </Pressable>
          );
        }}
      />

      <View style={[styles.checkoutBar, { backgroundColor: c.surface, borderTopColor: c.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.text, fontWeight: "700", fontSize: 14 }}>
            {selected.length} selected
          </Text>
          <Text style={{ color: c.textMuted, fontSize: 12 }}>
            {total ? formatUsPrice(total) : "Tap assets to add"}
            {campaignName.trim() ? ` · ${campaignName.trim()}` : ""}
          </Text>
        </View>
        <Pressable
          onPress={checkout}
          disabled={checkingOut || selected.length === 0}
          style={[
            styles.checkoutButton,
            { backgroundColor: c.accent, opacity: checkingOut || selected.length === 0 ? 0.5 : 1 },
          ]}
        >
          <Text style={{ color: c.accentText, fontWeight: "700", fontSize: 14 }}>
            {checkingOut ? "Processing…" : "Checkout"}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { paddingBottom: spacing.lg },
  header: { padding: spacing.md, gap: spacing.sm },
  title: { fontSize: 22, fontWeight: "700", fontFamily: "Outfit_700Bold" },
  lede: { fontSize: 13, lineHeight: 18 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 15,
  },
  sectionLabel: { marginTop: spacing.sm, fontSize: 15, fontWeight: "600", fontFamily: "Outfit_600SemiBold" },
  empty: { textAlign: "center", marginTop: spacing.md, paddingHorizontal: spacing.md, fontSize: 14 },
  tile: {
    flex: 1,
    marginBottom: COL_GAP,
    borderRadius: radius.md,
    borderWidth: 2,
    overflow: "hidden",
  },
  thumb: { width: "100%", aspectRatio: 1 },
  tileBody: { padding: spacing.sm, gap: 2 },
  tileTitle: { fontSize: 13, fontWeight: "600" },
  tilePrice: { fontSize: 13, fontWeight: "700" },
  picked: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  checkoutBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  checkoutButton: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
  },
});
