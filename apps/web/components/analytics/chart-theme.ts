export interface AnalyticsChartTheme {
  text: string;
  textMuted: string;
  grid: string;
  accent: string;
  accentSoft: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
}

export function getAnalyticsChartTheme(isDark: boolean): AnalyticsChartTheme {
  if (isDark) {
    return {
      text: "#f2ede4",
      textMuted: "#c1c7d3",
      grid: "rgba(193, 199, 211, 0.18)",
      accent: "#8b9cf0",
      accentSoft: "rgba(139, 156, 240, 0.18)",
      success: "#4fbd8a",
      successSoft: "rgba(79, 189, 138, 0.16)",
      warning: "#e4bf62",
      warningSoft: "rgba(228, 191, 98, 0.18)",
      danger: "#ef8a84",
      dangerSoft: "rgba(239, 138, 132, 0.18)",
    };
  }

  return {
    text: "#222b3b",
    textMuted: "#667086",
    grid: "rgba(102, 112, 134, 0.18)",
    accent: "#4a5fd4",
    accentSoft: "rgba(74, 95, 212, 0.16)",
    success: "#2f9f72",
    successSoft: "rgba(47, 159, 114, 0.14)",
    warning: "#d6a437",
    warningSoft: "rgba(214, 164, 55, 0.16)",
    danger: "#d2615b",
    dangerSoft: "rgba(210, 97, 91, 0.16)",
  };
}