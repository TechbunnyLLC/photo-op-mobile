import {
  confirmResetPassword as amplifyConfirmResetPassword,
  confirmSignUp as amplifyConfirmSignUp,
  getCurrentUser as amplifyGetCurrentUser,
  resendSignUpCode as amplifyResendSignUpCode,
  resetPassword as amplifyResetPassword,
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

// Password reset -- "forgot password" on the sign-in screen. Cognito's
// flow is two calls: resetPassword sends the code, confirmResetPassword
// takes that code plus the new password. Same MOCK_CODE convention as
// sign-up confirmation in mock mode (see ConfirmScreen's "Mock mode -- the
// code is 123456" note) -- reuses the same account.code field since a
// mock account is never mid-sign-up-confirmation and mid-password-reset
// at once.
export async function forgotPassword(email: string): Promise<void> {
  if (USE_MOCK_API) {
    const account = mockAccounts.get(email);
    if (!account) throw new Error("No account found for that email.");
    account.code = MOCK_CODE;
    await mockDelay(undefined);
    return;
  }
  await amplifyResetPassword({ username: email });
}

export async function confirmForgotPassword(
  email: string,
  code: string,
  newPassword: string
): Promise<void> {
  if (USE_MOCK_API) {
    const account = mockAccounts.get(email);
    if (!account) throw new Error("No account found for that email.");
    if (code !== account.code) throw new Error("Incorrect code -- try 123456 in mock mode.");
    account.password = newPassword;
    await mockDelay(undefined);
    return;
  }
  await amplifyConfirmResetPassword({
    username: email,
    confirmationCode: code,
    newPassword,
  });
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

  // USER_PASSWORD_AUTH instead of the default USER_SRP_AUTH: SRP needs a
  // native big-integer module (from @aws-amplify/react-native) that only
  // works in a custom-built app, not Expo Go. USER_PASSWORD_AUTH sends the
  // password over TLS instead of a zero-knowledge proof — still secure in
  // transit, just a different tradeoff — and must be enabled on the
  // Cognito app client (ALLOW_USER_PASSWORD_AUTH in ExplicitAuthFlows).
  await amplifySignIn({
    username: email,
    password,
    options: { authFlowType: "USER_PASSWORD_AUTH" },
  });
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
