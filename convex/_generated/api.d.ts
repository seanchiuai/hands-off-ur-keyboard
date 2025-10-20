/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as functions_cron from "../functions/cron.js";
import type * as functions_items from "../functions/items.js";
import type * as functions_offers from "../functions/offers.js";
import type * as functions_reviews from "../functions/reviews.js";
import type * as functions_snapshots from "../functions/snapshots.js";
import type * as functions_wishlists from "../functions/wishlists.js";

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
  "functions/cron": typeof functions_cron;
  "functions/items": typeof functions_items;
  "functions/offers": typeof functions_offers;
  "functions/reviews": typeof functions_reviews;
  "functions/snapshots": typeof functions_snapshots;
  "functions/wishlists": typeof functions_wishlists;
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
