// Polyfills required by aws-amplify on React Native — must load before
// anything else touches Amplify (crypto.getRandomValues, fetch/URL).
import "react-native-get-random-values";
import "react-native-url-polyfill/auto";

// Amplify itself is configured as a side effect of importing
// lib/amplify-config.ts (see the comment there for why it lives there
// now instead of here) — this import just needs to happen before
// AuthProvider below, which is what actually exercises Amplify.
import "../lib/amplify-config";

import {
  Outfit_400Regular,
  Outfit_600SemiBold,
  Outfit_700Bold,
  useFonts,
} from "@expo-google-fonts/outfit";
import { StripeProvider } from "@stripe/stripe-react-native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { useColorScheme } from "react-native";
import { AuthProvider } from "../lib/auth-context";
import { getStripePublishableKey } from "../lib/payment";
import { resolveTheme } from "../lib/theme";

// Keep the splash screen up until the brand font has finished loading,
// so we never flash the system font before Outfit swaps in.
SplashScreen.preventAutoHideAsync().catch(() => {
  // no-op — if this races with an already-hidden splash screen, ignore it
});

export default function RootLayout() {
  const scheme = useColorScheme();
  const c = resolveTheme(scheme);
  const [fontsLoaded] = useFonts({
    Outfit_400Regular,
    Outfit_600SemiBold,
    Outfit_700Bold,
  });

  // Fetched once at startup so it's already in hand by the time anyone
  // taps "Buy" on the media detail screen — StripeProvider is happy to
  // render with an empty key in the meantime, it just can't actually
  // open a payment sheet until this resolves (which is well before
  // anyone gets through onboarding/browsing to a purchase).
  const [stripeKey, setStripeKey] = useState("");
  useEffect(() => {
    getStripePublishableKey()
      .then(setStripeKey)
      .catch((err) => {
        console.warn("Couldn't fetch the Stripe publishable key:", err);
      });
  }, []);

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <StripeProvider publishableKey={stripeKey} merchantIdentifier="merchant.ai.photoop.app">
      <AuthProvider>
        <StatusBar style={scheme === "dark" ? "light" : "dark"} />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: c.surface },
            headerTintColor: c.text,
            contentStyle: { backgroundColor: c.background },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
      </AuthProvider>
    </StripeProvider>
  );
}
