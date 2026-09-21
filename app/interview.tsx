// Full-screen AI-interview chat — a short back-and-forth (InterviewAI
// Lambda, capped at 5 questions server-side) that draws out a first-person
// account of whatever the uploader just captured. Pushed from the capture
// review screen (see capture.tsx's openInterview); on completion the
// finished transcript is handed back via lib/interview-handoff.ts and
// stitched into the caption there (see lib/interview.ts's
// summarizeInterview) — this screen itself never touches the caption.
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { takeInterviewCallback } from "../lib/interview-handoff";
import {
  continueInterview,
  startInterview,
  type InterviewContext,
  type InterviewTurn,
} from "../lib/interview";
import { radius, resolveTheme, spacing } from "../lib/theme";

export default function InterviewScreen() {
  const scheme = useColorScheme();
  const c = resolveTheme(scheme);
  const router = useRouter();
  const params = useLocalSearchParams<{ caption?: string; mediaType?: string; location?: string }>();

  const context: InterviewContext = {
    caption: params.caption || undefined,
    mediaType: params.mediaType === "video" ? "video" : params.mediaType === "photo" ? "photo" : undefined,
    location: params.location || undefined,
  };

  const [transcript, setTranscript] = useState<InterviewTurn[]>([]);
  const [answer, setAnswer] = useState("");
  const [starting, setStarting] = useState(true);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [startFailed, setStartFailed] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  async function begin() {
    setStarting(true);
    setStartFailed(false);
    try {
      const result = await startInterview(context);
      setTranscript(result.transcript);
      setDone(result.done);
    } catch (err) {
      console.warn("Failed to start interview:", err);
      setStartFailed(true);
    } finally {
      setStarting(false);
    }
  }

  useEffect(() => {
    begin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function leave() {
    router.back();
  }

  function finish(finalTranscript: InterviewTurn[]) {
    const callback = takeInterviewCallback();
    callback?.(finalTranscript);
    router.back();
  }

  async function send() {
    const trimmed = answer.trim();
    if (!trimmed || sending || transcript.length === 0) return;

    setSending(true);
    try {
      const result = await continueInterview(transcript, trimmed, context);
      setTranscript(result.transcript);
      setDone(result.done);
      setAnswer("");
      // If the model has what it needs, the transcript it just returned
      // may already reflect the newly-answered turn with nothing appended
      // after it — hand off straight away rather than waiting for another
      // tap once the "done" UI renders.
      if (result.done) {
        finish(result.transcript);
      }
    } catch (err) {
      console.warn("Failed to continue interview:", err);
      Alert.alert("Couldn't send that answer", "Check your connection and try again.");
    } finally {
      setSending(false);
    }
  }

  const lastTurn = transcript[transcript.length - 1];
  const awaitingAnswer = !starting && !done && !!lastTurn && lastTurn.answer === null;

  return (
    <>
      <Stack.Screen
        options={{
          title: "Tell the story",
          headerRight: () => (
            <Pressable onPress={leave} hitSlop={8} style={{ marginRight: spacing.md }}>
              <Text style={{ color: c.secondary, fontWeight: "600", fontSize: 14 }}>Skip</Text>
            </Pressable>
          ),
        }}
      />
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: c.background }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        {starting ? (
          <View style={styles.centered}>
            <ActivityIndicator color={c.accent} />
            <Text style={[styles.helperText, { color: c.textMuted }]}>Starting the interview…</Text>
          </View>
        ) : startFailed ? (
          <View style={styles.centered}>
            <Text style={[styles.helperText, { color: c.textMuted, textAlign: "center" }]}>
              Couldn't start the interview. Check your connection and try again.
            </Text>
            <Pressable
              onPress={begin}
              style={[styles.button, { backgroundColor: c.accent, marginTop: spacing.md }]}
            >
              <Text style={[styles.buttonText, { color: c.accentText }]}>Retry</Text>
            </Pressable>
            <Pressable onPress={leave} style={{ marginTop: spacing.md }}>
              <Text style={{ color: c.textMuted }}>Skip for now</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <ScrollView
              ref={scrollRef}
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
            >
              <Text style={[styles.intro, { color: c.textMuted }]}>
                A few quick questions to help capture what happened, in your own words. Answer as
                many as you'd like — skip anytime.
              </Text>
              {transcript.map((turn, i) => (
                <View key={i}>
                  <View style={[styles.bubble, styles.bubbleLeft, { backgroundColor: c.surface, borderColor: c.border }]}>
                    <Text style={{ color: c.text, fontSize: 15, lineHeight: 21 }}>{turn.question}</Text>
                  </View>
                  {turn.answer ? (
                    <View style={[styles.bubble, styles.bubbleRight, { backgroundColor: c.accent }]}>
                      <Text style={{ color: c.accentText, fontSize: 15, lineHeight: 21 }}>{turn.answer}</Text>
                    </View>
                  ) : null}
                </View>
              ))}
              {done ? (
                <View style={[styles.doneCard, { backgroundColor: c.surface, borderColor: c.border }]}>
                  <Text style={{ color: c.text, fontWeight: "600", fontSize: 15 }}>That's plenty — thanks!</Text>
                  <Text style={{ color: c.textMuted, fontSize: 13, marginTop: spacing.xs }}>
                    Add these answers to your caption, or skip and write your own.
                  </Text>
                  <View style={styles.doneActions}>
                    <Pressable
                      onPress={leave}
                      style={[styles.button, styles.buttonOutline, { borderColor: c.border, flex: 1 }]}
                    >
                      <Text style={[styles.buttonText, { color: c.text }]}>Skip</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => finish(transcript)}
                      style={[styles.button, { backgroundColor: c.accent, flex: 1 }]}
                    >
                      <Text style={[styles.buttonText, { color: c.accentText }]}>Use these answers</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}
            </ScrollView>

            {!done ? (
              <View style={[styles.inputRow, { borderColor: c.border, backgroundColor: c.surface }]}>
                <TextInput
                  value={answer}
                  onChangeText={setAnswer}
                  placeholder="Type your answer…"
                  placeholderTextColor={c.textMuted}
                  style={[styles.input, { color: c.text }]}
                  multiline
                  editable={awaitingAnswer && !sending}
                  onSubmitEditing={send}
                  returnKeyType="send"
                  blurOnSubmit={false}
                />
                <Pressable
                  onPress={send}
                  disabled={!awaitingAnswer || sending || !answer.trim()}
                  style={[
                    styles.sendButton,
                    { backgroundColor: c.accent, opacity: !awaitingAnswer || sending || !answer.trim() ? 0.4 : 1 },
                  ]}
                >
                  {sending ? (
                    <ActivityIndicator size="small" color={c.accentText} />
                  ) : (
                    <Text style={{ color: c.accentText, fontWeight: "700" }}>Send</Text>
                  )}
                </Pressable>
              </View>
            ) : null}
          </>
        )}
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  helperText: { marginTop: spacing.sm, fontSize: 14 },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.lg },
  intro: { fontSize: 13, marginBottom: spacing.md, lineHeight: 18 },
  bubble: {
    maxWidth: "85%",
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    marginBottom: spacing.sm,
  },
  bubbleLeft: {
    alignSelf: "flex-start",
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomLeftRadius: radius.sm,
  },
  bubbleRight: {
    alignSelf: "flex-end",
    borderBottomRightRadius: radius.sm,
  },
  doneCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  doneActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 15,
    maxHeight: 100,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  sendButton: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    alignItems: "center",
    justifyContent: "center",
  },
  button: {
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 4,
    alignItems: "center",
  },
  buttonOutline: {
    backgroundColor: "transparent",
    borderWidth: StyleSheet.hairlineWidth,
  },
  buttonText: {
    fontWeight: "600",
    fontSize: 14,
  },
});
