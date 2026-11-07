/**
 * Proportional rebalancing helper that guarantees:
 * 1. The changedKey is set to exact newValue (clamped 0..100).
 * 2. Other keys are scaled proportionally so the total sum is STRICTLY 100%.
 * 3. Handles 100% case (others zeroed) and from-zero case (others distributed evenly).
 */
export function rebalancePercentages<T extends string>(
  current: Record<T, number>,
  changedKey: T,
  newValue: number,
): Record<T, number> {
  const clampedVal = Math.max(0, Math.min(100, Math.round(newValue)));
  const keys = Object.keys(current) as T[];
  const otherKeys = keys.filter((k) => k !== changedKey);

  if (otherKeys.length === 0) {
    return { [changedKey]: 100 } as unknown as Record<T, number>;
  }

  const next = { ...current } as Record<T, number>;
  next[changedKey] = clampedVal;

  const remaining = 100 - clampedVal;

  if (clampedVal === 100) {
    for (const k of otherKeys) {
      next[k] = 0;
    }
    return next;
  }

  const otherSum = otherKeys.reduce(
    (sum, k) => sum + (Number(current[k]) || 0),
    0,
  );

  if (otherSum <= 0) {
    // Distribute remaining evenly across other keys
    const baseShare = Math.floor(remaining / otherKeys.length);
    let remDiff = remaining - baseShare * otherKeys.length;
    for (const k of otherKeys) {
      const extra = remDiff > 0 ? 1 : 0;
      next[k] = baseShare + extra;
      if (remDiff > 0) remDiff -= 1;
    }
    return next;
  }

  // Scale others proportionally
  const unrounded: { diff: number; key: T; rounded: number; val: number }[] = [];
  let allocatedOther = 0;

  for (const k of otherKeys) {
    const raw = ((Number(current[k]) || 0) / otherSum) * remaining;
    const rounded = Math.round(raw);
    allocatedOther += rounded;
    unrounded.push({
      diff: raw - rounded,
      key: k,
      rounded,
      val: raw,
    });
  }

  const diff = remaining - allocatedOther;
  if (diff > 0) {
    unrounded.sort((a, b) => b.diff - a.diff);
    for (let i = 0; i < diff && i < unrounded.length; i++) {
      unrounded[i]!.rounded += 1;
    }
  } else if (diff < 0) {
    unrounded.sort((a, b) => a.diff - b.diff);
    for (let i = 0; i < Math.abs(diff) && i < unrounded.length; i++) {
      if (unrounded[i]!.rounded > 0) {
        unrounded[i]!.rounded -= 1;
      }
    }
  }

  for (const item of unrounded) {
    next[item.key] = Math.max(0, item.rounded);
  }

  return next;
}
