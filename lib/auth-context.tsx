import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
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
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    auth
      .getCurrentUser()
      .then(setUser)
      .finally(() => setIsLoading(false));
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
    },
    signOut: async () => {
      await auth.signOut();
      setUser(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
