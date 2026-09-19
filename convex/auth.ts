import { convexAuth } from "@convex-dev/auth/server";
import Google from "@auth/core/providers/google";
import Apple from "@auth/core/providers/apple";

/**
 * Convex Auth: Google + Apple OAuth.
 *
 * Required Convex env vars (set with `npx convex env set --prod`):
 *   AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET       — Google Cloud OAuth client
 *   AUTH_APPLE_ID / AUTH_APPLE_SECRET         — Apple Services ID + client-secret JWT
 *
 * OAuth redirect URIs to register:
 *   Google: https://adventurous-ostrich-311.convex.site/api/auth/callback/google
 *   Apple:  https://adventurous-ostrich-311.convex.site/api/auth/callback/apple
 */
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
    Apple({
      clientId: process.env.AUTH_APPLE_ID,
      clientSecret: process.env.AUTH_APPLE_SECRET,
    }),
  ],
});
