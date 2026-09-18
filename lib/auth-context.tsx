import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./api";
import * as auth from "./auth";
import type { AuthUser } from "./auth";

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  signUp: typeof auth.signUp;
  confirmSignUp: typeof auth.confirmSignUp;
  resendCode: typeof auth.resendCode;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  // The user's customizable handle — starts out as the backend's
  // "system generated" username (see lib/graphql/queries.ts's getUser
  // comment) and is what lib/media.ts's getDefaultCopyright signs new
  // posts with. null while loading or for a brand-new account whose User
  // record hasn't landed yet — callers should fall back to
  // lib/media.ts's handleFromEmail(user.email) in that case.
  username: string | null;
  isLoadingUsername: boolean;
  updateUsername: (newUsername: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [username, setUsername] = useState<string | null>(null);
  const [usernameVersion, setUsernameVersion] = useState<number | undefined>(undefined);
  const [isLoadingUsername, setIsLoadingUsername] = useState(false);

  const loadUsername = useCallback(async (cognitoId: string) => {
    setIsLoadingUsername(true);
    try {
      const profile = await api.getUserProfile(cognitoId);
      setUsername(profile?.username ?? null);
      setUsernameVersion(profile?.version);
    } catch {
      // Best-effort — capture.tsx and the Profile screen both fall back to
      // the email-derived handle when this hasn't loaded.
      setUsername(null);
    } finally {
      setIsLoadingUsername(false);
    }
  }, []);

  useEffect(() => {
    auth
      .getCurrentUser()
      .then((u) => {
        setUser(u);
        if (u) loadUsername(u.userId);
      })
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value: AuthContextValue = {
    user,
    isLoading,
    signUp: auth.signUp,
    confirmSignUp: auth.confirmSignUp,
    resendCode: auth.resendCode,
    signIn: async (email, password) => {
      const signedInUser = await auth.signIn(email, password);
      setUser(signedInUser);
      await loadUsername(signedInUser.userId);
    },
    signOut: async () => {
      await auth.signOut();
      setUser(null);
      setUsername(null);
      setUsernameVersion(undefined);
    },
    username,
    isLoadingUsername,
    updateUsername: async (newUsername: string) => {
      if (!user) throw new Error("Not signed in");
      const trimmed = newUsername.trim().toLowerCase();
      if (!trimmed) throw new Error("Username can't be empty");
      if (trimmed !== username) {
        const taken = await api.isUsernameTaken(trimmed, user.userId);
        if (taken) throw new Error("That username is already taken");
      }
      const result = await api.updateUsername(user.userId, trimmed, usernameVersion);
      setUsername(result.username);
      setUsernameVersion(result.version);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
