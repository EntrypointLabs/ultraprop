import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function shortAddress(address: string, lead = 6, tail = 4): string {
  if (address.length <= lead + tail + 2) return address;
  return `${address.slice(0, lead)}…${address.slice(-tail)}`;
}

export function formatUsd(
  value: number,
  opts: { decimals?: number; sign?: boolean } = {},
): string {
  const { decimals = 2, sign = false } = opts;
  const abs = Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  const prefix = value < 0 ? "-$" : sign ? "+$" : "$";
  return `${prefix}${abs}`;
}

export function formatPct(
  value: number,
  opts: { sign?: boolean; decimals?: number } = {},
): string {
  const { sign = true, decimals = 2 } = opts;
  const prefix = value > 0 && sign ? "+" : "";
  return `${prefix}${value.toFixed(decimals)}%`;
}

export function formatNum(value: number, decimals = 2): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
