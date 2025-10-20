"use client";

import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ItemCard } from "@/components/ItemCard";
import { VoiceButton } from "@/components/VoiceButton";
import { Loader2, Plus, RefreshCcw } from "lucide-react";
import type { Doc } from "@/convex/_generated/dataModel";

export default function Home() {
  const { user } = useUser();
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [asin, setAsin] = useState("");
  const [variant, setVariant] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const items = useQuery(api.functions.items.listItems, {
    ownerClerkId: user?.id ?? undefined,
  }) as Doc<"items">[] | undefined;

  const addItem = useMutation(api.functions.items.addItem);
  const fetchPrices = useAction(api.functions.cron.fetchPrices);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title || !url) {
      toast.error("Please provide a product title and URL.");
      return;
    }

    setIsSubmitting(true);
    try {
      await addItem({
        ownerClerkId: user?.id ?? undefined,
        title,
        url,
        asin: asin || undefined,
        sku: undefined,
        image: undefined,
        category: undefined,
        brand: undefined,
        model: undefined,
        description: undefined,
        tags: variant ? [variant] : undefined,
        notes: undefined,
        metadata: variant ? { variant } : undefined,
      });
      toast.success("Item added! Fetching latest prices…");
      setTitle("");
      setUrl("");
      setAsin("");
      setVariant("");
    } catch (error) {
      console.error(error);
      toast.error("Failed to add item. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50/40 dark:from-slate-950 dark:via-slate-950 dark:to-purple-950/40">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-10">
        <header className="flex flex-col gap-6 rounded-2xl border border-slate-200 bg-white/90 p-8 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-50">
              Price Intelligence Dashboard
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
              Track product prices across multiple stores, surface historical insights, and let the background research agent decide when to buy.
            </p>
          </div>
          <VoiceButton onStart={() => toast.info("Voice agent coming soon.")} />
        </header>

        <section className="grid grid-cols-1 gap-6 md:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Track a product
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Paste a product URL or describe it. The agent will normalise pricing, fetch review summaries, and monitor for deals.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Product title
                </label>
                <Input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Apple AirPods Pro (3rd Generation)"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Product URL
                </label>
                <Input
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://www.amazon.com/..."
                  required
                  type="url"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    ASIN / SKU (optional)
                  </label>
                  <Input
                    value={asin}
                    onChange={(event) => setAsin(event.target.value)}
                    placeholder="B0D123XYZ"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Variant / generation
                  </label>
                  <Input
                    value={variant}
                    onChange={(event) => setVariant(event.target.value)}
                    placeholder="3rd gen · MagSafe case"
                  />
                </div>
              </div>

              <textarea
                placeholder="Notes for alerts or custom research instructions…"
                rows={3}
                disabled
                className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400"
              />

              <Button
                type="submit"
                className="w-full gap-2 bg-purple-600 hover:bg-purple-700"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Adding…
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Track product
                  </>
                )}
              </Button>
            </form>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Latest background tasks
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Trigger a manual refresh to re-fetch offers. Automated crons will run hourly.
            </p>
            <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
              <p>• Fetch multi-store offers via SerpAPI.</p>
              <p>• Normalise totals with shipping + tax.</p>
              <p>• Append snapshot for price history.</p>
              <p>• Alert if wishlist thresholds breached.</p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="mt-4 w-full gap-2"
              disabled={!items || items.length === 0}
              onClick={async () => {
                if (!items || items.length === 0) {
                  return;
                }
                toast.info("Running price refresh for tracked items…");
                await Promise.all(
                  items.map((item: Doc<"items">) =>
                    fetchPrices({ itemId: item._id, query: item.title }).catch(
                      (error) => console.error(error)
                    )
                  )
                );
                toast.success("Fetch complete! Refresh to see updates.");
              }}
            >
              <RefreshCcw className="h-4 w-4" />
              Run price refresh
            </Button>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">
              Tracked products
            </h2>
            <Button variant="ghost" size="sm" className="text-purple-600 hover:text-purple-700" disabled>
              Sort / filter (coming soon)
            </Button>
          </div>

          {!items ? (
            <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
              <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200 p-10 text-center dark:border-slate-800">
              <p className="text-base font-medium text-slate-600 dark:text-slate-300">
                No products tracked yet.
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Add your first item above to start collecting offers and price history.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {items.map((item: Doc<"items">) => (
                <ItemCard key={item._id} item={item} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
