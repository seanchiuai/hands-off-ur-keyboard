import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Create new voice shopping session
export const createSession = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const sessionId = await ctx.db.insert("voiceSessions", {
      userId: identity.subject,
      status: "active",
      startedAt: Date.now(),
    });

    return sessionId;
  },
});

// Get active session for current user
export const getActiveSession = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    // Find most recent active session
    const sessions = await ctx.db
      .query("voiceSessions")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .filter((q) => q.eq(q.field("status"), "active"))
      .order("desc")
      .take(1);

    return sessions[0] || null;
  },
});

// Complete shopping session
export const completeSession = mutation({
  args: {
    sessionId: v.id("voiceSessions"),
  },
  handler: async (ctx, { sessionId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const session = await ctx.db.get(sessionId);
    if (!session || session.userId !== identity.subject) {
      throw new Error("Session not found");
    }

    await ctx.db.patch(sessionId, {
      status: "ended",
      endedAt: Date.now(),
    });
  },
});
