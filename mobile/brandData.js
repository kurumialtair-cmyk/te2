export const CATEGORY_BRANDS = {
  clothing: [
    'unbranded', 'zara', 'uniqlo', 'h&m', 'mango', 'cotton on', 'gap', 'levis',
    'nike', 'adidas', 'jordan', 'carhartt wip', 'stussy', 'supreme', 'bape',
    'burberry', 'gucci', 'balenciaga', 'saint laurent', 'dior', 'prada', 'chanel', 'hermes',
    'local', 'other_brand',
  ],
  bags: [
    'unbranded', 'coach', 'michael kors', 'kate spade', 'tory burch', 'longchamp',
    'furla', 'guess', 'charles & keith', 'burberry', 'marc jacobs',
    'louis vuitton', 'goyard', 'dior', 'prada', 'gucci', 'fendi', 'celine', 'bottega veneta', 'chanel', 'hermes',
    'local', 'other_brand',
  ],
  shoes: [
    'unbranded', 'nike', 'adidas', 'jordan', 'new balance', 'asics', 'vans', 'converse', 'puma',
    'dr. martens', 'timberland', 'clarks', 'aldo',
    'gucci', 'prada', 'balenciaga', 'saint laurent', 'christian louboutin', 'dior',
    'local', 'other_brand',
  ],
  accessories: [
    'unbranded', 'casio', 'seiko', 'fossil', 'ray-ban', 'oakley', 'pandora',
    'coach', 'kate spade', 'michael kors', 'tory burch',
    'burberry', 'gucci', 'prada', 'dior', 'chanel', 'hermes',
    'local', 'other_brand',
  ],
  electronics: [
    'unbranded', 'xiaomi', 'realme', 'oppo', 'vivo', 'huawei', 'honor', 'infinix', 'tecno',
    'samsung', 'google', 'oneplus', 'sony', 'lg', 'dell', 'hp', 'lenovo', 'asus', 'acer',
    'apple', 'local', 'other_brand',
  ],
  other: ['unbranded', 'local', 'other_brand'],
};

export const BRAND_TIERS = {
  // ultra premium
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
  'christian louboutin': 'ultra_premium',

  // premium
  'apple': 'premium',
  'coach': 'premium',
  'michael kors': 'premium',
  'tory burch': 'premium',
  'kate spade': 'premium',
  'burberry': 'premium',
  'marc jacobs': 'premium',
  'ray-ban': 'premium',
  'oakley': 'premium',

  // premium_street
  'nike': 'premium_street',
  'jordan': 'premium_street',
  'adidas': 'premium_street',
  'supreme': 'premium_street',
  'bape': 'premium_street',
  'stussy': 'premium_street',
  'carhartt wip': 'premium_street',

  // mid
  'new balance': 'mid',
  'asics': 'mid',
  'vans': 'mid',
  'converse': 'mid',
  'puma': 'mid',
  'dr. martens': 'mid',
  'timberland': 'mid',
  'clarks': 'mid',
  'aldo': 'mid',
  'fossil': 'mid',
  'seiko': 'mid',
  'casio': 'mid',
  'longchamp': 'mid',
  'furla': 'mid',
  'zara': 'mid',
  'h&m': 'mid',
  'uniqlo': 'mid',
  'gap': 'mid',
  'mango': 'mid',
  'cotton on': 'mid',
  'levis': 'mid',
  'samsung': 'mid',
  'google': 'mid',
  'oneplus': 'mid',
  'sony': 'mid',
  'dell': 'mid',
  'hp': 'mid',
  'lenovo': 'mid',
  'asus': 'mid',
  'acer': 'mid',

  // entry
  'xiaomi': 'entry',
  'realme': 'entry',
  'oppo': 'entry',
  'vivo': 'entry',
  'huawei': 'entry',
  'honor': 'entry',
  'infinix': 'entry',
  'tecno': 'entry',
  'lg': 'entry',
  'guess': 'entry',
  'charles & keith': 'entry',
  'pandora': 'entry',
  'local': 'entry',
  'other_brand': 'entry',
  'unbranded': 'unbranded',
};

export const BRAND_OPTIONS = Array.from(
  new Set(Object.values(CATEGORY_BRANDS).flat()),
);

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

export function getBrandsByCategory(category) {
  return CATEGORY_BRANDS[category] || CATEGORY_BRANDS.other;
}
