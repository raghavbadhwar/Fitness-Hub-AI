function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function getLocalDateKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function getMillisecondsUntilNextLocalDate(date: Date = new Date()): number {
  const nextDate = new Date(date);
  nextDate.setHours(24, 0, 0, 500);
  return Math.max(1000, nextDate.getTime() - date.getTime());
}
