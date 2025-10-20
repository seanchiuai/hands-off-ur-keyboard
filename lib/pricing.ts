export const totalCents = (
  priceCents: number,
  shippingCents: number,
  taxRate: number
) => {
  return Math.round(priceCents + shippingCents + priceCents * taxRate);
};

export type PriceStats = {
  mean90: number;
  min90: number;
  stdev90: number;
};

export const computeStats = (series: number[]): PriceStats => {
  if (!series.length) {
    return { mean90: 0, min90: 0, stdev90: 0 };
  }

  const last90 = series.slice(-90);
  const n = last90.length;
  const mean =
    last90.reduce((acc, value) => acc + value, 0) / (n === 0 ? 1 : n);
  const min = Math.min(...last90);
  const variance =
    last90.reduce((acc, value) => acc + Math.pow(value - mean, 2), 0) /
    (n === 0 ? 1 : n);

  return {
    mean90: Math.round(mean),
    min90: n ? min : 0,
    stdev90: Math.round(Math.sqrt(variance)),
  };
};

export const dealScore = (
  currentTotalCents: number,
  stats: PriceStats,
  inStock: boolean,
  rating = 4
) => {
  if (!stats.mean90) {
    return 0;
  }

  const dropPct = Math.max(
    0,
    (stats.mean90 - currentTotalCents) / stats.mean90
  );
  const rareDiscount = currentTotalCents <= stats.min90 ? 0.1 : 0;
  const sigmaAdvantage =
    currentTotalCents < stats.mean90 - stats.stdev90 ? 0.1 : 0;
  const trust = Math.min(rating / 5, 1) * 0.1;
  const availability = inStock ? 0.05 : -0.1;

  return Number(
    (dropPct + rareDiscount + sigmaAdvantage + trust + availability).toFixed(3)
  );
};

export const verdict = (score: number) => {
  if (score >= 0.35) {
    return "buy_now" as const;
  }
  if (score >= 0.15) {
    return "average" as const;
  }
  return "wait_for_event" as const;
};

export const isFakeSale = (currentTotalCents: number, stats: PriceStats) => {
  if (!stats.mean90) {
    return false;
  }
  return currentTotalCents > stats.mean90 - stats.stdev90;
};
