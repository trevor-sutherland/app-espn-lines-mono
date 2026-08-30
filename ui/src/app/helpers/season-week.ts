/** Keep in sync with api/src/lib/utils/seasson-week.util.ts */

const TZ = 'America/Chicago';
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const MONDAY_OFFSET: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

export type CalendarDay = { year: number; month: number; day: number };

export type SeasonWeek = {
  season: number;
  week: number;
  start: Date;
  end: Date;
  picksOpenAt: Date;
  picksOpen: boolean;
  rangeLabel: string;
};

function chicagoParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const g = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return {
    year: Number(g['year']),
    month: Number(g['month']),
    day: Number(g['day']),
    hour: Number(g['hour']),
    minute: Number(g['minute']),
    second: Number(g['second']),
    weekday: g['weekday'] ?? 'Mon',
  };
}

function chicagoWallTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  ms = 0,
): Date {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second);
  const shown = chicagoParts(new Date(utcGuess));
  const shownAsUtc = Date.UTC(
    shown.year,
    shown.month - 1,
    shown.day,
    shown.hour,
    shown.minute,
    shown.second,
  );
  return new Date(utcGuess - (shownAsUtc - utcGuess) + ms);
}

function addCalendarDays(day: CalendarDay, days: number): CalendarDay {
  const utc = new Date(Date.UTC(day.year, day.month - 1, day.day + days));
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
  };
}

function mondayOnOrBefore(day: CalendarDay): CalendarDay {
  const instant = chicagoWallTimeToUtc(day.year, day.month, day.day);
  const offset = MONDAY_OFFSET[chicagoParts(instant).weekday] ?? 0;
  return addCalendarDays(day, -offset);
}

export function laborDay(seasonYear: number): CalendarDay {
  const sept1 = { year: seasonYear, month: 9, day: 1 };
  const offset =
    MONDAY_OFFSET[
      chicagoParts(chicagoWallTimeToUtc(sept1.year, sept1.month, sept1.day))
        .weekday
    ] ?? 0;
  return addCalendarDays(sept1, (7 - offset) % 7);
}

export function getSeasonYear(now: Date = new Date()): number {
  const { year, month } = chicagoParts(now);
  return month >= 7 ? year : year - 1;
}

export function weekMonday(seasonYear: number, week: number): CalendarDay {
  return addCalendarDays(laborDay(seasonYear), (week - 2) * 7);
}

export function formatWeekRangeLabel(start: CalendarDay, end: CalendarDay): string {
  if (start.month === end.month) {
    return `${MONTHS[start.month - 1]} ${start.day}–${end.day}`;
  }
  return `${MONTHS[start.month - 1]} ${start.day}–${MONTHS[end.month - 1]} ${end.day}`;
}

export function getWeekBounds(
  seasonYear: number,
  week: number,
): {
  start: Date;
  end: Date;
  picksOpenAt: Date;
  monday: CalendarDay;
  sunday: CalendarDay;
  rangeLabel: string;
} {
  const monday = weekMonday(seasonYear, week);
  const sunday = addCalendarDays(monday, 6);
  const tuesday = addCalendarDays(monday, 1);
  return {
    monday,
    sunday,
    start: chicagoWallTimeToUtc(monday.year, monday.month, monday.day),
    end: chicagoWallTimeToUtc(sunday.year, sunday.month, sunday.day, 23, 59, 59, 999),
    picksOpenAt: chicagoWallTimeToUtc(tuesday.year, tuesday.month, tuesday.day),
    rangeLabel: formatWeekRangeLabel(monday, sunday),
  };
}

export function computeCurrentWeek(
  seasonYear: number,
  now: Date = new Date(),
  maxWeeks = 18,
): number {
  const today = chicagoParts(now);
  const thisMonday = mondayOnOrBefore({
    year: today.year,
    month: today.month,
    day: today.day,
  });
  const week1Monday = weekMonday(seasonYear, 1);
  const thisMonUtc = Date.UTC(thisMonday.year, thisMonday.month - 1, thisMonday.day);
  const week1Utc = Date.UTC(week1Monday.year, week1Monday.month - 1, week1Monday.day);
  const weeksFromOne =
    Math.floor((thisMonUtc - week1Utc) / (7 * 24 * 60 * 60 * 1000)) + 1;
  return Math.max(1, Math.min(maxWeeks, weeksFromOne));
}

export function getCurrentSeasonAndWeek(
  now: Date = new Date(),
  maxWeeks = 18,
): SeasonWeek {
  const season = getSeasonYear(now);
  const week = computeCurrentWeek(season, now, maxWeeks);
  const bounds = getWeekBounds(season, week);
  return {
    season,
    week,
    start: bounds.start,
    end: bounds.end,
    picksOpenAt: bounds.picksOpenAt,
    picksOpen: now.getTime() >= bounds.picksOpenAt.getTime(),
    rangeLabel: bounds.rangeLabel,
  };
}

export function formatPicksOpenAt(picksOpenAt: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(picksOpenAt);
}
