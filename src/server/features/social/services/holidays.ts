import { sortBy } from "remeda";

type Holiday = { date: string; name: string; note?: string };

function nthWeekday(year: number, month: number, weekday: number, n: number) {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const offset = (weekday - first.getUTCDay() + 7) % 7;
  return new Date(Date.UTC(year, month - 1, 1 + offset + (n - 1) * 7));
}

function lastWeekday(year: number, month: number, weekday: number) {
  const last = new Date(Date.UTC(year, month, 0));
  const offset = (last.getUTCDay() - weekday + 7) % 7;
  return new Date(Date.UTC(year, month - 1, last.getUTCDate() - offset));
}

function easter(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

const iso = (date: Date) => date.toISOString().slice(0, 10);
const fixed = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
const addDays = (date: Date, days: number) =>
  new Date(date.getTime() + days * 86_400_000);

const LUNAR_TR: Record<number, Holiday[]> = {
  2026: [
    { date: "2026-03-20", name: "Ramazan Bayramı" },
    { date: "2026-05-27", name: "Kurban Bayramı" },
  ],
  2027: [
    { date: "2027-03-09", name: "Ramazan Bayramı" },
    { date: "2027-05-16", name: "Kurban Bayramı" },
  ],
  2028: [
    { date: "2028-02-26", name: "Ramazan Bayramı" },
    { date: "2028-05-05", name: "Kurban Bayramı" },
  ],
};

function turkey(year: number): Holiday[] {
  const blackFriday = addDays(nthWeekday(year, 11, 4, 4), 1);
  return [
    { date: fixed(year, 1, 1), name: "Yılbaşı" },
    { date: fixed(year, 2, 14), name: "Sevgililer Günü" },
    { date: fixed(year, 3, 8), name: "Dünya Kadınlar Günü" },
    {
      date: fixed(year, 4, 23),
      name: "23 Nisan Ulusal Egemenlik ve Çocuk Bayramı",
    },
    { date: fixed(year, 5, 1), name: "Emek ve Dayanışma Günü" },
    { date: iso(nthWeekday(year, 5, 0, 2)), name: "Anneler Günü" },
    { date: fixed(year, 5, 19), name: "19 Mayıs Gençlik ve Spor Bayramı" },
    { date: iso(nthWeekday(year, 6, 0, 3)), name: "Babalar Günü" },
    {
      date: fixed(year, 7, 15),
      name: "15 Temmuz Demokrasi ve Millî Birlik Günü",
      note: "Anma günü; satış dili kullanma.",
    },
    { date: fixed(year, 8, 30), name: "30 Ağustos Zafer Bayramı" },
    { date: fixed(year, 10, 29), name: "29 Ekim Cumhuriyet Bayramı" },
    {
      date: fixed(year, 11, 10),
      name: "10 Kasım Atatürk'ü Anma Günü",
      note: "Anma günü; satış dili ve kampanya kullanma.",
    },
    { date: fixed(year, 11, 11), name: "11.11 indirim günü" },
    { date: fixed(year, 11, 24), name: "Öğretmenler Günü" },
    { date: iso(blackFriday), name: "Efsane Cuma / Black Friday" },
    { date: fixed(year, 12, 31), name: "Yılbaşı gecesi" },
    ...(LUNAR_TR[year] ?? []),
  ];
}

function unitedStates(year: number): Holiday[] {
  const thanksgiving = nthWeekday(year, 11, 4, 4);
  return [
    { date: fixed(year, 1, 1), name: "New Year's Day" },
    {
      date: iso(nthWeekday(year, 1, 1, 3)),
      name: "Martin Luther King Jr. Day",
    },
    { date: iso(nthWeekday(year, 2, 0, 2)), name: "Super Bowl Sunday" },
    { date: fixed(year, 2, 14), name: "Valentine's Day" },
    { date: iso(nthWeekday(year, 2, 1, 3)), name: "Presidents' Day" },
    { date: fixed(year, 3, 17), name: "St. Patrick's Day" },
    { date: fixed(year, 3, 20), name: "First day of spring" },
    { date: iso(easter(year)), name: "Easter" },
    { date: fixed(year, 4, 22), name: "Earth Day" },
    { date: iso(nthWeekday(year, 5, 0, 2)), name: "Mother's Day" },
    { date: iso(lastWeekday(year, 5, 1)), name: "Memorial Day" },
    { date: iso(nthWeekday(year, 6, 0, 3)), name: "Father's Day" },
    { date: fixed(year, 7, 4), name: "Independence Day" },
    { date: iso(nthWeekday(year, 9, 1, 1)), name: "Labor Day" },
    { date: fixed(year, 10, 31), name: "Halloween" },
    {
      date: fixed(year, 11, 11),
      name: "Veterans Day",
      note: "Respectful tone; no hard selling.",
    },
    { date: iso(thanksgiving), name: "Thanksgiving" },
    { date: iso(addDays(thanksgiving, 1)), name: "Black Friday" },
    { date: iso(addDays(thanksgiving, 4)), name: "Cyber Monday" },
    { date: iso(addDays(thanksgiving, 5)), name: "Giving Tuesday" },
    { date: fixed(year, 12, 25), name: "Christmas" },
    { date: fixed(year, 12, 31), name: "New Year's Eve" },
  ];
}

export function holidaysFor(market: string, month: string) {
  const year = Number(month.slice(0, 4));
  const list = market === "TR" ? turkey(year) : unitedStates(year);
  return sortBy(
    list.filter((holiday) => holiday.date.startsWith(month)),
    (holiday) => holiday.date,
  );
}
