import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Helper function to format price
function formatPrice(cents: number, currency: string): string {
  const dollars = cents / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
  }).format(dollars);
}

// Add product discovered by voice agent
export const addProduct = mutation({
  args: {
    sessionId: v.id("voiceSessions"),
    name: v.string(),
    price: v.number(),
    currency: v.string(),
    imageUrl: v.string(),
    description: v.string(),
    vendor: v.optional(v.string()),
    externalUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Verify session exists and is active
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Session not found");
    }
    if (session.status !== "active") {
      throw new Error("Cannot add products to inactive session");
    }

    // Verify user authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== session.userId) {
      throw new Error("Unauthorized");
    }

    // Get next position number for this session
    const existingProducts = await ctx.db
      .query("products")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    const position = existingProducts.length + 1;

    // Insert product with auto-generated timestamp
    const productId = await ctx.db.insert("products", {
      sessionId: args.sessionId,
      name: args.name,
      price: args.price,
      currency: args.currency,
      imageUrl: args.imageUrl,
      description: args.description,
      vendor: args.vendor,
      externalUrl: args.externalUrl,
      position,
      createdAt: Date.now(),
    });

    return productId;
  },
});

// Query products for a specific session (real-time)
export const listSessionProducts = query({
  args: {
    sessionId: v.id("voiceSessions"),
  },
  handler: async (ctx, { sessionId }) => {
    // Verify session access
    const session = await ctx.db.get(sessionId);
    if (!session) {
      return [];
    }

    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== session.userId) {
      throw new Error("Unauthorized");
    }

    // Fetch products ordered by position
    const products = await ctx.db
      .query("products")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .order("asc")
      .collect();

    // Return with formatted price for display
    return products.map((product) => ({
      ...product,
      formattedPrice: formatPrice(product.price, product.currency),
    }));
  },
});

// Save product with voice command support
export const saveProduct = mutation({
  args: {
    productId: v.string(),
    productNumber: v.number(), // Voice reference number
    savedVia: v.optional(v.union(v.literal("voice"), v.literal("click"))),
    voiceCommand: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Verify authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized: User must be authenticated");
    }

    const userId = identity.subject;

    // Check if already saved
    const existing = await ctx.db
      .query("savedProducts")
      .withIndex("by_user_and_product", (q) =>
        q.eq("userId", userId).eq("productId", args.productId)
      )
      .first();

    if (existing) {
      // Update existing entry's number if changed
      await ctx.db.patch(existing._id, {
        productNumber: args.productNumber,
        lastModified: Date.now(),
        savedVia: args.savedVia || "click",
        voiceCommand: args.voiceCommand,
      });
      return { success: true, action: "updated", productId: args.productId };
    }

    // For demo purposes, create mock product details
    // In production, fetch from actual products table
    const productName = `Product ${args.productNumber}`;

    // Create new saved product entry
    const savedId = await ctx.db.insert("savedProducts", {
      userId,
      productId: args.productId,
      productNumber: args.productNumber,
      productName,
      productDetails: {
        imageUrl: `https://via.placeholder.com/150?text=Product+${args.productNumber}`,
        price: Math.floor(Math.random() * 100) + 10,
        category: "Electronics",
      },
      savedAt: Date.now(),
      lastModified: Date.now(),
      savedVia: args.savedVia || "click",
      voiceCommand: args.voiceCommand,
    });

    return {
      success: true,
      action: "saved",
      productId: args.productId,
      savedId,
    };
  },
});

// Remove product by number (voice command)
export const removeProductByNumber = mutation({
  args: { productNumber: v.number() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized: User must be authenticated");
    }

    const userId = identity.subject;

    // Find product by number
    const savedProduct = await ctx.db
      .query("savedProducts")
      .withIndex("by_user_and_number", (q) =>
        q.eq("userId", userId).eq("productNumber", args.productNumber)
      )
      .first();

    if (!savedProduct) {
      throw new Error(`No saved product found with number ${args.productNumber}`);
    }

    // Delete the saved product
    await ctx.db.delete(savedProduct._id);

    return {
      success: true,
      action: "removed",
      productNumber: args.productNumber,
      productName: savedProduct.productName,
    };
  },
});

// Remove product by ID (click interface)
export const removeProductById = mutation({
  args: { productId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized: User must be authenticated");
    }

    const userId = identity.subject;

    // Find product by ID
    const savedProduct = await ctx.db
      .query("savedProducts")
      .withIndex("by_user_and_product", (q) =>
        q.eq("userId", userId).eq("productId", args.productId)
      )
      .first();

    if (!savedProduct) {
      throw new Error(`Product not found in saved list`);
    }

    // Delete the saved product
    await ctx.db.delete(savedProduct._id);

    return {
      success: true,
      action: "removed",
      productId: args.productId,
      productName: savedProduct.productName,
    };
  },
});

// Batch save products
export const saveBatch = mutation({
  args: {
    products: v.array(
      v.object({
        productId: v.string(),
        productNumber: v.number(),
      })
    ),
    voiceCommand: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized: User must be authenticated");
    }

    const userId = identity.subject;
    let successCount = 0;
    const failedNumbers: number[] = [];

    for (const product of args.products) {
      try {
        // Check if already saved
        const existing = await ctx.db
          .query("savedProducts")
          .withIndex("by_user_and_product", (q) =>
            q.eq("userId", userId).eq("productId", product.productId)
          )
          .first();

        if (existing) {
          // Update existing
          await ctx.db.patch(existing._id, {
            productNumber: product.productNumber,
            lastModified: Date.now(),
            savedVia: "voice",
            voiceCommand: args.voiceCommand,
          });
        } else {
          // Create new
          await ctx.db.insert("savedProducts", {
            userId,
            productId: product.productId,
            productNumber: product.productNumber,
            productName: `Product ${product.productNumber}`,
            productDetails: {
              imageUrl: `https://via.placeholder.com/150?text=Product+${product.productNumber}`,
              price: Math.floor(Math.random() * 100) + 10,
              category: "Electronics",
            },
            savedAt: Date.now(),
            lastModified: Date.now(),
            savedVia: "voice",
            voiceCommand: args.voiceCommand,
          });
        }
        successCount++;
      } catch (error) {
        failedNumbers.push(product.productNumber);
        console.error(`Failed to save product ${product.productNumber}:`, error);
      }
    }

    return { successCount, failedNumbers };
  },
});

// Batch remove products
export const removeBatch = mutation({
  args: {
    productNumbers: v.array(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized: User must be authenticated");
    }

    const userId = identity.subject;
    let successCount = 0;
    const failedNumbers: number[] = [];

    for (const productNumber of args.productNumbers) {
      try {
        const savedProduct = await ctx.db
          .query("savedProducts")
          .withIndex("by_user_and_number", (q) =>
            q.eq("userId", userId).eq("productNumber", productNumber)
          )
          .first();

        if (savedProduct) {
          await ctx.db.delete(savedProduct._id);
          successCount++;
        } else {
          failedNumbers.push(productNumber);
        }
      } catch (error) {
        failedNumbers.push(productNumber);
        console.error(`Failed to remove product ${productNumber}:`, error);
      }
    }

    return { successCount, failedNumbers };
  },
});

// Get all saved products for user (real-time subscription)
export const getUserSavedProducts = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const userId = identity.subject;

    return await ctx.db
      .query("savedProducts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

// Check if specific product is saved
export const isProductSaved = query({
  args: { productId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return false;
    }

    const userId = identity.subject;

    const savedProduct = await ctx.db
      .query("savedProducts")
      .withIndex("by_user_and_product", (q) =>
        q.eq("userId", userId).eq("productId", args.productId)
      )
      .first();

    return savedProduct !== null;
  },
});
