/* eslint-disable */
  /**
   * Generated `api` utility.
   *
   * THIS CODE IS AUTOMATICALLY GENERATED.
   *
   * To regenerate, run `npx convex dev`.
   * @module
   */
  
import type { ApiFromModules, FilterApi, FunctionReference } from "convex/server";
import { anyApi } from "convex/server";
import type * as automation from "../automation.js";
import type * as chat from "../chat.js";
import type * as crm from "../crm.js";
import type * as events from "../events.js";
import type * as ingestion from "../ingestion.js";
import type * as leads from "../leads.js";
import type * as seed from "../seed.js";
import type * as summarize from "../summarize.js";

const fullApi: ApiFromModules<{
  "automation": typeof automation,
"chat": typeof chat,
"crm": typeof crm,
"events": typeof events,
"ingestion": typeof ingestion,
"leads": typeof leads,
"seed": typeof seed,
"summarize": typeof summarize,
}> = anyApi as any;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export const api: FilterApi<typeof fullApi, FunctionReference<any, "public">> = anyApi as any;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export const internal: FilterApi<typeof fullApi, FunctionReference<any, "internal">> = anyApi as any;

// Static-hosting binding inferred from the installed component; validate with remote codegen before backend release.
import { componentsGeneric } from "convex/server";
export const components = componentsGeneric() as unknown as { staticHosting: import("@convex-dev/static-hosting/_generated/component.js").ComponentApi<"staticHosting"> };
