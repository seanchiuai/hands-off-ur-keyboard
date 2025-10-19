/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as brightdata from "../brightdata.js";
import type * as productSearch from "../productSearch.js";
import type * as products from "../products.js";
import type * as searchCache from "../searchCache.js";
import type * as searchProducts from "../searchProducts.js";
import type * as searchRefinements from "../searchRefinements.js";
import type * as sessions from "../sessions.js";
import type * as userPreferences from "../userPreferences.js";
import type * as voiceCommands from "../voiceCommands.js";
import type * as voiceSessions from "../voiceSessions.js";
import type * as voiceTranscripts from "../voiceTranscripts.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  brightdata: typeof brightdata;
  productSearch: typeof productSearch;
  products: typeof products;
  searchCache: typeof searchCache;
  searchProducts: typeof searchProducts;
  searchRefinements: typeof searchRefinements;
  sessions: typeof sessions;
  userPreferences: typeof userPreferences;
  voiceCommands: typeof voiceCommands;
  voiceSessions: typeof voiceSessions;
  voiceTranscripts: typeof voiceTranscripts;
}>;
declare const fullApiWithMounts: typeof fullApi;

export declare const api: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "internal">
>;

export declare const components: {};
