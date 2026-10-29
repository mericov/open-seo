function offsetMinutes(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const value = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  const asUtc = Date.UTC(
    value("year"),
    value("month") - 1,
    value("day"),
    value("hour"),
    value("minute"),
    value("second"),
  );
  return (asUtc - date.getTime()) / 60_000;
}

export function zonedToUtcIso(day: string, time: string, timeZone: string) {
  const [year = 0, month = 1, date = 1] = day.split("-").map(Number);
  const [hour = 0, minute = 0] = time.split(":").map(Number);
  const guess = Date.UTC(year, month - 1, date, hour, minute);
  const first = guess - offsetMinutes(new Date(guess), timeZone) * 60_000;
  const second = guess - offsetMinutes(new Date(first), timeZone) * 60_000;
  return new Date(second).toISOString();
}

export function utcToZoned(iso: string, timeZone: string) {
  const date = new Date(iso);
  const local = new Date(
    date.getTime() + offsetMinutes(date, timeZone) * 60_000,
  );
  const text = local.toISOString();
  return { day: text.slice(0, 10), time: text.slice(11, 16) };
}
