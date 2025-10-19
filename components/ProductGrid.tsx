"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import ProductCard from "./ProductCard";
import ProductSkeleton from "./ProductSkeleton";
import { motion, AnimatePresence } from "framer-motion";

interface ProductGridProps {
  sessionId: Id<"voiceSessions">;
}

export default function ProductGrid({ sessionId }: ProductGridProps) {
  // Real-time subscription to products
  const products = useQuery(api.products.listSessionProducts, { sessionId });

  if (products === undefined) {
    // Loading state with skeletons
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <ProductSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="mt-8 text-center py-12 bg-white rounded-lg shadow">
        <p className="text-gray-500">No products found yet. Start speaking to discover products!</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
      <AnimatePresence mode="popLayout">
        {products.map((product, index) => (
          <motion.div
            key={product._id}
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{
              duration: 0.3,
              delay: index * 0.1, // Stagger animation
              ease: "easeOut",
            }}
            layout
          >
            <ProductCard
              number={product.position}
              name={product.name}
              price={product.formattedPrice}
              imageUrl={product.imageUrl}
              description={product.description}
              vendor={product.vendor}
              externalUrl={product.externalUrl}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
