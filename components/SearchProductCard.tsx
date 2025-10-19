"use client";

import Image from "next/image";
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Star, Check } from "lucide-react";

interface SearchProductCardProps {
  number: number;
  title: string;
  price: number;
  currency: string;
  imageUrl?: string;
  productUrl: string;
  source: string;
  productId?: string;
  details: {
    rating?: number;
    reviewCount?: number;
    availability?: string;
    features?: string[];
    brand?: string;
  };
}

export default function SearchProductCard({
  number,
  title,
  price,
  currency,
  imageUrl,
  productUrl,
  source,
  productId,
  details,
}: SearchProductCardProps) {
  const [imageError, setImageError] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Check if product is saved
  const isSaved = useQuery(
    api.products.isProductSaved,
    productId ? { productId } : "skip"
  );

  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(price);
  };

  return (
    <Card className={`overflow-hidden hover:shadow-lg transition-all duration-300 relative ${isSaved ? 'ring-2 ring-green-500' : ''}`}>
      {/* Product number badge - PROMINENT for voice reference (1-20) */}
      <div className={`absolute top-3 left-3 rounded-full w-14 h-14 flex items-center justify-center font-bold text-2xl z-10 shadow-2xl border-4 border-white dark:border-gray-800 ${isSaved ? 'bg-gradient-to-br from-green-600 to-green-700' : 'bg-gradient-to-br from-purple-600 to-blue-600'} text-white`}>
        {number}
      </div>

      {/* Saved indicator badge */}
      {isSaved && (
        <div className="absolute top-3 right-3 bg-green-600 text-white rounded-full w-10 h-10 flex items-center justify-center z-10 shadow-lg animate-in fade-in zoom-in duration-300">
          <Check className="w-6 h-6" />
        </div>
      )}

      {/* Product image */}
      <div className="relative h-56 bg-muted">
        {imageUrl && !imageError ? (
          <Image
            src={imageUrl}
            alt={title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            onError={() => setImageError(true)}
            priority={number <= 3}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <svg
              className="w-20 h-20 text-muted-foreground"
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

      <CardContent className="p-4">
        {/* Title and Price */}
        <div className="mb-3">
          <h3 className="text-lg font-semibold line-clamp-2 mb-2">
            {title}
          </h3>
          <div className="flex items-center justify-between">
            <p className="text-2xl font-bold text-primary">
              {formatPrice(price, currency)}
            </p>
            <Badge variant="outline" className="text-xs">
              {source}
            </Badge>
          </div>
        </div>

        {/* Brand */}
        {details.brand && (
          <p className="text-sm text-muted-foreground mb-2">
            by {details.brand}
          </p>
        )}

        {/* Rating and Reviews */}
        {details.rating !== undefined && (
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center">
              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              <span className="ml-1 text-sm font-medium">
                {details.rating.toFixed(1)}
              </span>
            </div>
            {details.reviewCount !== undefined && (
              <span className="text-sm text-muted-foreground">
                ({details.reviewCount.toLocaleString()} reviews)
              </span>
            )}
          </div>
        )}

        {/* Availability */}
        {details.availability && (
          <Badge
            variant={
              details.availability.toLowerCase().includes("stock")
                ? "default"
                : "secondary"
            }
            className="mb-3"
          >
            {details.availability}
          </Badge>
        )}

        {/* Features (expandable) */}
        {details.features && details.features.length > 0 && (
          <div className="mb-3">
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-sm font-medium text-primary hover:underline"
            >
              {expanded ? "Hide" : "Show"} Features
            </button>
            {expanded && (
              <ul className="mt-2 space-y-1">
                {details.features.map((feature, index) => (
                  <li key={index} className="text-sm text-muted-foreground flex items-start">
                    <span className="mr-2">•</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* View Product Button */}
        {productUrl && (
          <Button
            asChild
            className="w-full"
            variant="default"
          >
            <a
              href={productUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2"
            >
              View Product
              <ExternalLink className="w-4 h-4" />
            </a>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
