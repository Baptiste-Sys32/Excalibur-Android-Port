// Wall-clock freshness is only for display fallback, never event ordering.
export const isFreshStylusSample = (
  timestamp: number,
  now: number,
  maxAge = 300,
) => Number.isFinite(timestamp) && now >= timestamp && now - timestamp < maxAge;
