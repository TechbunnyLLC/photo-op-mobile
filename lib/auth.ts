import {
  confirmSignUp as amplifyConfirmSignUp,
  getCurrentUser as amplifyGetCurrentUser,
  resendSignUpCode as amplifyResendSignUpCode,
  signIn as amplifySignIn,
  signOut as amplifySignOut,
  signUp as amplifySignUp,
} from "aws-amplify/auth";
import { USE_MOCK_API } from "./config";

export interface AuthUser {
  userId: string;
  email: string;
}

// --- Mock auth -------------------------------------------------------
// Lets the whole sign-up -> confirm -> sign-in -> capture flow be tried
// end-to-end in Expo Go before lib/amplify-config.ts has real values.
// State lives only in memory — it resets on every reload.

interface MockAccount {
  email: string;
  password: string;
  confirmed: boolean;
  code: string;
}

const mockAccounts = new Map<string, MockAccount>();
let mockCurrentUser: AuthUser | null = null;
const MOCK_CODE = "123456";

async function mockDelay<T>(value: T, ms = 500): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

// --- Public API --------------------------------------------------------
// Same shape whether backed by mock state or real Cognito, so screens
// don't need to know which mode they're in.

export async function signUp(email: string, password: string): Promise<void> {
  if (USE_MOCK_API) {
    mockAccounts.set(email, { email, password, confirmed: false, code: MOCK_CODE });
    await mockDelay(undefined);
    return;
  }

  await amplifySignUp({
    username: email,
    password,
    options: { userAttributes: { email } },
  });
}

export async function confirmSignUp(email: string, code: string): Promise<void> {
  if (USE_MOCK_API) {
    const account = mockAccounts.get(email);
    if (!account) throw new Error("No pending sign-up for this email.");
    if (code !== account.code) throw new Error("Incorrect code — try 123456 in mock mode.");
    account.confirmed = true;
    await mockDelay(undefined);
    return;
  }

  await amplifyConfirmSignUp({ username: email, confirmationCode: code });
}

export async function resendCode(email: string): Promise<void> {
  if (USE_MOCK_API) {
    await mockDelay(undefined);
    return;
  }
  await amplifyResendSignUpCode({ username: email });
}

export async function signIn(email: string, password: string): Promise<AuthUser> {
  if (USE_MOCK_API) {
    const account = mockAccounts.get(email);
    if (!account || account.password !== password) {
      throw new Error("Incorrect email or password.");
    }
    if (!account.confirmed) {
      throw new Error("Account not confirmed yet — check for the confirmation code.");
    }
    mockCurrentUser = { userId: `mock-${email}`, email };
    await mockDelay(undefined);
    return mockCurrentUser;
  }

  await amplifySignIn({ username: email, password });
  return getCurrentUser() as Promise<AuthUser>;
}

export async function signOut(): Promise<void> {
  if (USE_MOCK_API) {
    mockCurrentUser = null;
    await mockDelay(undefined);
    return;
  }
  await amplifySignOut();
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  if (USE_MOCK_API) {
    return mockCurrentUser;
  }

  try {
    const user = await amplifyGetCurrentUser();
    return { userId: user.userId, email: user.signInDetails?.loginId ?? user.username };
  } catch {
    return null;
  }
}
