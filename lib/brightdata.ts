/**
 * Placeholder Bright Data client. The background research agent can replace
 * the stubs with real API calls once credentials are available. Keeping the
 * shape consistent avoids touching the rest of the app.
 */
export type BrightDataOffer = {
  store: string;
  priceCents: number;
  shippingCents: number;
  url: string;
  seller?: string;
};

export async function fetchBrightDataOffers(
  productUrl: string
): Promise<BrightDataOffer[]> {
  if (!process.env.BRIGHTDATA_API_TOKEN) {
    return [];
  }

  // TODO: integrate Bright Data collector once credentials are provided.
  // For now we return an empty array so callers can merge the data safely.
  console.warn(
    "Bright Data integration not configured. Returning no offers for",
    productUrl
  );
  return [];
}
