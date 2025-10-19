"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface PreferenceTagProps {
  preference: {
    _id: string;
    tag: string;
    category: string;
    priority: number;
  };
  onRemove: () => void;
  className?: string;
}

// Category color mapping
const categoryColors: Record<string, { bg: string; text: string; border: string }> = {
  material: {
    bg: "bg-green-50 dark:bg-green-950/30",
    text: "text-green-700 dark:text-green-300",
    border: "border-green-200 dark:border-green-800",
  },
  price: {
    bg: "bg-blue-50 dark:bg-blue-950/30",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-200 dark:border-blue-800",
  },
  size: {
    bg: "bg-purple-50 dark:bg-purple-950/30",
    text: "text-purple-700 dark:text-purple-300",
    border: "border-purple-200 dark:border-purple-800",
  },
  feature: {
    bg: "bg-orange-50 dark:bg-orange-950/30",
    text: "text-orange-700 dark:text-orange-300",
    border: "border-orange-200 dark:border-orange-800",
  },
  color: {
    bg: "bg-pink-50 dark:bg-pink-950/30",
    text: "text-pink-700 dark:text-pink-300",
    border: "border-pink-200 dark:border-pink-800",
  },
  style: {
    bg: "bg-yellow-50 dark:bg-yellow-950/30",
    text: "text-yellow-700 dark:text-yellow-300",
    border: "border-yellow-200 dark:border-yellow-800",
  },
  other: {
    bg: "bg-gray-50 dark:bg-gray-950/30",
    text: "text-gray-700 dark:text-gray-300",
    border: "border-gray-200 dark:border-gray-800",
  },
};

export function PreferenceTag({ preference, onRemove, className }: PreferenceTagProps) {
  const colors = categoryColors[preference.category] || categoryColors.other;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-all",
        colors.bg,
        colors.text,
        colors.border,
        "hover:shadow-sm",
        className
      )}
    >
      <span className="max-w-[200px] truncate">{preference.tag}</span>
      <button
        onClick={onRemove}
        className={cn(
          "ml-0.5 p-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-offset-1",
          colors.text
        )}
        aria-label={`Remove ${preference.tag} preference`}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
