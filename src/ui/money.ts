/** 29.99 -> "$29.99" */
export function formatUsd(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/** "Tax: $3.20" -> 3.2 */
export function parseUsd(text: string): number {
  const match = /\$(\d+(?:\.\d+)?)/.exec(text);
  if (!match) throw new Error(`No dollar amount in "${text}"`);
  return Number(match[1]);
}

/** Adds prices without floating-point drift (29.99 + 9.99 -> 39.98). */
export function sumUsd(amounts: number[]): number {
  return Math.round(amounts.reduce((sum, amount) => sum + amount * 100, 0)) / 100;
}
