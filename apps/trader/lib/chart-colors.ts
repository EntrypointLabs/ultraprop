import type { ResolvedTheme } from "@/lib/theme";

export interface ChartColors {
  grid: string;
  axis: string;
  text: string;
  accent: string;
  up: string;
  down: string;
  upVol: string;
  downVol: string;
  gradientFrom: string;
  gradientTo: string;
  crosshair: string;
  markerBg: string;
}

const DARK: ChartColors = {
  grid: "#1c1c22",
  axis: "#2a2a30",
  text: "#6b6b73",
  accent: "#e5484d",
  up: "#34d399",
  down: "#f87171",
  upVol: "rgba(52,211,153,0.4)",
  downVol: "rgba(248,113,113,0.4)",
  gradientFrom: "rgba(229,72,77,0.26)",
  gradientTo: "rgba(229,72,77,0.01)",
  crosshair: "#3a3a44",
  markerBg: "#0a0a0c",
};

const LIGHT: ChartColors = {
  grid: "#eef0f3",
  axis: "#e7e7ec",
  text: "#56565f",
  accent: "#dc3d42",
  up: "#0c8051",
  down: "#d4313a",
  upVol: "rgba(12,128,81,0.4)",
  downVol: "rgba(212,49,58,0.4)",
  gradientFrom: "rgba(220,61,66,0.20)",
  gradientTo: "rgba(220,61,66,0.01)",
  crosshair: "#c9c9d0",
  markerBg: "#ffffff",
};

export function getChartColors(theme: ResolvedTheme): ChartColors {
  return theme === "dark" ? DARK : LIGHT;
}
