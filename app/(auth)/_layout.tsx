import { Redirect, Stack } from "expo-router";
import { useAuth } from "../../lib/auth-context";

export default function AuthLayout() {
  const { user, isLoading } = useAuth();

  if (isLoading) return null;
  if (user) return <Redirect href="/(tabs)" />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="sign-up" />
      <Stack.Screen name="confirm" />
      <Stack.Screen name="forgot-password" />
    </Stack>
  );
}
