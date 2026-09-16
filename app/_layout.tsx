// Polyfills required by aws-amplify on React Native — must load before
// anything else touches Amplify (crypto.getRandomValues, fetch/URL).
import "react-native-get-random-values";
import "react-native-url-polyfill/auto";

import { Amplify } from "aws-amplify";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "react-native";
import awsconfig from "../lib/amplify-config";
import { AuthProvider } from "../lib/auth-context";
import { resolveTheme } from "../lib/theme";

Amplify.configure(awsconfig);

export default function RootLayout() {
  const scheme = useColorScheme();
  const c = resolveTheme(scheme);

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
