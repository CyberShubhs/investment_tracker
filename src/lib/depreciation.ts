/** Straight-line depreciated value for equipment (computers etc.). */
export function depreciatedValue(
  purchasePrice: number,
  purchaseDate: string,
  lifeYears: number,
  salvageValue = 0,
  asOf: Date = new Date()
): number {
  if (!isFinite(purchasePrice) || purchasePrice <= 0) return 0;
  if (!isFinite(lifeYears) || lifeYears <= 0) return purchasePrice;
  const start = new Date(purchaseDate).getTime();
  if (!isFinite(start)) return purchasePrice;
  const yearsElapsed = Math.max(0, (asOf.getTime() - start) / (365.25 * 24 * 3600 * 1000));
  const fraction = Math.min(1, yearsElapsed / lifeYears);
  const value = purchasePrice - (purchasePrice - salvageValue) * fraction;
  return Math.max(salvageValue, Math.round(value));
}
