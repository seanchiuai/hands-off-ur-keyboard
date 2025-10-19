"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, Package, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import Image from "next/image";
import { toast } from "sonner";

export default function SavedProductsPage() {
  const { user, isLoaded } = useUser();
  const savedProducts = useQuery(api.products.getUserSavedProducts);
  const removeProductById = useMutation(api.products.removeProductById);

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <Package className="w-16 h-16 mx-auto text-gray-400" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Sign In Required
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Please sign in to view your saved products.
            </p>
            <Link href="/">
              <Button className="w-full">
                Go to Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" size="sm" className="gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Back to Shopping
                </Button>
              </Link>
              <div className="h-6 w-px bg-gray-300 dark:bg-gray-700"></div>
              <div>
                <h1 className="text-2xl font-mona-bold text-gray-900 dark:text-gray-100">
                  Saved Products
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {savedProducts ? `${savedProducts.length} items saved` : 'Loading...'}
                </p>
              </div>
            </div>
            <Package className="w-8 h-8 text-purple-600 dark:text-purple-400" />
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {savedProducts && savedProducts.length === 0 ? (
          /* Empty State */
          <Card className="py-16">
            <CardContent className="text-center space-y-4">
              <div className="w-20 h-20 mx-auto bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                <Package className="w-10 h-10 text-gray-400" />
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                No Saved Products Yet
              </h2>
              <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
                Start shopping with voice on the main dashboard, then say &quot;save product 3&quot; to save items here.
              </p>
              <Link href="/">
                <Button className="mt-4">
                  Start Voice Shopping
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          /* Product Grid */
          <div>
            <div className="mb-6 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                <strong>💬 Voice Tip:</strong> Say &quot;remove product 3&quot; while on this page to remove items from your saved list.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {savedProducts?.map((savedProduct, index) => (
                <Card key={savedProduct._id} className="group hover:shadow-lg transition-shadow">
                  <CardContent className="p-4 space-y-3">
                    {/* Product Number Badge */}
                    <div className="flex items-start justify-between">
                      <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg flex items-center justify-center">
                        <span className="text-white font-bold text-lg">
                          {index + 1}
                        </span>
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            await removeProductById({ productId: savedProduct.productId });
                            toast.success(`${savedProduct.productName} removed from saved products`);
                          } catch (error) {
                            toast.error("Failed to remove product");
                            console.error(error);
                          }
                        }}
                        className="p-2 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors"
                        aria-label="Remove product"
                      >
                        <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-600" />
                      </button>
                    </div>

                    {/* Product Image */}
                    {savedProduct.productDetails?.imageUrl ? (
                      <div className="relative w-full aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
                        <Image
                          src={savedProduct.productDetails.imageUrl}
                          alt={savedProduct.productName}
                          fill
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-full aspect-square bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 rounded-lg flex items-center justify-center">
                        <Package className="w-12 h-12 text-gray-400" />
                      </div>
                    )}

                    {/* Product Info */}
                    <div className="space-y-2">
                      <h3 className="font-medium text-gray-900 dark:text-gray-100 line-clamp-2">
                        {savedProduct.productName}
                      </h3>
                      {savedProduct.productDetails?.price && (
                        <p className="text-lg font-bold text-purple-600 dark:text-purple-400">
                          ${(savedProduct.productDetails.price / 100).toFixed(2)}
                        </p>
                      )}
                      <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Saved {savedProduct.savedVia === "voice" ? "via voice" : "manually"}
                        </p>
                        {savedProduct.voiceCommand && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 italic mt-1">
                            &quot;{savedProduct.voiceCommand}&quot;
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
