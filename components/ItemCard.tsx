import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type ItemCardProps = {
  item: {
    _id: string;
    title: string;
    url: string;
    image?: string | null;
    brand?: string | null;
    model?: string | null;
    metadata?: {
      variant?: string | null;
    } | null;
    createdAt: number;
  };
  lowestTotalCents?: number | null;
  verdict?: "buy_now" | "average" | "wait_for_event";
  fakeSale?: boolean;
};

const verdictLabel: Record<NonNullable<ItemCardProps["verdict"]>, string> = {
  buy_now: "Great Deal",
  average: "Fair Price",
  wait_for_event: "Wait for Sale",
};

const verdictStyle: Record<
  NonNullable<ItemCardProps["verdict"]>,
  string
> = {
  buy_now:
    "bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:border-emerald-700",
  average:
    "bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-700",
  wait_for_event:
    "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-900/30 dark:text-slate-300 dark:border-slate-800",
};

export function ItemCard({
  item,
  lowestTotalCents,
  verdict,
  fakeSale,
}: ItemCardProps) {
  return (
    <div className="group relative flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-purple-300 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900/70 dark:hover:border-purple-500/60">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
            {item.title}
          </h3>
          {(item.brand || item.model || item.metadata?.variant) && (
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {[item.brand, item.model, item.metadata?.variant]
                .filter(Boolean)
                .join(" • ")}
            </p>
          )}
          <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
            Added {new Date(item.createdAt).toLocaleDateString()}
          </p>
        </div>
        {item.image ? (
          <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
            <Image
              src={item.image}
              alt={item.title}
              fill
              className="object-contain"
            />
          </div>
        ) : (
          <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-lg border border-dashed border-slate-200 text-xs text-slate-400 dark:border-slate-700 dark:text-slate-500">
            No image
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {typeof lowestTotalCents === "number" && lowestTotalCents > 0 && (
          <Badge variant="outline" className="text-purple-600 dark:text-purple-300">
            Lowest ${ (lowestTotalCents / 100).toFixed(2) }
          </Badge>
        )}
        {verdict && (
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${verdictStyle[verdict]}`}>
            {verdictLabel[verdict]}
          </span>
        )}
        {fakeSale && (
          <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600 dark:bg-red-900/20 dark:text-red-200">
            Possible Fake Sale
          </span>
        )}
      </div>

      <div className="mt-auto flex items-center justify-between gap-3">
        <Link href={`/item/${item._id}`} className="flex-1">
          <Button className="w-full gap-2 bg-purple-600 hover:bg-purple-700">
            View Insights
          </Button>
        </Link>
        <Link href={item.url} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" className="border-slate-200 dark:border-slate-700">
            Source
          </Button>
        </Link>
      </div>
    </div>
  );
}
