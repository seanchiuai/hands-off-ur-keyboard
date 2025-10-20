import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

type Offer = {
  _id: string;
  store: string;
  seller?: string | null;
  priceCents: number;
  shippingCents: number;
  taxRate: number;
  normalizedTotalCents?: number | null;
  rating?: number | null;
  reviewCount?: number | null;
  inStock: boolean;
  url: string;
  lastUpdatedAt?: number | null;
};

type CompareTableProps = {
  offers: Offer[];
  highlightedStore?: string;
};

const formatMoney = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export function CompareTable({ offers, highlightedStore }: CompareTableProps) {
  if (!offers.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 p-8 text-center dark:border-slate-800">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          No offers collected yet. Schedule a price fetch to populate this table.
        </p>
      </div>
    );
  }

  const orderedOffers = [...offers].sort(
    (a, b) =>
      (a.normalizedTotalCents ?? a.priceCents) -
      (b.normalizedTotalCents ?? b.priceCents)
  );

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
      <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
          <tr>
            <th className="px-6 py-3 text-left">Store</th>
            <th className="px-6 py-3 text-left">Seller / Rating</th>
            <th className="px-6 py-3 text-left">Price</th>
            <th className="px-6 py-3 text-left">Shipping</th>
            <th className="px-6 py-3 text-left">Total</th>
            <th className="px-6 py-3 text-right">Updated</th>
            <th className="px-6 py-3 text-right">Link</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 text-sm dark:divide-slate-800">
          {orderedOffers.map((offer) => {
            const total = offer.normalizedTotalCents ?? offer.priceCents;
            const emphasise = highlightedStore
              ? offer.store.toLowerCase() === highlightedStore.toLowerCase()
              : orderedOffers[0]._id === offer._id;
            const updatedLabel = offer.lastUpdatedAt
              ? new Date(offer.lastUpdatedAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "—";

            return (
              <tr
                key={offer._id}
                className={cn(
                  "transition hover:bg-purple-50/40 dark:hover:bg-purple-900/10",
                  emphasise && "bg-purple-50/60 dark:bg-purple-900/20"
                )}
              >
                <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                  {offer.store}
                  {!offer.inStock && (
                    <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600 dark:bg-red-900/20 dark:text-red-200">
                      Out of stock
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                  <div className="flex flex-col gap-1">
                    {offer.seller && <span>{offer.seller}</span>}
                    {(offer.rating || offer.reviewCount) && (
                      <span className="text-xs text-slate-400 dark:text-slate-500">
                        {offer.rating ? `${offer.rating.toFixed(1)}★` : "—"} ·{" "}
                        {offer.reviewCount
                          ? `${offer.reviewCount.toLocaleString()} reviews`
                          : "no reviews"}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-slate-700 dark:text-slate-300">
                  {formatMoney(offer.priceCents)}
                </td>
                <td className="px-6 py-4 text-slate-700 dark:text-slate-300">
                  {formatMoney(offer.shippingCents)}
                </td>
                <td className="px-6 py-4 font-semibold text-slate-900 dark:text-slate-100">
                  {formatMoney(total)}
                </td>
                <td className="px-6 py-4 text-right text-xs text-slate-400 dark:text-slate-500">
                  {updatedLabel}
                </td>
                <td className="px-6 py-4 text-right">
                  <Link
                    href={offer.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-medium text-purple-600 hover:text-purple-700 hover:underline dark:text-purple-300 dark:hover:text-purple-200"
                  >
                    View
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
