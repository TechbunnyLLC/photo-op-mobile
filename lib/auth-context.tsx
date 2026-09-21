import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./api";
import * as auth from "./auth";
import type { AuthUser } from "./auth";
import { generateFallbackHandle, getProfileImageUrl, isBrokenUsername } from "./media";
import { uploadMediaFile } from "./storage";

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  signUp: typeof auth.signUp;
  confirmSignUp: typeof auth.confirmSignUp;
  resendCode: typeof auth.resendCode;
  forgotPassword: typeof auth.forgotPassword;
  confirmForgotPassword: typeof auth.confirmForgotPassword;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  // The user's customizable handle — starts out as the backend's
  // "system generated" username (see lib/graphql/queries.ts's getUser
  // comment) and is what lib/media.ts's getDefaultCopyright signs new
  // posts with. Self-heals a broken backend default (e.g. "undefined64226"
  // — see lib/media.ts's isBrokenUsername) into a clean generated one the
  // first time it's loaded, so this is only ever null while still loading.
  username: string | null;
  isLoadingUsername: boolean;
  updateUsername: (newUsername: string) => Promise<void>;
  // Profile picture — null until one's been set.
  avatarUrl: string | null;
  isUploadingAvatar: boolean;
  updateProfilePicture: (localUri: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [username, setUsername] = useState<string | null>(null);
  const [usernameVersion, setUsernameVersion] = useState<number | undefined>(undefined);
  const [isLoadingUsername, setIsLoadingUsername] = useState(false);

  const [profileImageKey, setProfileImageKey] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const loadProfile = useCallback(async (cognitoId: string) => {
    setIsLoadingUsername(true);
    try {
      const profile = await api.getUserProfile(cognitoId);
      setProfileImageKey(profile?.profileImageKey ?? null);

      if (profile && !isBrokenUsername(profile.username)) {
        setUsername(profile.username);
        setUsernameVersion(profile.version);
        return;
      }

      // No User record yet, or the backend's PostConfirmation Lambda
      // produced a broken default (see lib/media.ts's isBrokenUsername —
      // always happens for mobile sign-ups today, since they don't collect
      // a first/last name). Self-heal with a clean generated handle.
      const fallback = generateFallbackHandle();
      setUsername(fallback);
      setUsernameVersion(profile?.version);

      if (profile) {
        // The record exists, it just has a bad username — fix it in place
        // so it's stable from here on rather than re-rolling every load.
        // Best effort: if this write fails, the generated fallback still
        // displays fine, and the user can always hit Edit and save by hand.
        try {
          const result = await api.updateUsername(cognitoId, fallback, profile.version);
          setUsername(result.username ?? fallback);
          setUsernameVersion(result.version);
        } catch {
          // keep showing the local fallback
        }
      }
      // If there's no User record at all yet (very new account, the
      // Lambda hasn't landed), there's nothing to update — the generated
      // fallback just displays locally until they save a real one.
    } catch {
      setUsername(null);
      setProfileImageKey(null);
    } finally {
      setIsLoadingUsername(false);
    }
  }, []);

  useEffect(() => {
    auth
      .getCurrentUser()
      .then((u) => {
        setUser(u);
        if (u) loadProfile(u.userId);
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
    forgotPassword: auth.forgotPassword,
    confirmForgotPassword: auth.confirmForgotPassword,
    signIn: async (email, password) => {
      const signedInUser = await auth.signIn(email, password);
      setUser(signedInUser);
      await loadProfile(signedInUser.userId);
    },
    signOut: async () => {
      await auth.signOut();
      setUser(null);
      setUsername(null);
      setUsernameVersion(undefined);
      setProfileImageKey(null);
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
    avatarUrl: getProfileImageUrl(profileImageKey),
    isUploadingAvatar,
    updateProfilePicture: async (localUri: string) => {
      if (!user) throw new Error("Not signed in");
      setIsUploadingAvatar(true);
      try {
        // Same convention as next-web's updateProfilePicture service: one
        // fixed key per user (their own cognitoId), so a re-upload just
        // overwrites it rather than accumulating old avatars in S3.
        const key = `profile-pictures/${user.userId}`;
        await uploadMediaFile(localUri, key, "image/jpeg");
        const result = await api.updateProfileImage(user.userId, user.userId, usernameVersion);
        setProfileImageKey(result.profileImageKey);
        setUsernameVersion(result.version);
      } finally {
        setIsUploadingAvatar(false);
      }
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
