const DEFAULT_CALIBRATION = {
  version: '2026-04',
  pricePriors: {},
  residualStd: { default: 0.18 },
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export async function fetchCalibration(apiBase) {
  const base = (apiBase || '').trim().replace(/\/+$/, '');
  if (!base || !/^https?:\/\//i.test(base)) return DEFAULT_CALIBRATION;
  try {
    const res = await fetch(`${base}/calibration`);
    if (!res.ok) return DEFAULT_CALIBRATION;
    const data = await res.json();
    return {
      version: data.version || DEFAULT_CALIBRATION.version,
      pricePriors: data.pricePriors || {},
      residualStd: data.residualStd || DEFAULT_CALIBRATION.residualStd,
    };
  } catch (_) {
    return DEFAULT_CALIBRATION;
  }
}

export function getResidualStd(calibration, category) {
  const c = (category || 'default').toLowerCase();
  const std = calibration?.residualStd?.[c] ?? calibration?.residualStd?.default ?? 0.18;
  return clamp(std, 0.05, 0.45);
}

export function getPricePrior(calibration, category, brandTier, condition) {
  const key = `${(category || 'other').toLowerCase()}::${(brandTier || 'entry').toLowerCase()}::${(condition || 'good').toLowerCase()}`;
  return calibration?.pricePriors?.[key] ?? null;
}

