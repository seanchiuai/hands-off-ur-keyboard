"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id, Doc } from "@/convex/_generated/dataModel";
import { motion, AnimatePresence } from "framer-motion";
import { ExternalLink, Star, Package, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useMutation } from "convex/react";
import { useUser } from "@clerk/nextjs";

interface SearchProductsGridProps {
  searchId: Id<"productSearches">;
}

export default function SearchProductsGrid({ searchId }: SearchProductsGridProps) {
  const { user } = useUser();
  const products = useQuery(api.searchProducts.getSearchResults, { searchId });
  const search = useQuery(api.productSearch.getSearch, { searchId });
  const saveProduct = useMutation(api.savedProducts.saveProduct);
  const [savingProductId, setSavingProductId] = useState<string | null>(null);

  // Handle saving a product
  const handleSaveProduct = async (product: Doc<"searchProducts">) => {
    if (!user) return;

    try {
      setSavingProductId(product._id);
      await saveProduct({
        userId: user.id,
        productId: product._id,
        productNumber: product.number,
        productName: product.title,
        productDetails: {
          imageUrl: product.imageUrl || "",
          price: product.price,
          category: search?.parameters?.category || "general",
        },
        savedVia: "click",
      });
    } catch (error) {
      console.error("Error saving product:", error);
    } finally {
      setSavingProductId(null);
    }
  };

  if (products === undefined) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 animate-pulse"
          >
            <div className="w-full h-48 bg-gray-200 dark:bg-gray-700 rounded-lg mb-4" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (!products || products.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12">
        <div className="text-center space-y-4">
          <AlertCircle className="w-12 h-12 mx-auto text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            No products found
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Try refining your search with different keywords or criteria.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <AnimatePresence mode="popLayout">
        {products.map((product, index) => (
          <motion.div
            key={product._id}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{
              duration: 0.3,
              delay: index * 0.05,
              ease: "easeOut",
            }}
            layout
          >
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-shadow">
              {/* Product Number Badge */}
              <div className="absolute top-2 left-2 z-10">
                <div className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold text-sm shadow-lg">
                  {product.number}
                </div>
              </div>

              {/* Product Image */}
              {product.imageUrl && (
                <div className="relative w-full h-48 bg-gray-100 dark:bg-gray-700">
                  <img
                    src={product.imageUrl}
                    alt={product.title}
                    className="w-full h-full object-contain p-4"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = "https://via.placeholder.com/300x300?text=No+Image";
                    }}
                  />
                </div>
              )}

              {/* Product Details */}
              <div className="p-4 space-y-3">
                {/* Title */}
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 line-clamp-2">
                  {product.title}
                </h3>

                {/* Price */}
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {product.currency === "USD" ? "$" : product.currency}
                    {product.price.toFixed(2)}
                  </span>
                </div>

                {/* Rating and Reviews */}
                {product.details?.rating && (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {product.details.rating.toFixed(1)}
                      </span>
                    </div>
                    {product.details.reviewCount && (
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        ({product.details.reviewCount} reviews)
                      </span>
                    )}
                  </div>
                )}

                {/* Availability */}
                {product.details?.availability && (
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-green-600" />
                    <span className="text-sm text-green-600 dark:text-green-400">
                      {product.details.availability}
                    </span>
                  </div>
                )}

                {/* Brand */}
                {product.details?.brand && (
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Brand: <span className="font-medium">{product.details.brand}</span>
                  </div>
                )}

                {/* Features */}
                {product.details?.features && product.details.features.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      Key Features:
                    </p>
                    <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                      {product.details.features.slice(0, 3).map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-1">
                          <span className="text-purple-600 mt-0.5">•</span>
                          <span className="line-clamp-1">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="default"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleSaveProduct(product)}
                    disabled={savingProductId === product._id}
                  >
                    {savingProductId === product._id ? "Saving..." : "Save"}
                  </Button>
                  {product.productUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                    >
                      <a
                        href={product.productUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1"
                      >
                        <ExternalLink className="w-4 h-4" />
                        View
                      </a>
                    </Button>
                  )}
                </div>

                {/* Source */}
                <div className="text-xs text-gray-500 dark:text-gray-400 text-center pt-2 border-t border-gray-100 dark:border-gray-700">
                  Source: {product.source}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
