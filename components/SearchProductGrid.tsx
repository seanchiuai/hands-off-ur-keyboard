"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import SearchProductCard from "./SearchProductCard";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from "framer-motion";

interface SearchProductGridProps {
  searchId: Id<"productSearches">;
}

function ProductSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-56 w-full" />
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

export default function SearchProductGrid({ searchId }: SearchProductGridProps) {
  // Real-time subscription to search products
  const products = useQuery(api.searchProducts.getSearchResults, { searchId });

  if (products === undefined) {
    // Loading state with skeletons
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <ProductSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-12 bg-muted/50 rounded-lg">
        <p className="text-muted-foreground">
          No products found yet. Start speaking to discover products!
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      <AnimatePresence mode="popLayout">
        {products.map((product, index) => (
          <motion.div
            key={product._id}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{
              duration: 0.3,
              delay: index * 0.05, // Stagger animation
              ease: "easeOut",
            }}
            layout
          >
            <SearchProductCard
              number={product.number}
              title={product.title}
              price={product.price}
              currency={product.currency}
              imageUrl={product.imageUrl}
              productUrl={product.productUrl}
              source={product.source}
              productId={product._id}
              details={product.details || {}}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
