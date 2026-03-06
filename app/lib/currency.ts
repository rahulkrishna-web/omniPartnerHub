/**
 * Returns the currency symbol for a given ISO currency code.
 * Uses Intl.NumberFormat which is available in all modern environments.
 * e.g. getCurrencySymbol("INR") → "₹"
 *      getCurrencySymbol("USD") → "$"
 *      getCurrencySymbol("SAR") → "SR"
 */
export function getCurrencySymbol(currencyCode: string): string {
  try {
    const parts = new Intl.NumberFormat("en", {
      style: "currency",
      currency: currencyCode,
      currencyDisplay: "narrowSymbol",
    }).formatToParts(0);

    const symbol = parts.find((p) => p.type === "currency")?.value;
    return symbol || currencyCode;
  } catch {
    return currencyCode;
  }
}

/**
 * Format a price value with its currency symbol.
 * e.g. formatPrice("2849.00", "INR") → "₹2849.00"
 */
export function formatPrice(amount: string | null | undefined, currencyCode: string): string {
  const symbol = getCurrencySymbol(currencyCode);
  return `${symbol}${amount || "0.00"}`;
}
