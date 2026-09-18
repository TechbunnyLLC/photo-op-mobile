// Polyfills required by aws-amplify on React Native — must load before
// anything else touches Amplify (crypto.getRandomValues, fetch/URL).
import "react-native-get-random-values";
import "react-native-url-polyfill/auto";

import {
  Outfit_400Regular,
  Outfit_600SemiBold,
  Outfit_700Bold,
  useFonts,
} from "@expo-google-fonts/outfit";
import { Amplify } from "aws-amplify";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { useColorScheme } from "react-native";
import awsconfig from "../lib/amplify-config";
import { AuthProvider } from "../lib/auth-context";
import { resolveTheme } from "../lib/theme";

Amplify.configure(awsconfig);

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

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
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
  );
}
