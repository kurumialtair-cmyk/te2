export const BRAND_TIERS = {
  'hermes': 'ultra_premium',
  'chanel': 'ultra_premium',
  'louis vuitton': 'ultra_premium',
  'goyard': 'ultra_premium',
  'dior': 'ultra_premium',
  'prada': 'ultra_premium',
  'gucci': 'ultra_premium',
  'celine': 'ultra_premium',
  'bottega veneta': 'ultra_premium',
  'fendi': 'ultra_premium',
  'saint laurent': 'ultra_premium',
  'balenciaga': 'ultra_premium',
  'coach': 'premium',
  'michael kors': 'premium',
  'tory burch': 'premium',
  'kate spade': 'premium',
  'burberry': 'premium',
  'marc jacobs': 'premium',
  'nike': 'premium_street',
  'jordan': 'premium_street',
  'adidas': 'premium_street',
  'supreme': 'premium_street',
  'bape': 'premium_street',
  'stussy': 'premium_street',
  'carhartt wip': 'premium_street',
  'levis': 'mid',
  'zara': 'mid',
  'h&m': 'mid',
  'uniqlo': 'mid',
  'gap': 'mid',
  'mango': 'mid',
  'cotton on': 'mid',
  'local': 'entry',
  'unbranded': 'unbranded',
  'other_brand': 'entry',
};

export const BRAND_OPTIONS = Object.keys(BRAND_TIERS);

export const BRAND_TIER_MULTIPLIER = {
  ultra_premium: 1.55,
  premium: 1.3,
  premium_street: 1.2,
  mid: 1.05,
  entry: 0.92,
  unbranded: 0.8,
};

export function getBrandTier(brand) {
  return BRAND_TIERS[(brand || '').toLowerCase()] || 'entry';
}

export function isPriceyBrand(brand) {
  const tier = getBrandTier(brand);
  return tier === 'ultra_premium' || tier === 'premium' || tier === 'premium_street';
}
