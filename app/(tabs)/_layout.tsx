import { Redirect, Tabs } from "expo-router";
import { Platform, useColorScheme } from "react-native";
import { AppHeaderLogo } from "../../components/AppHeader";
import { useAuth } from "../../lib/auth-context";
import { resolveTheme } from "../../lib/theme";

export default function TabsLayout() {
  const scheme = useColorScheme();
  const c = resolveTheme(scheme);
  const { user, isLoading } = useAuth();

  if (isLoading) return null;
  if (!user) return <Redirect href="/(auth)/sign-in" />;

  return (
    <Tabs
      screenOptions={{
        // small brand mark top-left on every tab screen, matching how
        // photo-op.ai itself shows just the mark at mobile widths
        headerLeft: () => <AppHeaderLogo />,
        headerTitle: "",
        headerStyle: { backgroundColor: c.surface },
        headerTintColor: c.text,
        headerShadowVisible: true,
        ...Platform.select({
          ios: {
            headerStyle: {
              backgroundColor: c.surface,
              shadowColor: "#000",
              shadowOpacity: 0.08,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 2 },
            },
          },
          android: {
            headerStyle: { backgroundColor: c.surface, elevation: 3 },
          },
        }),
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border },
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.textMuted,
        tabBarLabelStyle: { fontFamily: "Outfit_600SemiBold", fontSize: 11 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Feed" }} />
      <Tabs.Screen name="license" options={{ title: "License" }} />
      <Tabs.Screen name="capture" options={{ title: "Capture" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
