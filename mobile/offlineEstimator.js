import { BRAND_OPTIONS, BRAND_TIER_MULTIPLIER, getBrandTier, isPriceyBrand } from './brandData';
import { roundPriceForMarketplace } from './priceUtils';

const BASE_PRICE_BY_CATEGORY = {
  clothing: 280,
  bags: 420,
  shoes: 550,
  accessories: 240,
  electronics: 900,
  other: 300,
};

const CONDITION_MULTIPLIER = {
  poor: 0.45,
  fair: 0.7,
  good: 1.0,
  excellent: 1.25,
};

const CONDITIONS = ['poor', 'fair', 'good', 'excellent'];

function hashString(input) {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function estimateOfflinePrice({ category, imageFullUri, imageLabelUri, selectedBrand }) {
  const fullHash = hashString(imageFullUri || '');
  const labelHash = hashString(imageLabelUri || '');

  const condition = CONDITIONS[fullHash % CONDITIONS.length];
  const brand = (selectedBrand || BRAND_OPTIONS[labelHash % BRAND_OPTIONS.length]).toLowerCase();

  const base = BASE_PRICE_BY_CATEGORY[category] || BASE_PRICE_BY_CATEGORY.other;
  const conditionMultiplier = CONDITION_MULTIPLIER[condition] || 1.0;
  const brandTier = getBrandTier(brand);
  const brandMultiplier = BRAND_TIER_MULTIPLIER[brandTier] || 0.95;

  // Slight deterministic jitter for variety while staying stable per image pair.
  const jitter = 0.92 + ((fullHash + labelHash) % 17) / 100;
  const estimated = Math.max(0, base * conditionMultiplier * brandMultiplier * jitter);
  const rounded = roundPriceForMarketplace(estimated);

  return {
    engine: 'offline_fallback_estimator',
    condition,
    brand,
    brand_tier: brandTier,
    pricey_brand: isPriceyBrand(brand),
    estimated_price_php: Number(rounded.toFixed(2)),
    currency: 'PHP',
    notes: 'Offline estimate mode: no backend/network required.',
  };
}
