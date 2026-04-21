import { BRAND_OPTIONS, BRAND_TIER_MULTIPLIER, getBrandTier, isPriceyBrand } from './brandData';
import { roundPriceForMarketplace } from './priceUtils';
import { getPricePrior, getResidualStd } from './calibrationCache';

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

function seededRandom(seedInput) {
  let seed = hashString(seedInput) % 2147483647;
  if (seed <= 0) seed += 2147483646;
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
}

function deriveCondition(imageUri) {
  const h = hashString(imageUri || '');
  const normalized = (h % 1000) / 1000;
  if (normalized < 0.2) return 'poor';
  if (normalized < 0.5) return 'fair';
  if (normalized < 0.82) return 'good';
  return 'excellent';
}

export function estimateOfflinePrice({
  category,
  imageFullUri,
  imageLabelUri,
  selectedBrand,
  manualCondition,
  categoryPhotoConfirmed = true,
  calibration,
}) {
  const fullHash = hashString(imageFullUri || '');
  const labelHash = hashString(imageLabelUri || '');
  const seedInput = `${imageFullUri || ''}|${imageLabelUri || ''}|${category || ''}|${selectedBrand || ''}`;

  const autoCondition = manualCondition || deriveCondition(imageFullUri);
  const condition = (manualCondition || autoCondition).toLowerCase();
  const brand = (selectedBrand || BRAND_OPTIONS[labelHash % BRAND_OPTIONS.length]).toLowerCase();

  const base = BASE_PRICE_BY_CATEGORY[category] || BASE_PRICE_BY_CATEGORY.other;
  const conditionMultiplier = CONDITION_MULTIPLIER[condition] || CONDITION_MULTIPLIER[autoCondition] || 1.0;
  const brandTier = getBrandTier(brand);
  const brandMultiplier = BRAND_TIER_MULTIPLIER[brandTier] || 0.95;
  const prior = getPricePrior(calibration, category, brandTier, condition);

  const qualitySignal = 0.9 + seededRandom(`${seedInput}:quality`) * 0.2;
  let estimated = Math.max(0, (prior || base) * conditionMultiplier * brandMultiplier * qualitySignal);

  // Heavier penalty for damaged electronics to avoid unrealistic prices.
  if (category === 'electronics' && condition === 'poor') estimated *= 0.45;
  if (category === 'electronics' && condition === 'fair') estimated *= 0.8;
  // If the user says the image does not match selected category, force low-confidence low value.
  if (!categoryPhotoConfirmed) estimated *= 0.22;

  const rounded = roundPriceForMarketplace(estimated);
  const std = getResidualStd(calibration, category);
  const p50 = Number(rounded.toFixed(2));
  const p10 = Number(roundPriceForMarketplace(Math.max(0, estimated * (1 - std))).toFixed(2));
  const p90 = Number(roundPriceForMarketplace(Math.max(0, estimated * (1 + std))).toFixed(2));

  return {
    engine: 'offline_fallback_estimator',
    condition,
    brand,
    brand_tier: brandTier,
    pricey_brand: isPriceyBrand(brand),
    estimated_price_php: p50,
    estimated_price_band_php: { p10, p50, p90 },
    confidence: Number((1 - std).toFixed(4)),
    currency: 'PHP',
    notes: !categoryPhotoConfirmed
      ? 'Photo/category mismatch was flagged. Estimate reduced and marked low-confidence.'
      : `Offline estimate mode with calibration ${calibration?.version || 'default'}.`,
  };
}
