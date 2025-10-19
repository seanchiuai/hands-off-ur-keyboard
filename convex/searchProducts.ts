import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// Save a product from search results
export const saveProduct = mutation({
  args: {
    searchId: v.id("productSearches"),
    userId: v.string(),
    number: v.number(),
    title: v.string(),
    price: v.number(),
    currency: v.string(),
    imageUrl: v.optional(v.string()),
    productUrl: v.string(),
    source: v.string(),
    details: v.object({
      rating: v.optional(v.number()),
      reviewCount: v.optional(v.number()),
      availability: v.optional(v.string()),
      features: v.optional(v.array(v.string())),
      brand: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    // Verify authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.userId) {
      throw new Error("Unauthorized");
    }

    // Verify search exists and belongs to user
    const search = await ctx.db.get(args.searchId);
    if (!search || search.userId !== args.userId) {
      throw new Error("Search not found or unauthorized");
    }

    // Create product
    const productId = await ctx.db.insert("searchProducts", {
      searchId: args.searchId,
      userId: args.userId,
      number: args.number,
      title: args.title,
      price: args.price,
      currency: args.currency,
      imageUrl: args.imageUrl,
      productUrl: args.productUrl,
      source: args.source,
      details: args.details,
      createdAt: Date.now(),
    });

    return productId;
  },
});

// Save multiple products at once (for batch import from BrightData)
export const saveProducts = mutation({
  args: {
    searchId: v.id("productSearches"),
    userId: v.string(),
    products: v.array(v.object({
      number: v.number(),
      title: v.string(),
      price: v.number(),
      currency: v.string(),
      imageUrl: v.optional(v.string()),
      productUrl: v.string(),
      source: v.string(),
      details: v.object({
        rating: v.optional(v.number()),
        reviewCount: v.optional(v.number()),
        availability: v.optional(v.string()),
        features: v.optional(v.array(v.string())),
        brand: v.optional(v.string()),
      }),
    })),
  },
  handler: async (ctx, args) => {
    // Verify authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.userId) {
      throw new Error("Unauthorized");
    }

    // Verify search exists and belongs to user
    const search = await ctx.db.get(args.searchId);
    if (!search || search.userId !== args.userId) {
      throw new Error("Search not found or unauthorized");
    }

    // Insert all products
    const productIds: Id<"searchProducts">[] = [];
    for (const product of args.products) {
      const productId = await ctx.db.insert("searchProducts", {
        searchId: args.searchId,
        userId: args.userId,
        number: product.number,
        title: product.title,
        price: product.price,
        currency: product.currency,
        imageUrl: product.imageUrl,
        productUrl: product.productUrl,
        source: product.source,
        details: product.details,
        createdAt: Date.now(),
      });
      productIds.push(productId as any);
    }

    return productIds;
  },
});

// Get all products for a search, ordered by number
export const getSearchResults = query({
  args: {
    searchId: v.id("productSearches"),
  },
  handler: async (ctx, args) => {
    // Get the search to verify access
    const search = await ctx.db.get(args.searchId);
    if (!search) {
      return [];
    }

    // Verify authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== search.userId) {
      throw new Error("Unauthorized");
    }

    // Get all products for this search, ordered by number
    const products = await ctx.db
      .query("searchProducts")
      .withIndex("by_search", (q) => q.eq("searchId", args.searchId))
      .collect();

    // Sort by number
    return products.sort((a, b) => a.number - b.number);
  },
});

// Get a specific product by its number in the search
export const getProductByNumber = query({
  args: {
    searchId: v.id("productSearches"),
    number: v.number(),
  },
  handler: async (ctx, args) => {
    // Get the search to verify access
    const search = await ctx.db.get(args.searchId);
    if (!search) {
      return null;
    }

    // Verify authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== search.userId) {
      throw new Error("Unauthorized");
    }

    // Find product with matching number
    const products = await ctx.db
      .query("searchProducts")
      .filter((q) =>
        q.and(
          q.eq(q.field("searchId"), args.searchId),
          q.eq(q.field("number"), args.number)
        )
      )
      .first();

    return products;
  },
});

// Get all products for a user
export const getUserProducts = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Verify authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.userId) {
      throw new Error("Unauthorized");
    }

    const products = await ctx.db
      .query("searchProducts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(args.limit || 50);

    return products;
  },
});

// Delete a product
export const deleteProduct = mutation({
  args: {
    productId: v.id("searchProducts"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.userId) {
      throw new Error("Unauthorized");
    }

    // Verify product belongs to user
    const product = await ctx.db.get(args.productId);
    if (!product || product.userId !== args.userId) {
      throw new Error("Product not found or unauthorized");
    }

    await ctx.db.delete(args.productId);
  },
});

// Clear all products for a search
export const clearSearchProducts = mutation({
  args: {
    searchId: v.id("productSearches"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.userId) {
      throw new Error("Unauthorized");
    }

    // Verify search belongs to user
    const search = await ctx.db.get(args.searchId);
    if (!search || search.userId !== args.userId) {
      throw new Error("Search not found or unauthorized");
    }

    // Delete all products for this search
    const products = await ctx.db
      .query("searchProducts")
      .withIndex("by_search", (q) => q.eq("searchId", args.searchId))
      .collect();

    for (const product of products) {
      await ctx.db.delete(product._id);
    }
  },
});
