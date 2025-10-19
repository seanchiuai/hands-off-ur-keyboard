import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

/**
 * Create a new voice session
 * Called after creating a Daily room
 */
export const createSession = mutation({
  args: {
    roomUrl: v.string(),
    roomName: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    const userId = identity.subject;

    // Check if user already has an active session
    const existingSession = await ctx.db
      .query("voiceSessions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();

    // If there's an existing active session, end it first
    if (existingSession) {
      const duration = Date.now() - existingSession.startedAt;
      await ctx.db.patch(existingSession._id, {
        status: "ended",
        endedAt: Date.now(),
        metadata: {
          duration,
          autoEnded: true, // Mark that this was auto-ended
        },
      });
    }

    // Create new session
    const sessionId = await ctx.db.insert("voiceSessions", {
      userId,
      roomUrl: args.roomUrl,
      roomName: args.roomName,
      status: "active",
      startedAt: Date.now(),
    });

    return {
      sessionId,
      roomUrl: args.roomUrl,
      roomName: args.roomName,
    };
  },
});

/**
 * End an active voice session
 */
export const endSession = mutation({
  args: {
    sessionId: v.id("voiceSessions"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    const userId = identity.subject;

    // Get the session
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    // Verify ownership
    if (session.userId !== userId) {
      throw new Error("Unauthorized");
    }

    // Calculate duration
    const duration = Date.now() - session.startedAt;

    // Update session
    await ctx.db.patch(args.sessionId, {
      status: "ended",
      endedAt: Date.now(),
      metadata: {
        duration,
      },
    });

    return { success: true };
  },
});

/**
 * Mark session as error state
 */
export const markSessionError = mutation({
  args: {
    sessionId: v.id("voiceSessions"),
    errorMessage: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    const userId = identity.subject;

    // Get the session
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    // Verify ownership
    if (session.userId !== userId) {
      throw new Error("Unauthorized");
    }

    // Update session
    await ctx.db.patch(args.sessionId, {
      status: "error",
      endedAt: Date.now(),
      metadata: {
        errorMessage: args.errorMessage,
      },
    });

    return { success: true };
  },
});

/**
 * Get user's active voice session
 */
export const getActiveSession = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const userId = identity.subject;

    return await ctx.db
      .query("voiceSessions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();
  },
});

/**
 * Get user's voice session history
 */
export const getSessionHistory = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const userId = identity.subject;
    const limit = args.limit ?? 10;

    const sessions = await ctx.db
      .query("voiceSessions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);

    return sessions;
  },
});
