import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

/**
 * Add a transcript entry
 * Called by PipeCat agent via HTTP endpoint
 */
export const addTranscript = mutation({
  args: {
    sessionId: v.id("voiceSessions"),
    speaker: v.union(v.literal("user"), v.literal("agent")),
    text: v.string(),
    timestamp: v.number(),
    confidence: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    const userId = identity.subject;

    // Verify session exists and belongs to user
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    if (session.userId !== userId) {
      throw new Error("Unauthorized");
    }

    // Insert transcript
    const transcriptId = await ctx.db.insert("voiceTranscripts", {
      sessionId: args.sessionId,
      userId,
      speaker: args.speaker,
      text: args.text,
      timestamp: args.timestamp,
      confidence: args.confidence,
    });

    return transcriptId;
  },
});

/**
 * Get all transcripts for a session
 */
export const getSessionTranscripts = query({
  args: {
    sessionId: v.id("voiceSessions"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const userId = identity.subject;

    // Verify session belongs to user
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== userId) {
      return [];
    }

    // Get transcripts ordered by timestamp
    const transcripts = await ctx.db
      .query("voiceTranscripts")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    // Sort by timestamp ascending
    return transcripts.sort((a, b) => a.timestamp - b.timestamp);
  },
});

/**
 * Get user's recent transcripts across all sessions
 */
export const getUserTranscripts = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const userId = identity.subject;
    const limit = args.limit ?? 50;

    const transcripts = await ctx.db
      .query("voiceTranscripts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);

    return transcripts;
  },
});
