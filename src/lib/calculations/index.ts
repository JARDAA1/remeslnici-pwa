/**
 * Pure calculation functions for work entry totals.
 *
 * All functions validate inputs and throw on invalid data so that
 * bad values never silently propagate into stored records.
 */

// ---------------------------------------------------------------------------
// Duration
// ---------------------------------------------------------------------------

/**
 * Calculate duration in hours between two ISO datetime strings.
 * Returns a positive number rounded to 2 decimal places.
 *
 * @throws if either string is not a valid date or if endTime is before startTime
 */
export function calculateDurationInHours(
  startTime: string,
  endTime: string
): number {
  const start = new Date(startTime);
  const end = new Date(endTime);

  if (isNaN(start.getTime())) {
    throw new Error(`Invalid startTime: "${startTime}"`);
  }
  if (isNaN(end.getTime())) {
    throw new Error(`Invalid endTime: "${endTime}"`);
  }

  const diffMs = end.getTime() - start.getTime();

  if (diffMs < 0) {
    throw new Error(
      `endTime (${endTime}) is before startTime (${startTime})`
    );
  }

  const hours = diffMs / (1000 * 60 * 60);
  return Math.round(hours * 100) / 100;
}

// ---------------------------------------------------------------------------
// Labor
// ---------------------------------------------------------------------------

/**
 * Calculate labor cost: hours × hourly rate.
 *
 * @throws if hours or hourlyRate is negative
 */
export function calculateLaborTotal(
  hours: number,
  hourlyRate: number
): number {
  if (hours < 0) {
    throw new Error(`hours must be >= 0, got ${hours}`);
  }
  if (hourlyRate < 0) {
    throw new Error(`hourlyRate must be >= 0, got ${hourlyRate}`);
  }

  return Math.round(hours * hourlyRate * 100) / 100;
}

// ---------------------------------------------------------------------------
// Kilometers
// ---------------------------------------------------------------------------

/**
 * Calculate kilometer cost: km × rate per km.
 *
 * @throws if km or kmRate is negative
 */
export function calculateKmTotal(km: number, kmRate: number): number {
  if (km < 0) {
    throw new Error(`km must be >= 0, got ${km}`);
  }
  if (kmRate < 0) {
    throw new Error(`kmRate must be >= 0, got ${kmRate}`);
  }

  return Math.round(km * kmRate * 100) / 100;
}

// ---------------------------------------------------------------------------
// Grand total
// ---------------------------------------------------------------------------

/**
 * Sum all cost components into a grand total.
 *
 * @throws if any component is negative
 */
export function calculateGrandTotal(
  laborTotal: number,
  kmTotal: number,
  expensesTotal: number
): number {
  if (laborTotal < 0) {
    throw new Error(`laborTotal must be >= 0, got ${laborTotal}`);
  }
  if (kmTotal < 0) {
    throw new Error(`kmTotal must be >= 0, got ${kmTotal}`);
  }
  if (expensesTotal < 0) {
    throw new Error(`expensesTotal must be >= 0, got ${expensesTotal}`);
  }

  return Math.round((laborTotal + kmTotal + expensesTotal) * 100) / 100;
}
