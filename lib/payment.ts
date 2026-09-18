// Media licensing purchases — mirrors next-web's src/services/payment/*.ts
// against the same payment microservice (see lib/config.ts's
// PAYMENT_SERVICE_URL comment for why this isn't part of the Amplify
// GraphQL API).

import { fetchAuthSession } from "aws-amplify/auth";
import { PAYMENT_SERVICE_URL } from "./config";

export async function getStripePublishableKey(): Promise<string> {
  const response = await fetch(`${PAYMENT_SERVICE_URL}/config`);
  if (!response.ok) {
    throw new Error("Couldn't reach the payment service for the Stripe key.");
  }
  const data = (await response.json()) as { publishableKey: string };
  return data.publishableKey;
}

interface MediaPaymentSecret {
  clientSecret: string;
  paymentId: string;
}

// Creates a Stripe PaymentIntent (and the backend's Payment/PaymentMedia
// records) for buying one piece of media. Requires a signed-in session —
// the payment service authenticates the request with the Cognito access
// token, same as next-web's getMediaPaymentSecret.
export async function getMediaPaymentSecret(mediaId: string): Promise<MediaPaymentSecret> {
  const session = await fetchAuthSession();
  const jwt = session.tokens?.accessToken?.toString();
  if (!jwt) {
    throw new Error("You need to be signed in to buy media.");
  }

  const response = await fetch(`${PAYMENT_SERVICE_URL}/create-payment-intent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({ items: [{ mediaId, quantity: 1 }] }),
  });

  if (!response.ok) {
    throw new Error("Couldn't start the purchase. Please try again.");
  }

  return (await response.json()) as MediaPaymentSecret;
}
