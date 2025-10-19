import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { generateQueryHash } from "./searchCache";

// Type definitions for BrightData responses
interface BrightDataProduct {
  name?: string;
  title?: string;
  price?: string | number;
  rating?: number;
  review_count?: number;
  reviews?: number;
  url?: string;
  link?: string;
  image?: string;
  image_url?: string;
  brand?: string;
  availability?: string;
  features?: string[];
  currency?: string;
  retailer?: string;
  source?: string;
}

interface BrightDataResponse {
  products?: BrightDataProduct[];
  results?: BrightDataProduct[];
  items?: BrightDataProduct[];
  data?: BrightDataProduct[];
}

// Normalize price string to number
function parsePrice(price: string | number | undefined): number {
  if (typeof price === "number") return price;
  if (!price) return 0;

  // Remove currency symbols and commas, extract number
  const cleaned = String(price).replace(/[^0-9.]/g, "");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

// Normalize product data from various sources
function normalizeProduct(
  product: BrightDataProduct,
  number: number
): {
  number: number;
  title: string;
  price: number;
  currency: string;
  imageUrl?: string;
  productUrl: string;
  source: string;
  details: {
    rating?: number;
    reviewCount?: number;
    availability?: string;
    features?: string[];
    brand?: string;
  };
} {
  return {
    number,
    title: product.title || product.name || "Unknown Product",
    price: parsePrice(product.price),
    currency: product.currency || "USD",
    imageUrl: product.image_url || product.image,
    productUrl: product.url || product.link || "",
    source: product.source || product.retailer || "brightdata",
    details: {
      rating: product.rating,
      reviewCount: product.review_count || product.reviews,
      availability: product.availability,
      features: product.features,
      brand: product.brand,
    },
  };
}

// Search products using BrightData API
export const searchProducts = action({
  args: {
    searchId: v.id("productSearches"),
    userId: v.string(),
    parameters: v.object({
      query: v.string(),
      category: v.optional(v.string()),
      priceMin: v.optional(v.number()),
      priceMax: v.optional(v.number()),
      brand: v.optional(v.string()),
      rating: v.optional(v.number()),
      features: v.optional(v.array(v.string())),
      keywords: v.optional(v.array(v.string())),
    }),
  },
  handler: async (ctx, args): Promise<{ success: boolean; productCount: number }> => {
    try {
      // Verify authentication
      const identity = await ctx.auth.getUserIdentity();
      if (!identity || identity.subject !== args.userId) {
        throw new Error("Unauthorized");
      }

      // Update search status to searching
      await ctx.runMutation(api.productSearch.updateSearchStatus, {
        searchId: args.searchId,
        status: "searching",
      });

      // Generate cache hash
      const queryHash = generateQueryHash(args.parameters);

      // Check cache first
      const cachedResults: any = await ctx.runQuery(api.searchCache.getCachedSearch, {
        queryHash,
      });

      if (cachedResults && cachedResults.length > 0) {
        // Use cached results
        await ctx.runMutation(api.searchProducts.saveProducts, {
          searchId: args.searchId,
          userId: args.userId,
          products: cachedResults,
        });

        await ctx.runMutation(api.productSearch.updateSearchStatus, {
          searchId: args.searchId,
          status: "completed",
        });

        return {
          success: true,
          productCount: cachedResults.length,
        };
      }

      // Call BrightData API (or fallback to mock data if not configured)
      const apiKey = process.env.BRIGHTDATA_API_KEY;
      const endpoint = process.env.BRIGHTDATA_MCP_ENDPOINT;

      let products: any[] = [];

      if (!apiKey || !endpoint) {
        // Mock data for development/testing
        console.warn("BrightData API not configured. Using mock data.");
        products = generateMockProducts(args.parameters);
      } else {
        // Make actual BrightData API call
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            query: args.parameters.query,
            filters: {
              category: args.parameters.category,
              price_range: {
                min: args.parameters.priceMin,
                max: args.parameters.priceMax,
              },
              brand: args.parameters.brand,
              rating_min: args.parameters.rating,
            },
            limit: 5, // Top 5 for voice navigation
          }),
        });

        if (!response.ok) {
          throw new Error(`BrightData API error: ${response.statusText}`);
        }

        const data: BrightDataResponse = await response.json();

        // Extract products from various possible response formats
        products = data.products || data.results || data.items || data.data || [];
      }

      // Normalize and limit to top 5 results
      const normalizedProducts = products
        .slice(0, 5)
        .map((product, index) => normalizeProduct(product, index + 1));

      // Save products to database
      if (normalizedProducts.length > 0) {
        await ctx.runMutation(api.searchProducts.saveProducts, {
          searchId: args.searchId,
          userId: args.userId,
          products: normalizedProducts,
        });

        // Cache the results
        await ctx.runMutation(api.searchCache.cacheSearchResults, {
          queryHash,
          results: normalizedProducts,
          ttlMinutes: 60, // Cache for 1 hour
        });
      }

      // Update search status to completed
      await ctx.runMutation(api.productSearch.updateSearchStatus, {
        searchId: args.searchId,
        status: "completed",
      });

      return {
        success: true,
        productCount: normalizedProducts.length,
      };
    } catch (error) {
      console.error("Error searching products:", error);

      // Update search status to failed
      await ctx.runMutation(api.productSearch.updateSearchStatus, {
        searchId: args.searchId,
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Failed to search products",
      });

      throw error;
    }
  },
});

// Generate mock products for development/testing
function generateMockProducts(parameters: any): BrightDataProduct[] {
  const query = parameters.query || "product";
  const maxPrice = parameters.priceMax || 1000;
  const minPrice = parameters.priceMin || 10;

  return [
    {
      name: `${query} - Premium Edition`,
      price: Math.min(maxPrice * 0.8, minPrice + (maxPrice - minPrice) * 0.8),
      rating: 4.5,
      review_count: 234,
      url: "https://example.com/product-1",
      image_url: "https://via.placeholder.com/300x300?text=Product+1",
      brand: "Brand A",
      availability: "In Stock",
      features: ["Feature 1", "Feature 2", "Premium Quality"],
      currency: "USD",
      retailer: "mock-store",
    },
    {
      name: `${query} - Standard`,
      price: Math.min(maxPrice * 0.5, minPrice + (maxPrice - minPrice) * 0.5),
      rating: 4.2,
      review_count: 456,
      url: "https://example.com/product-2",
      image_url: "https://via.placeholder.com/300x300?text=Product+2",
      brand: "Brand B",
      availability: "In Stock",
      features: ["Feature 1", "Standard Quality"],
      currency: "USD",
      retailer: "mock-store",
    },
    {
      name: `${query} - Budget`,
      price: Math.max(minPrice, maxPrice * 0.3),
      rating: 4.0,
      review_count: 789,
      url: "https://example.com/product-3",
      image_url: "https://via.placeholder.com/300x300?text=Product+3",
      brand: "Brand C",
      availability: "In Stock",
      features: ["Basic Features"],
      currency: "USD",
      retailer: "mock-store",
    },
    {
      name: `${query} - Deluxe`,
      price: Math.min(maxPrice * 0.9, minPrice + (maxPrice - minPrice) * 0.9),
      rating: 4.7,
      review_count: 123,
      url: "https://example.com/product-4",
      image_url: "https://via.placeholder.com/300x300?text=Product+4",
      brand: "Brand D",
      availability: "Limited Stock",
      features: ["Premium Features", "Extended Warranty"],
      currency: "USD",
      retailer: "mock-store",
    },
    {
      name: `${query} - Pro`,
      price: maxPrice,
      rating: 4.8,
      review_count: 567,
      url: "https://example.com/product-5",
      image_url: "https://via.placeholder.com/300x300?text=Product+5",
      brand: "Brand E",
      availability: "In Stock",
      features: ["Professional Grade", "All Features"],
      currency: "USD",
      retailer: "mock-store",
    },
  ];
}
