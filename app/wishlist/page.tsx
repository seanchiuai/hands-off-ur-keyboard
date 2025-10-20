"use client";

import { useMemo } from "react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { toast } from "sonner";
import { useMutation, useQuery } from "convex/react";
import { Loader2, Trash2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Doc } from "@/convex/_generated/dataModel";

const formatMoney = (cents: number | undefined | null) =>
  typeof cents === "number" ? `$${(cents / 100).toFixed(2)}` : "—";

export default function WishlistPage() {
  const { user } = useUser();
  const wishlist = useQuery(
    api.functions.wishlists.listWishlists,
    user ? { clerkId: user.id } : "skip"
  ) as Doc<"wishlists">[] | undefined;
  const items = useQuery(
    api.functions.items.listItems,
    user ? { ownerClerkId: user.id } : "skip"
  ) as Doc<"items">[] | undefined;
  const removeWishlist = useMutation(api.functions.wishlists.removeFromWishlist);

  type WishlistItemPair = { entry: Doc<"wishlists">; item: Doc<"items"> };

  const merged = useMemo<WishlistItemPair[]>(() => {
    if (!wishlist || !items) return [];
    return wishlist
      .map((entry: Doc<"wishlists">) => {
        const item = items.find((it: Doc<"items">) => it._id === entry.itemId);
        return item ? { entry, item } : null;
      })
      .filter((pair): pair is WishlistItemPair => pair !== null);
  }, [wishlist, items]);

  if (!user) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-2xl items-center justify-center px-4">
        <p className="text-center text-sm text-slate-500 dark:text-slate-400">
          Sign in to manage your wishlist alerts.
        </p>
      </div>
    );
  }

  if (!wishlist || !items) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-50">
          Wishlist alerts
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Targets trigger notifications when the total price falls below your threshold or beats your desired drop percentage.
        </p>
      </header>

      {merged.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200 p-12 text-center dark:border-slate-800">
          <p className="text-base font-medium text-slate-600 dark:text-slate-300">
            Your wishlist is empty.
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Visit any item page to set a target price and we will alert you when it is time.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {merged.map(({ entry, item }) => (
            <div
              key={entry._id}
              className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 md:flex-row md:items-center md:justify-between"
            >
              <div className="space-y-2">
                <Link
                  href={`/item/${item!._id}`}
                  className="text-lg font-semibold text-slate-900 hover:text-purple-600 dark:text-slate-100 dark:hover:text-purple-300"
                >
                  {item!.title}
                </Link>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Added {new Date(entry.createdAt).toLocaleDateString()}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  {entry.targetCents && (
                    <Badge variant="outline" className="border-purple-300 text-purple-600 dark:border-purple-500/80 dark:text-purple-200">
                      Target {formatMoney(entry.targetCents)}
                    </Badge>
                  )}
                  {entry.dropPercent && (
                    <Badge variant="outline" className="border-emerald-300 text-emerald-600 dark:border-emerald-500/70 dark:text-emerald-200">
                      {entry.dropPercent}% drop
                    </Badge>
                  )}
                  {entry.priority && (
                    <Badge variant="outline">
                      Priority: {entry.priority.toUpperCase()}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 self-end md:self-center">
                <Button
                  variant="ghost"
                  className="text-slate-500 hover:text-red-500"
                  onClick={async () => {
                    await removeWishlist({ wishlistId: entry._id });
                    toast.success("Removed from wishlist.");
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remove
                </Button>
                <Link href={`/item/${item!._id}`}>
                  <Button className="bg-purple-600 hover:bg-purple-700">
                    View item
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
