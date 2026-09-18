import { useStripe } from "@stripe/stripe-react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import {
  formatCoordinates,
  formatUsPrice,
  getDefaultCopyright,
  getDisplayHandle,
  getMediaPageUrl,
  getMediaViralScore,
} from "../../lib/media";
import { getMediaPaymentSecret } from "../../lib/payment";
import { radius, resolveTheme, spacing } from "../../lib/theme";
import type { MediaItem } from "../../lib/types";

// The media detail screen — mirrors photo-op.ai's media details panel
// (title, views, price, viral score, likes, description, coordinates/
// location, categories, tags, copyright credit) so the mobile app carries
// the same "global view of content" info the website shows, plus like,
// share and a customizable copyright/credit line.
export default function MediaDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const scheme = useColorScheme();
  const c = resolveTheme(scheme);
  const router = useRouter();
  const { user, username } = useAuth();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const [media, setMedia] = useState<MediaItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Licensing purchase — mirrors next-web's Stripe checkout, minus the
  // Elements UI (native PaymentSheet handles card entry/3DS instead). null
  // means "haven't checked yet" (or nothing to check — not for sale, or
  // this is the uploader's own post); true/false is the real answer from
  // api.hasUserPurchasedMedia. See lib/payment.ts for the payment-intent
  // call to the separate Payment microservice.
  const [purchased, setPurchased] = useState<boolean | null>(null);
  const [buying, setBuying] = useState(false);

  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [liking, setLiking] = useState(false);

  const [editingCredit, setEditingCredit] = useState(false);
  const [creditDraft, setCreditDraft] = useState("");
  const [savingCredit, setSavingCredit] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [editingPrice, setEditingPrice] = useState(false);
  const [priceDraft, setPriceDraft] = useState("");
  const [savingPrice, setSavingPrice] = useState(false);

  // Tag editing — mirrors next-web's EditMediaModal (pill chips with a
  // remove control, plus a text input to add new ones), see
  // lib/api.ts's updateTags.
  const [editingTags, setEditingTags] = useState(false);
  const [tagsDraft, setTagsDraft] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [savingTags, setSavingTags] = useState(false);

  // The real uploader identity — toMediaItem (lib/api.ts) only has the bare
  // ownerId to work with for the feed/profile list views, so this looks up
  // their actual username + avatar once here (one extra point-read, worth
  // it on a screen the user's already committed to viewing) and links
  // through to their public profile (app/profile/[username].tsx).
  const [uploaderProfile, setUploaderProfile] = useState<{ username: string | null; profileImageKey: string | null } | null>(null);

  const isVideo = media?.mediaType === "video";
  const videoPlayer = useVideoPlayer(isVideo ? media?.url ?? null : null, (player) => {
    player.loop = true;
    player.play();
  });

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function load() {
      try {
        const item = await api.getMedia(id!);
        if (cancelled) return;
        setMedia(item);
        setLikeCount(item.likeCount ?? 0);
        setCreditDraft(item.copyrightText || (user ? getDefaultCopyright(getDisplayHandle(username, user.email)) : ""));
        setError(null);

        if (user) {
          const liked = await api.isMediaLikedByMe(item.id, user.userId);
          if (!cancelled) setIsLiked(liked);

          // Only worth checking when there's actually something to buy and
          // this isn't the uploader's own post (isOwner isn't computed yet
          // at this point in the effect, so this repeats that same check).
          if (item.price && item.uploader.id !== user.userId) {
            api
              .hasUserPurchasedMedia(item.id, user.userId)
              .then((owned) => {
                if (!cancelled) setPurchased(owned);
              })
              .catch(() => {
                // best effort — Buy button just stays visible if this fails
              });
          }
        }

        if (item.uploader.id && item.uploader.id !== "unknown") {
          api
            .getUserProfile(item.uploader.id)
            .then((p) => {
              if (!cancelled) setUploaderProfile(p);
            })
            .catch(() => {
              // best effort — falls back to the existing displayName placeholder
            });
        }
      } catch (err: any) {
        if (cancelled) return;
        const message =
          err?.errors?.[0]?.message ?? (err instanceof Error ? err.message : "Unknown error");
        setError(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const toggleLike = useCallback(async () => {
    if (!media) return;
    if (!user) {
      Alert.alert("Sign in required", "Sign in to like this post.");
      return;
    }
    const nextLiked = !isLiked;
    setLiking(true);
    setIsLiked(nextLiked);
    setLikeCount((n) => n + (nextLiked ? 1 : -1));
    try {
      if (nextLiked) {
        await api.likeMedia(media.id);
      } else {
        await api.unlikeMedia(media.id);
      }
    } catch (err) {
      // roll back on failure
      setIsLiked(!nextLiked);
      setLikeCount((n) => n + (nextLiked ? -1 : 1));
      Alert.alert("Couldn't update like", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLiking(false);
    }
  }, [media, user, isLiked]);

  const shareMedia = useCallback(async () => {
    if (!media) return;
    const url = getMediaPageUrl(media.id);
    const text = media.title || media.caption || "Check this out on Photo-OP";
    try {
      await Share.share({ message: `${text} ${url}`, url });
    } catch (err) {
      Alert.alert("Couldn't share", err instanceof Error ? err.message : "Unknown error");
    }
  }, [media]);

  const isOwner = !!user && !!media && media.uploader.id === user.userId;

  // Licensing purchase — gets a PaymentIntent clientSecret from the
  // Payment microservice (lib/payment.ts), hands it to Stripe's native
  // PaymentSheet (initPaymentSheet then presentPaymentSheet — the sheet
  // itself collects card details and handles 3DS, same as next-web's
  // Stripe Elements does on the web checkout modal), then marks this
  // purchased locally. The backend's Stripe webhook is what actually
  // flips the PaymentMedia record to "paid" server-side; this optimistic
  // local flag just hides the Buy button immediately rather than making
  // the user wait on a refetch.
  const buyMedia = useCallback(async () => {
    if (!media) return;
    if (!user) {
      Alert.alert("Sign in required", "Sign in to buy this media.");
      return;
    }
    setBuying(true);
    try {
      const { clientSecret } = await getMediaPaymentSecret(media.id);
      const initResult = await initPaymentSheet({
        paymentIntentClientSecret: clientSecret,
        merchantDisplayName: "Photo-OP",
      });
      if (initResult.error) {
        throw new Error(initResult.error.message);
      }
      const presentResult = await presentPaymentSheet();
      if (presentResult.error) {
        // The user backing out of the sheet is not an error worth alerting on.
        if (presentResult.error.code !== "Canceled") {
          throw new Error(presentResult.error.message);
        }
        return;
      }
      setPurchased(true);
      Alert.alert("Purchase complete", "You now own a license for this media.");
    } catch (err) {
      Alert.alert("Couldn't complete purchase", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBuying(false);
    }
  }, [media, user, initPaymentSheet, presentPaymentSheet]);

  const startEditingCredit = useCallback(() => {
    if (!media) return;
    setCreditDraft(media.copyrightText || (user ? getDefaultCopyright(getDisplayHandle(username, user.email)) : ""));
    setEditingCredit(true);
  }, [media, user]);

  const saveCredit = useCallback(async () => {
    if (!media) return;
    const trimmed = creditDraft.trim();
    if (!trimmed) {
      Alert.alert("Credit can't be empty");
      return;
    }
    setSavingCredit(true);
    try {
      await api.updateMediaCopyright(media.id, trimmed, media._version);
      setMedia({ ...media, copyrightText: trimmed });
      setEditingCredit(false);
    } catch (err) {
      Alert.alert("Couldn't save credit", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSavingCredit(false);
    }
  }, [media, creditDraft]);

  const startEditingPrice = useCallback(() => {
    if (!media) return;
    setPriceDraft(media.price ? String(media.price) : "");
    setEditingPrice(true);
  }, [media]);

  const savePrice = useCallback(async () => {
    if (!media) return;
    const trimmed = priceDraft.trim();
    const parsed = trimmed ? Number(trimmed) : 0;
    if (Number.isNaN(parsed) || parsed < 0) {
      Alert.alert("Enter a valid price", "Use a number like 25 or 25.00, or leave it blank for not-for-sale.");
      return;
    }
    setSavingPrice(true);
    try {
      await api.updateMediaPrice(media.id, parsed, media._version);
      setMedia({ ...media, price: parsed });
      setEditingPrice(false);
    } catch (err) {
      Alert.alert("Couldn't save price", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSavingPrice(false);
    }
  }, [media, priceDraft]);

  const startEditingTags = useCallback(() => {
    if (!media) return;
    setTagsDraft(media.tags);
    setTagInput("");
    setEditingTags(true);
  }, [media]);

  const addTagFromInput = useCallback(() => {
    const trimmed = tagInput.trim();
    if (!trimmed) return;
    setTagsDraft((tags) =>
      tags.some((t) => t.toLowerCase() === trimmed.toLowerCase()) ? tags : [...tags, trimmed]
    );
    setTagInput("");
  }, [tagInput]);

  const removeTagFromDraft = useCallback((tag: string) => {
    setTagsDraft((tags) => tags.filter((t) => t !== tag));
  }, []);

  const saveTags = useCallback(async () => {
    if (!media) return;
    setSavingTags(true);
    try {
      await api.updateTags(media.id, tagsDraft, media._version, false);
      setMedia({ ...media, tags: tagsDraft });
      setEditingTags(false);
    } catch (err) {
      Alert.alert("Couldn't save tags", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSavingTags(false);
    }
  }, [media, tagsDraft]);

  const deleteThisPost = useCallback(() => {
    if (!media) return;
    Alert.alert(
      "Delete this post?",
      "This removes it from the feed and your profile for everyone. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await api.deleteMedia(media.id, media._version);
              router.back();
            } catch (err) {
              setDeleting(false);
              Alert.alert("Couldn't delete", err instanceof Error ? err.message : "Unknown error");
            }
          },
        },
      ]
    );
  }, [media, router]);

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: c.background }]}>
        <Stack.Screen options={{ title: "" }} />
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }

  if (error || !media) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: c.background }]}>
        <Stack.Screen options={{ title: "" }} />
        <Text style={{ color: c.textMuted, textAlign: "center" }}>
          {error ? `Couldn't load this post: ${error}` : "This post isn't available."}
        </Text>
      </View>
    );
  }

  const viralScore = getMediaViralScore(media);
  const displayCredit = media.copyrightText || (user ? getDefaultCopyright(getDisplayHandle(username, user.email)) : "");

  return (
    <>
      <Stack.Screen options={{ title: media.title || "Post" }} />
      <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={styles.scroll}>
        <View style={styles.mediaWrap}>
          {isVideo ? (
            <VideoView player={videoPlayer} style={styles.media} nativeControls contentFit="contain" />
          ) : media.url ? (
            <Image source={{ uri: media.url }} style={styles.media} resizeMode="contain" />
          ) : (
            <View style={[styles.media, styles.mediaPlaceholder]}>
              <Text style={{ color: "#fff" }}>Processing…</Text>
            </View>
          )}
        </View>

        <View style={styles.body}>
          <Text style={[styles.title, { color: c.text }]}>{media.title || "Untitled"}</Text>
          <View style={styles.metaRow}>
            <Text style={[styles.metaText, { color: c.textMuted }]}>
              {(media.viewCount ?? 0).toLocaleString()} {media.viewCount === 1 ? "view" : "views"}
            </Text>
            <Text style={[styles.metaText, { color: c.textMuted }]}> · </Text>
            {uploaderProfile?.username ? (
              <Pressable onPress={() => router.push(`/profile/${uploaderProfile.username}`)}>
                <Text style={[styles.metaText, styles.metaLink, { color: c.secondary }]}>
                  @{uploaderProfile.username}
                </Text>
              </Pressable>
            ) : (
              <Text style={[styles.metaText, { color: c.textMuted }]}>{media.uploader.displayName}</Text>
            )}
          </View>

          {/* actions: like (thumbs up), share */}
          <View style={styles.actionRow}>
            <Pressable
              onPress={toggleLike}
              disabled={liking}
              style={[
                styles.actionButton,
                { borderColor: c.border, backgroundColor: isLiked ? c.accent : c.surface },
              ]}
            >
              <Text style={{ fontSize: 15 }}>{isLiked ? "👍" : "👍🏻"}</Text>
              <Text style={[styles.actionText, { color: isLiked ? c.accentText : c.text }]}>
                {likeCount}
              </Text>
            </Pressable>
            <Pressable
              onPress={shareMedia}
              style={[styles.actionButton, { borderColor: c.border, backgroundColor: c.surface }]}
            >
              <Text style={{ fontSize: 15 }}>↗</Text>
              <Text style={[styles.actionText, { color: c.text }]}>Share</Text>
            </Pressable>
          </View>

          {/* price + viral score */}
          <View style={styles.statRow}>
            <View style={styles.priceRow}>
              <Text style={[styles.price, { color: c.accent }]}>
                {media.price ? formatUsPrice(media.price) : "Not for sale"}
              </Text>
              {isOwner ? (
                <Pressable onPress={startEditingPrice} hitSlop={8}>
                  <Text style={{ color: c.secondary, fontWeight: "600", fontSize: 13 }}>Edit</Text>
                </Pressable>
              ) : null}
            </View>
            <View style={[styles.scorePill, { borderColor: c.border, backgroundColor: c.surface }]}>
              <Text style={[styles.scoreText, { color: c.textMuted }]}>Viral score</Text>
              <Text style={[styles.scoreValue, { color: c.text }]}>{viralScore}</Text>
            </View>
          </View>

          {/* Buy / owned — only for a for-sale post that isn't the
              signed-in user's own upload. purchased === null means either
              nothing to check yet or the check is still in flight, so the
              button is simply omitted rather than flashing on then off. */}
          {media.price && !isOwner ? (
            purchased ? (
              <View style={[styles.ownedPill, { borderColor: c.border, backgroundColor: c.surface }]}>
                <Text style={[styles.ownedText, { color: c.textMuted }]}>✓ You own a license for this</Text>
              </View>
            ) : purchased === false ? (
              <Pressable
                onPress={buyMedia}
                disabled={buying}
                style={[styles.buyButton, { backgroundColor: c.accent, opacity: buying ? 0.6 : 1 }]}
              >
                <Text style={{ color: c.accentText, fontWeight: "700", fontSize: 15 }}>
                  {buying ? "Processing…" : `Buy license — ${formatUsPrice(media.price)}`}
                </Text>
              </Pressable>
            ) : null
          ) : null}

          {editingPrice ? (
            <View style={styles.priceEditRow}>
              <Text style={{ color: c.textMuted, fontSize: 14 }}>$</Text>
              <TextInput
                value={priceDraft}
                onChangeText={setPriceDraft}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={c.textMuted}
                style={[styles.priceInput, { borderColor: c.border, color: c.text, backgroundColor: c.surface }]}
              />
              <Pressable
                onPress={() => setEditingPrice(false)}
                style={[styles.smallButton, styles.smallButtonOutline, { borderColor: c.border }]}
              >
                <Text style={{ color: c.text, fontWeight: "600", fontSize: 13 }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={savePrice}
                disabled={savingPrice}
                style={[styles.smallButton, { backgroundColor: c.accent, opacity: savingPrice ? 0.6 : 1 }]}
              >
                <Text style={{ color: c.accentText, fontWeight: "600", fontSize: 13 }}>
                  {savingPrice ? "Saving…" : "Save"}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {media.caption ? (
            <Text style={[styles.description, { color: c.text }]}>{media.caption}</Text>
          ) : null}

          {/* location + coordinates — Photo-OP prides itself on a global
              view of content, so both the place name and raw coordinates
              are shown, not just a city label. */}
          {media.location ? (
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: c.textMuted }]}>Location</Text>
              <Text style={[styles.sectionValue, { color: c.text }]}>{media.location.label}</Text>
              <Text style={[styles.coords, { color: c.textMuted }]}>
                {formatCoordinates(media.location.lat, media.location.lng)}
              </Text>
            </View>
          ) : null}

          {media.categories && media.categories.length > 0 ? (
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: c.textMuted }]}>Categories</Text>
              <View style={styles.tagRow}>
                {media.categories.map((cat, index) => (
                  <View key={`${cat}-${index}`} style={[styles.tag, { backgroundColor: c.background, borderColor: c.border }]}>
                    <Text style={[styles.tagText, { color: c.textMuted }]}>{cat}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {media.tags.length > 0 || isOwner ? (
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionLabel, { color: c.textMuted }]}>Tags</Text>
                {isOwner && !editingTags ? (
                  <Pressable onPress={startEditingTags}>
                    <Text style={{ color: c.secondary, fontSize: 12, fontWeight: "600" }}>Edit</Text>
                  </Pressable>
                ) : null}
              </View>

              {editingTags ? (
                <>
                  <View style={styles.tagRow}>
                    {tagsDraft.map((tag, index) => (
                      <Pressable
                        key={`${tag}-${index}`}
                        onPress={() => removeTagFromDraft(tag)}
                        style={[styles.tag, styles.removableTag, { backgroundColor: c.background, borderColor: c.border }]}
                      >
                        <Text style={[styles.tagText, { color: c.textMuted }]}>{tag}</Text>
                        <Text style={[styles.tagRemoveX, { color: c.textMuted }]}>×</Text>
                      </Pressable>
                    ))}
                  </View>
                  <View style={styles.tagInputRow}>
                    <TextInput
                      value={tagInput}
                      onChangeText={setTagInput}
                      onSubmitEditing={addTagFromInput}
                      placeholder="Add a tag"
                      placeholderTextColor={c.textMuted}
                      maxLength={30}
                      autoCapitalize="none"
                      returnKeyType="done"
                      style={[styles.tagInput, { borderColor: c.border, color: c.text, backgroundColor: c.surface }]}
                    />
                    <Pressable onPress={addTagFromInput} style={[styles.tagAddButton, { borderColor: c.border }]}>
                      <Text style={{ color: c.secondary, fontWeight: "700" }}>Add</Text>
                    </Pressable>
                  </View>
                  <View style={styles.creditButtonRow}>
                    <Pressable
                      onPress={() => setEditingTags(false)}
                      style={[styles.smallButton, styles.smallButtonOutline, { borderColor: c.border }]}
                    >
                      <Text style={{ color: c.text, fontWeight: "600", fontSize: 13 }}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      onPress={saveTags}
                      disabled={savingTags}
                      style={[styles.smallButton, { backgroundColor: c.accent, opacity: savingTags ? 0.6 : 1 }]}
                    >
                      <Text style={{ color: c.accentText, fontWeight: "600", fontSize: 13 }}>
                        {savingTags ? "Saving…" : "Save"}
                      </Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <View style={styles.tagRow}>
                  {media.tags.map((tag, index) => (
                    <View key={`${tag}-${index}`} style={[styles.tag, { backgroundColor: c.background, borderColor: c.border }]}>
                      <Text style={[styles.tagText, { color: c.textMuted }]}>{tag}</Text>
                    </View>
                  ))}
                  {media.tags.length === 0 ? (
                    <Text style={{ color: c.textMuted, fontSize: 13 }}>No tags yet.</Text>
                  ) : null}
                </View>
              )}
            </View>
          ) : null}

          {/* copyright / credit — auto-signed with the uploader's handle
              at post time (see lib/media.ts's getDefaultCopyright), and
              burned into the watermark by the backend; the uploader can
              customize it here afterward. */}
          <View style={[styles.section, styles.creditSection, { borderColor: c.border }]}>
            <Text style={[styles.sectionLabel, { color: c.textMuted }]}>Credit</Text>
            {editingCredit ? (
              <>
                <TextInput
                  value={creditDraft}
                  onChangeText={setCreditDraft}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[styles.creditInput, { borderColor: c.border, color: c.text, backgroundColor: c.surface }]}
                />
                <View style={styles.creditButtonRow}>
                  <Pressable
                    onPress={() => setEditingCredit(false)}
                    style={[styles.smallButton, styles.smallButtonOutline, { borderColor: c.border }]}
                  >
                    <Text style={{ color: c.text, fontWeight: "600", fontSize: 13 }}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={saveCredit}
                    disabled={savingCredit}
                    style={[styles.smallButton, { backgroundColor: c.accent, opacity: savingCredit ? 0.6 : 1 }]}
                  >
                    <Text style={{ color: c.accentText, fontWeight: "600", fontSize: 13 }}>
                      {savingCredit ? "Saving…" : "Save"}
                    </Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <View style={styles.creditRow}>
                <Text style={[styles.sectionValue, { color: c.text }]}>{displayCredit}</Text>
                {isOwner ? (
                  <Pressable onPress={startEditingCredit} hitSlop={8}>
                    <Text style={{ color: c.secondary, fontWeight: "600", fontSize: 13 }}>Edit</Text>
                  </Pressable>
                ) : null}
              </View>
            )}
          </View>

          {isOwner ? (
            <Pressable
              onPress={deleteThisPost}
              disabled={deleting}
              style={[styles.deleteButton, { borderColor: "#E5484D", opacity: deleting ? 0.6 : 1 }]}
            >
              <Text style={{ color: "#E5484D", fontWeight: "600", fontSize: 14 }}>
                {deleting ? "Deleting…" : "Delete post"}
              </Text>
            </Pressable>
          ) : null}

          <Pressable onPress={() => router.back()} style={styles.backLink}>
            <Text style={{ color: c.textMuted, fontSize: 13 }}>Back to feed</Text>
          </Pressable>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { alignItems: "center", justifyContent: "center" },
  scroll: { paddingBottom: spacing.xl },
  mediaWrap: { width: "100%", aspectRatio: 4 / 5, backgroundColor: "#000" },
  media: { width: "100%", height: "100%" },
  mediaPlaceholder: { alignItems: "center", justifyContent: "center" },
  body: { padding: spacing.lg, gap: spacing.sm },
  title: { fontSize: 20, fontWeight: "700", fontFamily: "Outfit_700Bold" },
  metaRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center" },
  metaText: { fontSize: 13 },
  metaLink: { fontWeight: "600" },
  actionRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  actionText: { fontSize: 13, fontWeight: "600" },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.sm,
  },
  price: { fontSize: 20, fontWeight: "700", fontFamily: "Outfit_700Bold" },
  priceRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  priceEditRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.xs },
  priceInput: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs + 4,
    fontSize: 14,
  },
  scorePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
  },
  scoreText: { fontSize: 12 },
  scoreValue: { fontSize: 13, fontWeight: "700" },
  buyButton: {
    marginTop: spacing.sm,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 4,
    alignItems: "center",
  },
  ownedPill: {
    marginTop: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    alignItems: "center",
  },
  ownedText: { fontSize: 13, fontWeight: "600" },
  description: { fontSize: 14, lineHeight: 20, marginTop: spacing.xs },
  section: { marginTop: spacing.md, gap: 4 },
  sectionLabel: { fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4 },
  sectionValue: { fontSize: 14 },
  coords: { fontSize: 12 },
  sectionHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: 2 },
  tag: {
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  tagText: { fontSize: 11, fontWeight: "500" },
  removableTag: { flexDirection: "row", alignItems: "center", gap: 4 },
  tagRemoveX: { fontSize: 13, fontWeight: "700", marginTop: -1 },
  tagInputRow: { flexDirection: "row", gap: spacing.xs, marginTop: spacing.xs, alignItems: "center" },
  tagInput: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs + 4,
    fontSize: 14,
  },
  tagAddButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 4,
  },
  creditSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.md,
  },
  creditRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  creditInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs + 4,
    fontSize: 14,
  },
  creditButtonRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  smallButton: { borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2 },
  smallButtonOutline: { backgroundColor: "transparent", borderWidth: StyleSheet.hairlineWidth },
  deleteButton: {
    marginTop: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 4,
    alignItems: "center",
  },
  backLink: { marginTop: spacing.lg, alignItems: "center" },
});
