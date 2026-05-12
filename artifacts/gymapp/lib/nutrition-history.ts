import type { DailyLog, FoodEntry } from "../contexts/NutritionContext";

function getFoodKey(entry: FoodEntry): string {
  return `${entry.name.trim().toLowerCase()}|${entry.servingSize.trim().toLowerCase()}|${entry.calories}`;
}

export function getRecentUniqueFoodEntries(logs: Record<string, DailyLog>, limit = 8): FoodEntry[] {
  const seen = new Set<string>();

  return Object.values(logs)
    .flatMap((log) => log.entries)
    .sort((left, right) => right.timestamp - left.timestamp)
    .filter((entry) => {
      const key = getFoodKey(entry);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, Math.max(0, limit));
}
