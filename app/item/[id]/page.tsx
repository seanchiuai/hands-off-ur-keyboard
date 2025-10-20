"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { notFound, useParams } from "next/navigation";
import Link from "next/link";
import { ChevronsLeft, Loader2, TrendingUp } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { PriceChart } from "@/components/PriceChart";
import { CompareTable } from "@/components/CompareTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { dealScore, isFakeSale, verdict } from "@/lib/pricing";
import { toast } from "sonner";
import { Id, type Doc } from "@/convex/_generated/dataModel";

const formatMoney = (cents: number | undefined | null) =>
  typeof cents === "number" ? `$${(cents / 100).toFixed(2)}` : "—";

export default function ItemDetailPage() {
  const params = useParams<{ id: string }>();
  const { user } = useUser();
  const [wishlistTarget, setWishlistTarget] = useState("");
  const [isSavingWishlist, setIsSavingWishlist] = useState(false);

  const itemId = params.id as Id<"items">;

  const detail = useQuery(api.functions.items.getItem, {
    itemId,
  });
  const stats = useQuery(api.functions.snapshots.getStats, {
    itemId,
  });
  const reviewSummary = useQuery(api.functions.reviews.getReviewSummary, {
    itemId,
    source: "mixed",
  });
  const wishlistEntry = useQuery(
    api.functions.wishlists.getWishlistForItem,
    user && detail?.item
      ? {
          clerkId: user.id,
          itemId: detail.item._id,
        }
      : "skip"
  );

  const addWishlist = useMutation(api.functions.wishlists.addToWishlist);
  const updateWishlist = useMutation(api.functions.wishlists.updateWishlist);

  const content = useMemo(() => {
    if (!detail) {
      return null;
    }
    const offers = detail.offers ?? [];
    const priceHistory =
      detail.snapshots?.map((snapshot: Doc<"snapshots">) => ({
        timestamp: snapshot.capturedAt,
        totalCents: snapshot.totalCents,
      })) ?? [];

    const derivedStats = stats ?? { mean90: 0, min90: 0, stdev90: 0 };
    const currentTotal = offers[0]?.normalizedTotalCents ?? offers[0]?.priceCents ?? 0;
    const score = currentTotal
      ? dealScore(
          currentTotal,
          derivedStats,
          offers[0]?.inStock ?? true,
          offers[0]?.rating ?? undefined
        )
      : 0;
    const currentVerdict = verdict(score);
    const fakeSaleFlag = currentTotal
      ? isFakeSale(currentTotal, derivedStats)
      : false;

    return {
      offers,
      priceHistory,
      derivedStats,
      currentTotal,
      score,
      currentVerdict,
      fakeSaleFlag,
    };
  }, [detail, stats]);

  if (detail === null) {
    notFound();
  }

  if (!detail || !content) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
      </div>
    );
  }

  const { item } = detail;
  const {
    offers,
    priceHistory,
    derivedStats,
    currentTotal,
    currentVerdict,
    fakeSaleFlag,
  } = content;

  const handleWishlistSave = async () => {
    if (!user || !item) {
      toast.error("Sign in to manage your wishlist.");
      return;
    }
    const cents = Math.round(Number(wishlistTarget || 0) * 100);
    if (!cents) {
      toast.error("Enter a valid target price.");
      return;
    }
    setIsSavingWishlist(true);
    try {
      if (wishlistEntry) {
        await updateWishlist({
          wishlistId: wishlistEntry._id,
          updates: { targetCents: cents },
        });
        toast.success("Wishlist updated.");
      } else {
        await addWishlist({
          clerkId: user.id,
          itemId: item._id,
          targetCents: cents,
          dropPercent: undefined,
          priority: undefined,
          notes: undefined,
        });
        toast.success("Added to wishlist!");
      }
    } catch (error) {
      console.error(error);
      toast.error("Unable to save wishlist entry.");
    } finally {
      setIsSavingWishlist(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-10">
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-slate-500 transition hover:text-purple-600 dark:text-slate-400 dark:hover:text-purple-300"
        >
          <ChevronsLeft className="h-4 w-4" />
          Back to tracker
        </Link>
        <Badge variant="outline">
          Last checked {item.lastCheckedAt ? new Date(item.lastCheckedAt).toLocaleString() : "never"}
        </Badge>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-50">
              {item.title}
            </h1>
            {(item.brand || item.model || item.metadata?.variant) && (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {[item.brand, item.model, item.metadata?.variant]
                  .filter(Boolean)
                  .join(" • ")}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              {currentVerdict === "buy_now" && (
                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-1.5 text-sm font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
                  <TrendingUp className="h-4 w-4" />
                  Strong buy signal
                </span>
              )}
              {fakeSaleFlag && (
                <span className="inline-flex items-center rounded-full bg-red-100 px-4 py-1.5 text-sm font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-200">
                  Might be a fake sale
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 text-right">
            <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Current total
            </p>
            <p className="text-3xl font-semibold text-slate-900 dark:text-slate-100">
              {formatMoney(currentTotal)}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Mean 90d: {formatMoney(derivedStats.mean90)} · Min:{" "}
              {formatMoney(derivedStats.min90)}
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-[2fr_1fr]">
          <PriceChart
            data={priceHistory}
            mean90={derivedStats.mean90}
            min90={derivedStats.min90}
          />

          <div className="flex flex-col rounded-xl border border-slate-200 bg-slate-50/80 p-6 dark:border-slate-800 dark:bg-slate-900/60">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Wishlist alert
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Get notified when the total price drops below your target.
            </p>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Target price (USD)"
              className="mt-4 w-full rounded-lg border border-slate-200 bg-white p-2 text-sm text-slate-700 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              value={wishlistTarget}
              onChange={(event) => setWishlistTarget(event.target.value)}
            />
            <Button
              className="mt-4 bg-purple-600 hover:bg-purple-700"
              onClick={handleWishlistSave}
              disabled={isSavingWishlist}
            >
              {isSavingWishlist ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : wishlistEntry ? (
                "Update target"
              ) : (
                "Add to wishlist"
              )}
            </Button>
            {wishlistEntry?.targetCents && (
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                Current target: {formatMoney(wishlistEntry.targetCents)}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          Multi-store comparison
        </h2>
        <CompareTable offers={offers} />
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            Review highlights
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              toast.info("Review refresh runs via background agent soon.")
            }
          >
            Refresh (24h cache)
          </Button>
        </div>
        {reviewSummary ? (
          <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900/70 md:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-emerald-500 dark:text-emerald-300">
                Pros
              </h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-400">
                {reviewSummary.pros?.length
                  ? reviewSummary.pros.map((pro: string, index: number) => (
                      <li key={index}>• {pro}</li>
                    ))
                  : "No pros summarised yet."}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-rose-500 dark:text-rose-300">
                Cons
              </h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-400">
                {reviewSummary.cons?.length
                  ? reviewSummary.cons.map((con: string, index: number) => (
                      <li key={index}>• {con}</li>
                    ))
                  : "No cons summarised yet."}
              </ul>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200 p-10 text-center dark:border-slate-800">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No review summary cached yet. Trigger a background refresh via the dashboard.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
