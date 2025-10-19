import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Record voice command for analytics
export const recordCommand = mutation({
  args: {
    sessionId: v.string(),
    command: v.string(),
    intent: v.union(
      v.literal("save_product"),
      v.literal("remove_product"),
      v.literal("save_multiple"),
      v.literal("remove_multiple"),
      v.literal("unknown")
    ),
    parameters: v.object({
      numbers: v.array(v.number()),
      action: v.union(v.literal("save"), v.literal("remove")),
    }),
    successful: v.boolean(),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized: User must be authenticated");
    }

    const userId = identity.subject;

    const commandId = await ctx.db.insert("voiceCommands", {
      userId,
      sessionId: args.sessionId,
      command: args.command,
      intent: args.intent,
      parameters: args.parameters,
      executedAt: Date.now(),
      successful: args.successful,
      errorMessage: args.errorMessage,
    });

    return commandId;
  },
});

// Get voice command history for user
export const getCommandHistory = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const userId = identity.subject;
    const limit = args.limit || 50;

    return await ctx.db
      .query("voiceCommands")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);
  },
});

// Get commands by session
export const getSessionCommands = query({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    return await ctx.db
      .query("voiceCommands")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .collect();
  },
});

// Get command accuracy statistics
export const getCommandStats = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const userId = identity.subject;

    const allCommands = await ctx.db
      .query("voiceCommands")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const totalCommands = allCommands.length;
    const successfulCommands = allCommands.filter((cmd) => cmd.successful).length;
    const failedCommands = totalCommands - successfulCommands;

    const intentCounts = allCommands.reduce((acc, cmd) => {
      acc[cmd.intent] = (acc[cmd.intent] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalCommands,
      successfulCommands,
      failedCommands,
      successRate: totalCommands > 0 ? (successfulCommands / totalCommands) * 100 : 0,
      intentCounts,
    };
  },
});
