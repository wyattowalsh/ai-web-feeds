const WORDS_PER_MINUTE = 220;

export function estimateReadingTimeMinutes(text: string | null | undefined): number {
  if (!text?.trim()) {
    return 1;
  }

  const words = text.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

export function formatReadingTime(text: string | null | undefined): string {
  const minutes = estimateReadingTimeMinutes(text);
  return `${minutes} min read`;
}
