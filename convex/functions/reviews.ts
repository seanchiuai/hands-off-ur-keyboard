import { v } from "convex/values";
import { action, mutation, query } from "../_generated/server";
import { api } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { searchReviewsRedditYouTube } from "../../lib/serpapi";
import { geminiSummarizeProsCons } from "../../lib/gemini";

const DAY_MS = 24 * 60 * 60 * 1000;

export const getReviewSummary = query({
  args: {
    itemId: v.id("items"),
    source: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { itemId, source } = args;

    const cache = await ctx.db
      .query("reviewCache")
      .withIndex("byItemSource", (q) =>
        q.eq("itemId", itemId).eq("source", source ?? "mixed")
      )
      .order("desc")
      .first();

    if (!cache) {
      return null;
    }

    return cache;
  },
});

export const upsertReviewSummary = mutation({
  args: {
    itemId: v.id("items"),
    source: v.string(),
    query: v.string(),
    summary: v.string(),
    capturedAt: v.number(),
    pros: v.optional(v.array(v.string())),
    cons: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("reviewCache")
      .withIndex("byItemSource", (q) =>
        q.eq("itemId", args.itemId).eq("source", args.source)
      )
      .order("desc")
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        query: args.query,
        summary: args.summary,
        capturedAt: args.capturedAt,
        pros: args.pros ?? undefined,
        cons: args.cons ?? undefined,
      });
      const updated = await ctx.db.get(existing._id);
      if (!updated) {
        throw new Error("Updated review summary not found");
      }
      return updated;
    }

    const insertedId = await ctx.db.insert("reviewCache", {
      itemId: args.itemId,
      source: args.source,
      query: args.query,
      summary: args.summary,
      capturedAt: args.capturedAt,
      pros: args.pros ?? undefined,
      cons: args.cons ?? undefined,
    });
    const created = await ctx.db.get(insertedId);
    if (!created) {
      throw new Error("Failed to insert review summary");
    }
    return created;
  },
});

export const refreshReviews = action({
  args: {
    itemId: v.id("items"),
    query: v.string(),
  },
  handler: async (ctx, args): Promise<Doc<"reviewCache">> => {
    const existing = await ctx.runQuery(api.functions.reviews.getReviewSummary, {
      itemId: args.itemId,
      source: "mixed",
    });

    if (existing && Date.now() - existing.capturedAt < DAY_MS) {
      return existing;
    }

    const { reddit, youtube } = await searchReviewsRedditYouTube(args.query);
    const snippets: string[] = [];

    if (reddit?.organic_results) {
      for (const result of reddit.organic_results) {
        if (typeof result.snippet === "string") {
          snippets.push(result.snippet);
        }
      }
    }

    if (youtube?.video_results) {
      for (const result of youtube.video_results) {
        if (typeof result.title === "string") {
          snippets.push(result.title);
        }
        if (typeof result.description === "string") {
          snippets.push(result.description);
        }
      }
    }

    const summary = await geminiSummarizeProsCons(snippets.slice(0, 12));

    const payload = {
      itemId: args.itemId,
      source: "mixed" as const,
      query: args.query,
      summary: JSON.stringify(summary),
      capturedAt: Date.now(),
      pros: summary.pros,
      cons: summary.cons,
    };

    return await ctx.runMutation(api.functions.reviews.upsertReviewSummary, payload);
  },
});
