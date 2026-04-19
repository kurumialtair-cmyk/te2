export function roundPriceForMarketplace(value) {
  const price = Number(value) || 0;
  if (price < 300) return Math.round(price / 10) * 10;
  if (price < 1000) return Math.round(price / 50) * 50;
  return Math.round(price / 100) * 100;
}
