/**
 * Keep in sync with api/src/lib/utils/seasson-week.util.ts
 *
 * ESPN-style football weeks in America/Chicago.
 * Week 1 runs from the Saturday 16 days before Labor Day through Labor Day
 * (2026: August 22–September 7). Week 2 is the short Tuesday–Sunday after
 * Labor Day. Week 3+ is Monday–Sunday.
 */

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

function dayUtc(day: CalendarDay): number {
  return Date.UTC(day.year, day.month - 1, day.day);
}

/** Inclusive calendar span for ESPN-style week N. */
function weekSpan(
  seasonYear: number,
  week: number,
): {
  startDay: CalendarDay;
  endDay: CalendarDay;
  picksOpenDay: CalendarDay;
} {
  const ld = laborDay(seasonYear);
  if (week <= 1) {
    const mainMonday = addCalendarDays(ld, -7);
    return {
      startDay: addCalendarDays(ld, -16),
      endDay: ld,
      picksOpenDay: addCalendarDays(mainMonday, 1),
    };
  }
  if (week === 2) {
    const startDay = addCalendarDays(ld, 1);
    return {
      startDay,
      endDay: addCalendarDays(ld, 6),
      picksOpenDay: startDay,
    };
  }
  const monday = addCalendarDays(ld, 7 * (week - 2));
  return {
    startDay: monday,
    endDay: addCalendarDays(monday, 6),
    picksOpenDay: addCalendarDays(monday, 1),
  };
}

/** Start calendar day of ESPN-style week N. */
export function weekMonday(seasonYear: number, week: number): CalendarDay {
  return weekSpan(seasonYear, week).startDay;
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
  const { startDay, endDay, picksOpenDay } = weekSpan(seasonYear, week);
  return {
    monday: startDay,
    sunday: endDay,
    start: chicagoWallTimeToUtc(startDay.year, startDay.month, startDay.day),
    end: chicagoWallTimeToUtc(
      endDay.year,
      endDay.month,
      endDay.day,
      23,
      59,
      59,
      999,
    ),
    picksOpenAt: chicagoWallTimeToUtc(
      picksOpenDay.year,
      picksOpenDay.month,
      picksOpenDay.day,
    ),
    rangeLabel: formatWeekRangeLabel(startDay, endDay),
  };
}

export function computeCurrentWeek(
  seasonYear: number,
  now: Date = new Date(),
  maxWeeks = 18,
): number {
  const today = chicagoParts(now);
  const todayUtc = dayUtc({
    year: today.year,
    month: today.month,
    day: today.day,
  });
  for (let week = 1; week <= maxWeeks; week++) {
    if (todayUtc <= dayUtc(weekSpan(seasonYear, week).endDay)) {
      return week;
    }
  }
  return maxWeeks;
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
