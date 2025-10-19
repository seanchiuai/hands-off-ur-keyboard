"use client";

import Image from "next/image";
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Check } from "lucide-react";

interface ProductCardProps {
  number: number;
  name: string;
  price: string;
  imageUrl: string;
  description: string;
  vendor?: string;
  externalUrl?: string;
  productId?: string;
}

export default function ProductCard({
  number,
  name,
  price,
  imageUrl,
  description,
  vendor,
  externalUrl,
  productId,
}: ProductCardProps) {
  const [imageError, setImageError] = useState(false);

  // Check if product is saved
  const isSaved = useQuery(
    api.products.isProductSaved,
    productId ? { productId } : "skip"
  );

  return (
    <div className={`bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-all duration-300 relative ${isSaved ? 'ring-2 ring-green-500' : ''}`}>
      {/* Product number badge */}
      <div className={`absolute top-4 left-4 rounded-full w-10 h-10 flex items-center justify-center font-bold text-lg z-10 shadow-lg ${isSaved ? 'bg-green-600' : 'bg-purple-600'} text-white`}>
        {number}
      </div>

      {/* Saved indicator badge */}
      {isSaved && (
        <div className="absolute top-4 right-4 bg-green-600 text-white rounded-full w-8 h-8 flex items-center justify-center z-10 shadow-lg animate-in fade-in zoom-in duration-300">
          <Check className="w-5 h-5" />
        </div>
      )}

      {/* Product image */}
      <div className="relative h-64 bg-gray-100">
        {!imageError ? (
          <Image
            src={imageUrl}
            alt={name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            onError={() => setImageError(true)}
            priority={number <= 3} // Prioritize first 3 images
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <svg
              className="w-16 h-16 text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Product details */}
      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-lg font-semibold text-gray-900 line-clamp-2 flex-1">
            {name}
          </h3>
          <p className="text-xl font-bold text-purple-600 ml-2 whitespace-nowrap">
            {price}
          </p>
        </div>

        {vendor && (
          <p className="text-sm text-gray-500 mb-2">by {vendor}</p>
        )}

        <p className="text-gray-600 text-sm line-clamp-3 mb-4">
          {description}
        </p>

        {externalUrl && (
          <a
            href={externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block w-full text-center bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 transition-colors duration-200 font-medium"
          >
            View Product
          </a>
        )}
      </div>
    </div>
  );
}
