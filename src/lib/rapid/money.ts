/**
 * Helpers for converting between PKR decimal amounts and integer minor units.
 * We always store paisa (1 PKR = 100 paisa) in the DB to avoid float drift.
 */

export function decimalToMinor(amount: number, currency = "PKR"): number {
  // PKR, USD, EUR etc. all have 2 minor digits. (JPY would be 0 — not supported here.)
  const minor = Math.round(amount * 100);
  if (minor < 0 || !Number.isFinite(minor)) {
    throw new Error(`Invalid amount: ${amount}`);
  }
  if (currency !== "PKR") {
    // We only validate PKR for now — extend if needed.
  }
  return minor;
}

export function minorToDecimal(minor: number): number {
  return minor / 100;
}

export function formatPkr(minor: number): string {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    minimumFractionDigits: 2,
  }).format(minor / 100);
}
