"use client";

import { useSavedProducts } from "@/hooks/useSavedProducts";
import { X, Mic, Mouse } from "lucide-react";
import { useState } from "react";
import Image from "next/image";

export const SavedProductsList = () => {
  const { savedProducts, removeProductById } = useSavedProducts();
  const [removingId, setRemovingId] = useState<string | null>(null);

  const handleRemove = async (productId: string) => {
    try {
      setRemovingId(productId);
      await removeProductById(productId);
    } catch (error) {
      console.error("Failed to remove product:", error);
    } finally {
      setRemovingId(null);
    }
  };

  if (!savedProducts || savedProducts.length === 0) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Saved Products
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
          No saved products yet. Use voice commands or click to save products.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Saved Products
        </h2>
        <span className="px-3 py-1 text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full">
          {savedProducts.length} saved
        </span>
      </div>

      <div className="space-y-3">
        {savedProducts.map((product) => (
          <div
            key={product._id}
            className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
          >
            {/* Product Image */}
            {product.productDetails && (
              <Image
                src={product.productDetails.imageUrl}
                alt={product.productName}
                width={64}
                height={64}
                className="w-16 h-16 object-cover rounded-md border border-gray-200 dark:border-gray-700"
              />
            )}

            {/* Product Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  {product.productName}
                </p>
                {/* Badge showing how it was saved */}
                {product.savedVia === "voice" ? (
                  <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                    <Mic className="w-3 h-3" />
                    Voice
                  </span>
                ) : (
                  <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded">
                    <Mouse className="w-3 h-3" />
                    Click
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  #{product.productNumber}
                </p>
                {product.productDetails && (
                  <>
                    <span className="text-xs text-gray-400 dark:text-gray-600">•</span>
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      ${product.productDetails.price}
                    </p>
                    <span className="text-xs text-gray-400 dark:text-gray-600">•</span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {product.productDetails.category}
                    </p>
                  </>
                )}
              </div>
              {product.voiceCommand && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 italic truncate">
                  &quot;{product.voiceCommand}&quot;
                </p>
              )}
            </div>

            {/* Remove Button */}
            <button
              onClick={() => handleRemove(product.productId)}
              disabled={removingId === product.productId}
              className="flex items-center justify-center w-8 h-8 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Remove product"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>
            {savedProducts.filter((p) => p.savedVia === "voice").length} saved by voice
          </span>
          <span>
            {savedProducts.filter((p) => p.savedVia === "click").length} saved by click
          </span>
        </div>
      </div>
    </div>
  );
};
