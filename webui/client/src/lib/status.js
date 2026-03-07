/**
 * Derive per-cell status from performance + signals artifacts.
 * Returns one of: 'cross-zone' | 'outlier' | 'elevated' | 'normal'
 */
export function cellStatus(cellId, performance, signals) {
  const isCrossZone = signals?.crossZoneSignals?.some(s => s.cellId === cellId);
  if (isCrossZone) return 'cross-zone';
  if (performance?.outliers?.some(c => c.cellId === cellId)) return 'outlier';
  if (performance?.elevated?.some(c => c.cellId === cellId)) return 'elevated';
  return 'normal';
}

export const STATUS_COLOUR = {
  'cross-zone': '#ef4444',
  'outlier':    '#f97316',
  'elevated':   '#eab308',
  'normal':     '#22c55e',
};

export const STATUS_LABEL = {
  'cross-zone': 'Cross-zone hit',
  'outlier':    'Outlier',
  'elevated':   'Elevated',
  'normal':     'Normal',
};

export const STATUS_BG = {
  'cross-zone': 'bg-red-900/40 text-red-300 border-red-700',
  'outlier':    'bg-orange-900/40 text-orange-300 border-orange-700',
  'elevated':   'bg-yellow-900/40 text-yellow-300 border-yellow-700',
  'normal':     'bg-green-900/40 text-green-300 border-green-700',
};
