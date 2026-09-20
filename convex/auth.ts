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
 * OAuth redirect URIs to register (production domain is canonical;
 * keep the convex.site URLs registered as fallback):
 *   Google: https://leanderlive.com/api/auth/callback/google
 *           https://adventurous-ostrich-311.convex.site/api/auth/callback/google
 *   Apple:  https://leanderlive.com/api/auth/callback/apple
 *           https://adventurous-ostrich-311.convex.site/api/auth/callback/apple
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
