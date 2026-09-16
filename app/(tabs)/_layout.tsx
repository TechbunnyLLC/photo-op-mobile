import { Redirect, Tabs } from "expo-router";
import { useColorScheme } from "react-native";
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
        headerStyle: { backgroundColor: c.surface },
        headerTintColor: c.text,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border },
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.textMuted,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Feed" }} />
      <Tabs.Screen name="capture" options={{ title: "Capture" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
