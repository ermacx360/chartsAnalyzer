"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Check, Grid2X2, Palette, Zap } from "lucide-react";
import { SymbolSelector } from "@/components/chart/SymbolSelector";
import { TimeframeSelector } from "@/components/chart/TimeframeSelector";
import { IndicatorMenu } from "@/components/chart/IndicatorMenu";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  DEFAULT_PAGE_BACKGROUND_COLOR,
  DEFAULT_PAGE_PANEL_COLOR,
  useChartStore,
} from "@/lib/store/chart-store";

interface MarketSession {
  code: string;
  label: string;
  timeZone: string;
  openHour: number;
  openMinute: number;
  closeHour: number;
  closeMinute: number;
  breakStartHour?: number;
  breakStartMinute?: number;
  breakEndHour?: number;
  breakEndMinute?: number;
  type?: "regular" | "cme";
  holidayCalendar?: "nyse" | "lse" | "jpx" | "hkex" | "sse";
}

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

interface MarketHoliday {
  name: string;
}

interface EarlyClose {
  name: string;
  closeHour: number;
  closeMinute: number;
}

interface MarketClockState {
  isOpen: boolean;
  countdown: string;
  target: string;
  statusLabel?: string;
}

const MARKET_SESSIONS: MarketSession[] = [
  {
    code: "CME",
    label: "CME",
    timeZone: "America/Chicago",
    openHour: 17,
    openMinute: 0,
    closeHour: 16,
    closeMinute: 0,
    type: "cme",
  },
  {
    code: "New York",
    label: "New York",
    timeZone: "America/New_York",
    openHour: 9,
    openMinute: 30,
    closeHour: 16,
    closeMinute: 0,
    holidayCalendar: "nyse",
  },
  {
    code: "London",
    label: "London",
    timeZone: "Europe/London",
    openHour: 8,
    openMinute: 0,
    closeHour: 16,
    closeMinute: 30,
    holidayCalendar: "lse",
  },
  {
    code: "Tokyo",
    label: "Tokyo",
    timeZone: "Asia/Tokyo",
    openHour: 9,
    openMinute: 0,
    closeHour: 15,
    closeMinute: 30,
    holidayCalendar: "jpx",
  },
  {
    code: "HK",
    label: "Hong Kong",
    timeZone: "Asia/Hong_Kong",
    openHour: 9,
    openMinute: 30,
    closeHour: 16,
    closeMinute: 0,
    holidayCalendar: "hkex",
  },
  {
    code: "Shanghai",
    label: "Shanghai",
    timeZone: "Asia/Shanghai",
    openHour: 9,
    openMinute: 30,
    closeHour: 15,
    closeMinute: 0,
    breakStartHour: 11,
    breakStartMinute: 30,
    breakEndHour: 13,
    breakEndMinute: 0,
    holidayCalendar: "sse",
  },
];

const PAGE_BACKGROUND_PRESETS = [
  { label: "Actual", value: DEFAULT_PAGE_BACKGROUND_COLOR },
  { label: "Negro", value: "#000000" },
  { label: "Blanco", value: "#ffffff" },
];

const PAGE_PANEL_PRESETS = [
  { label: "Actual", value: DEFAULT_PAGE_PANEL_COLOR },
  { label: "Negro", value: "#000000" },
  { label: "Blanco", value: "#ffffff" },
];

const ZONED_FORMATTERS = new Map<string, Intl.DateTimeFormat>();

function getZonedFormatter(timeZone: string) {
  const cached = ZONED_FORMATTERS.get(timeZone);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  ZONED_FORMATTERS.set(timeZone, formatter);
  return formatter;
}

function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const values = Object.fromEntries(
    getZonedFormatter(timeZone)
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour === 24 ? 0 : values.hour,
    minute: values.minute,
    second: values.second,
  };
}

function zonedDateTimeToUtcMs(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
) {
  let utc = Date.UTC(year, month - 1, day, hour, minute, 0);

  for (let i = 0; i < 2; i += 1) {
    const parts = getZonedParts(new Date(utc), timeZone);
    const zonedAsUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    const targetAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
    utc -= zonedAsUtc - targetAsUtc;
  }

  return utc;
}

function addLocalDays(year: number, month: number, day: number, days: number) {
  const next = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0));

  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
}

function getDateKey(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function isWeekday(year: number, month: number, day: number) {
  const weekday = new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).getUTCDay();
  return weekday >= 1 && weekday <= 5;
}

function getLocalWeekday(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).getUTCDay();
}

function getNthWeekdayOfMonth(
  year: number,
  month: number,
  weekday: number,
  occurrence: number,
) {
  const firstWeekday = getLocalWeekday(year, month, 1);
  const offset = (weekday - firstWeekday + 7) % 7;
  return 1 + offset + (occurrence - 1) * 7;
}

function getLastWeekdayOfMonth(year: number, month: number, weekday: number) {
  const lastDay = new Date(Date.UTC(year, month, 0, 12, 0, 0)).getUTCDate();
  const lastWeekday = getLocalWeekday(year, month, lastDay);
  return lastDay - ((lastWeekday - weekday + 7) % 7);
}

function getObservedHolidayDate(
  year: number,
  month: number,
  day: number,
  observeSaturday = true,
) {
  const weekday = getLocalWeekday(year, month, day);

  if (weekday === 0) return addLocalDays(year, month, day, 1);
  if (observeSaturday && weekday === 6) return addLocalDays(year, month, day, -1);

  return { year, month, day };
}

function getEasterSunday(year: number) {
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

  return { year, month, day };
}

function buildHolidayMap(
  holidays: Array<{ name: string; date: { year: number; month: number; day: number } }>,
) {
  const map = new Map<string, MarketHoliday>();

  holidays.forEach((holiday) => {
    map.set(getDateKey(holiday.date.year, holiday.date.month, holiday.date.day), {
      name: holiday.name,
    });
  });

  return map;
}

function getNyseHolidays(year: number) {
  const easter = getEasterSunday(year);

  return buildHolidayMap([
    {
      name: "New Year's Day",
      date: getObservedHolidayDate(year, 1, 1),
    },
    {
      name: "Martin Luther King Jr. Day",
      date: { year, month: 1, day: getNthWeekdayOfMonth(year, 1, 1, 3) },
    },
    {
      name: "Washington's Birthday",
      date: { year, month: 2, day: getNthWeekdayOfMonth(year, 2, 1, 3) },
    },
    {
      name: "Good Friday",
      date: addLocalDays(easter.year, easter.month, easter.day, -2),
    },
    {
      name: "Memorial Day",
      date: { year, month: 5, day: getLastWeekdayOfMonth(year, 5, 1) },
    },
    {
      name: "Juneteenth National Independence Day",
      date: getObservedHolidayDate(year, 6, 19),
    },
    {
      name: "Independence Day",
      date: getObservedHolidayDate(year, 7, 4),
    },
    {
      name: "Labor Day",
      date: { year, month: 9, day: getNthWeekdayOfMonth(year, 9, 1, 1) },
    },
    {
      name: "Thanksgiving Day",
      date: { year, month: 11, day: getNthWeekdayOfMonth(year, 11, 4, 4) },
    },
    {
      name: "Christmas Day",
      date: getObservedHolidayDate(year, 12, 25),
    },
  ]);
}

function getCmeEarlyCloses(year: number) {
  return buildHolidayMap([
    {
      name: "Memorial Day early close",
      date: { year, month: 5, day: getLastWeekdayOfMonth(year, 5, 1) },
    },
  ]);
}

function getCmeEarlyClose(year: number, month: number, day: number): EarlyClose | null {
  const holiday = getCmeEarlyCloses(year).get(getDateKey(year, month, day));

  if (!holiday) return null;

  return {
    name: holiday.name,
    closeHour: 12,
    closeMinute: 0,
  };
}

function getCmeCloseTime(session: MarketSession, year: number, month: number, day: number) {
  const earlyClose = getCmeEarlyClose(year, month, day);

  return {
    earlyClose,
    closeHour: earlyClose?.closeHour ?? session.closeHour,
    closeMinute: earlyClose?.closeMinute ?? session.closeMinute,
  };
}

function getLseHolidays(year: number) {
  const easter = getEasterSunday(year);
  const christmas = getLocalWeekday(year, 12, 25);
  const boxingDay = getLocalWeekday(year, 12, 26);
  const christmasHoliday =
    christmas === 6
      ? { year, month: 12, day: 27 }
      : christmas === 0
        ? { year, month: 12, day: 27 }
        : { year, month: 12, day: 25 };
  const boxingHoliday =
    christmas === 6
      ? { year, month: 12, day: 28 }
      : christmas === 0
        ? { year, month: 12, day: 28 }
        : boxingDay === 6
          ? { year, month: 12, day: 28 }
          : boxingDay === 0
            ? { year, month: 12, day: 27 }
            : { year, month: 12, day: 26 };

  return buildHolidayMap([
    {
      name: "New Year's Day",
      date: getObservedHolidayDate(year, 1, 1),
    },
    {
      name: "Good Friday",
      date: addLocalDays(easter.year, easter.month, easter.day, -2),
    },
    {
      name: "Easter Monday",
      date: addLocalDays(easter.year, easter.month, easter.day, 1),
    },
    {
      name: "Early May Bank Holiday",
      date: { year, month: 5, day: getNthWeekdayOfMonth(year, 5, 1, 1) },
    },
    {
      name: "Spring Bank Holiday",
      date: { year, month: 5, day: getLastWeekdayOfMonth(year, 5, 1) },
    },
    {
      name: "Summer Bank Holiday",
      date: { year, month: 8, day: getLastWeekdayOfMonth(year, 8, 1) },
    },
    {
      name: "Christmas Day",
      date: christmasHoliday,
    },
    {
      name: "Boxing Day",
      date: boxingHoliday,
    },
  ]);
}

function getJapaneseVernalEquinoxDay(year: number) {
  return Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

function getJapaneseAutumnalEquinoxDay(year: number) {
  return Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

function addHoliday(
  holidays: Map<string, MarketHoliday>,
  year: number,
  month: number,
  day: number,
  name: string,
) {
  holidays.set(getDateKey(year, month, day), { name });
}

function getJpxHolidays(year: number) {
  const holidays = new Map<string, MarketHoliday>();
  const add = (month: number, day: number, name: string) =>
    addHoliday(holidays, year, month, day, name);

  add(1, 1, "New Year's Day");
  add(1, 2, "Market Holiday");
  add(1, 3, "Market Holiday");
  add(1, getNthWeekdayOfMonth(year, 1, 1, 2), "Coming of Age Day");
  add(2, 11, "National Foundation Day");
  add(2, 23, "Emperor's Birthday");
  add(3, getJapaneseVernalEquinoxDay(year), "Vernal Equinox Day");
  add(4, 29, "Showa Day");
  add(5, 3, "Constitution Memorial Day");
  add(5, 4, "Greenery Day");
  add(5, 5, "Children's Day");
  add(7, getNthWeekdayOfMonth(year, 7, 1, 3), "Marine Day");
  add(8, 11, "Mountain Day");
  add(9, getNthWeekdayOfMonth(year, 9, 1, 3), "Respect for the Aged Day");
  add(9, getJapaneseAutumnalEquinoxDay(year), "Autumnal Equinox Day");
  add(10, getNthWeekdayOfMonth(year, 10, 1, 2), "Sports Day");
  add(11, 3, "Culture Day");
  add(11, 23, "Labor Thanksgiving Day");
  add(12, 31, "Market Holiday");

  Array.from(holidays.entries()).forEach(([key, holiday]) => {
    const [holidayYear, holidayMonth, holidayDay] = key.split("-").map(Number);

    if (getLocalWeekday(holidayYear, holidayMonth, holidayDay) !== 0) return;

    let substitute = addLocalDays(holidayYear, holidayMonth, holidayDay, 1);
    while (holidays.has(getDateKey(substitute.year, substitute.month, substitute.day))) {
      substitute = addLocalDays(substitute.year, substitute.month, substitute.day, 1);
    }

    addHoliday(
      holidays,
      substitute.year,
      substitute.month,
      substitute.day,
      `${holiday.name} observed`,
    );
  });

  for (let month = 1; month <= 12; month += 1) {
    const daysInMonth = new Date(Date.UTC(year, month, 0, 12, 0, 0)).getUTCDate();

    for (let day = 2; day < daysInMonth; day += 1) {
      const key = getDateKey(year, month, day);
      if (holidays.has(key)) continue;

      const previous = getDateKey(year, month, day - 1);
      const next = getDateKey(year, month, day + 1);
      if (holidays.has(previous) && holidays.has(next)) {
        add(day === 0 ? month - 1 : month, day, "Citizens' Holiday");
      }
    }
  }

  return holidays;
}

function getHkexHolidays(year: number) {
  if (year !== 2026) return new Map<string, MarketHoliday>();

  return buildHolidayMap([
    {
      name: "The first day of January",
      date: { year, month: 1, day: 1 },
    },
    {
      name: "Lunar New Year's Day",
      date: { year, month: 2, day: 17 },
    },
    {
      name: "The second day of Lunar New Year",
      date: { year, month: 2, day: 18 },
    },
    {
      name: "The third day of Lunar New Year",
      date: { year, month: 2, day: 19 },
    },
    {
      name: "Good Friday",
      date: { year, month: 4, day: 3 },
    },
    {
      name: "The day following Ching Ming Festival",
      date: { year, month: 4, day: 6 },
    },
    {
      name: "The day following Easter Monday",
      date: { year, month: 4, day: 7 },
    },
    {
      name: "Labour Day",
      date: { year, month: 5, day: 1 },
    },
    {
      name: "The day following the Birthday of the Buddha",
      date: { year, month: 5, day: 25 },
    },
    {
      name: "Tuen Ng Festival",
      date: { year, month: 6, day: 19 },
    },
    {
      name: "Hong Kong SAR Establishment Day",
      date: { year, month: 7, day: 1 },
    },
    {
      name: "National Day",
      date: { year, month: 10, day: 1 },
    },
    {
      name: "The day following Chung Yeung Festival",
      date: { year, month: 10, day: 19 },
    },
    {
      name: "Christmas Day",
      date: { year, month: 12, day: 25 },
    },
  ]);
}

function getHkexEarlyClose(year: number, month: number, day: number): EarlyClose | null {
  if (year !== 2026) return null;

  const earlyCloses = new Map<string, string>([
    [getDateKey(2026, 2, 16), "Eve of Lunar New Year"],
    [getDateKey(2026, 12, 24), "Eve of Christmas Day"],
    [getDateKey(2026, 12, 31), "Eve of New Year"],
  ]);
  const name = earlyCloses.get(getDateKey(year, month, day));

  if (!name) return null;

  return {
    name: `${name} half-day`,
    closeHour: 12,
    closeMinute: 0,
  };
}

function getSseHolidays(year: number) {
  if (year !== 2026) return new Map<string, MarketHoliday>();

  return buildHolidayMap([
    {
      name: "New Year's Day",
      date: { year, month: 1, day: 1 },
    },
    {
      name: "New Year's Day Holiday",
      date: { year, month: 1, day: 2 },
    },
    {
      name: "Spring Festival",
      date: { year, month: 2, day: 16 },
    },
    {
      name: "Spring Festival",
      date: { year, month: 2, day: 17 },
    },
    {
      name: "Spring Festival",
      date: { year, month: 2, day: 18 },
    },
    {
      name: "Spring Festival",
      date: { year, month: 2, day: 19 },
    },
    {
      name: "Spring Festival",
      date: { year, month: 2, day: 20 },
    },
    {
      name: "Spring Festival",
      date: { year, month: 2, day: 23 },
    },
    {
      name: "Qingming Festival",
      date: { year, month: 4, day: 6 },
    },
    {
      name: "Labour Day",
      date: { year, month: 5, day: 1 },
    },
    {
      name: "Labour Day",
      date: { year, month: 5, day: 4 },
    },
    {
      name: "Labour Day",
      date: { year, month: 5, day: 5 },
    },
    {
      name: "Dragon Boat Festival",
      date: { year, month: 6, day: 19 },
    },
    {
      name: "Mid-Autumn Festival",
      date: { year, month: 9, day: 25 },
    },
    {
      name: "National Day",
      date: { year, month: 10, day: 1 },
    },
    {
      name: "National Day",
      date: { year, month: 10, day: 2 },
    },
    {
      name: "National Day",
      date: { year, month: 10, day: 5 },
    },
    {
      name: "National Day",
      date: { year, month: 10, day: 6 },
    },
    {
      name: "National Day",
      date: { year, month: 10, day: 7 },
    },
  ]);
}

function getMarketEarlyClose(
  session: MarketSession,
  year: number,
  month: number,
  day: number,
) {
  if (session.holidayCalendar === "hkex") {
    return getHkexEarlyClose(year, month, day);
  }

  return null;
}

function getMarketHoliday(session: MarketSession, year: number, month: number, day: number) {
  if (!session.holidayCalendar) return null;

  const holidays = {
    nyse: getNyseHolidays,
    lse: getLseHolidays,
    jpx: getJpxHolidays,
    hkex: getHkexHolidays,
    sse: getSseHolidays,
  }[session.holidayCalendar](year);

  return holidays.get(getDateKey(year, month, day)) ?? null;
}

function isTradingDay(session: MarketSession, year: number, month: number, day: number) {
  return isWeekday(year, month, day) && !getMarketHoliday(session, year, month, day);
}

function getNextTradingDay(session: MarketSession, year: number, month: number, day: number) {
  let next = { year, month, day };

  do {
    next = addLocalDays(next.year, next.month, next.day, 1);
  } while (!isTradingDay(session, next.year, next.month, next.day));

  return next;
}

function formatCountdown(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function getNextCmeSundayOpen(year: number, month: number, day: number) {
  let next = { year, month, day };

  while (getLocalWeekday(next.year, next.month, next.day) !== 0) {
    next = addLocalDays(next.year, next.month, next.day, 1);
  }

  return next;
}

function getCmeClock(session: MarketSession, now: Date): MarketClockState {
  const parts = getZonedParts(now, session.timeZone);
  const weekday = getLocalWeekday(parts.year, parts.month, parts.day);
  const nowMs = now.getTime();
  const todayCloseTime = getCmeCloseTime(session, parts.year, parts.month, parts.day);
  const todayOpen = zonedDateTimeToUtcMs(
    session.timeZone,
    parts.year,
    parts.month,
    parts.day,
    session.openHour,
    session.openMinute,
  );
  const todayClose = zonedDateTimeToUtcMs(
    session.timeZone,
    parts.year,
    parts.month,
    parts.day,
    todayCloseTime.closeHour,
    todayCloseTime.closeMinute,
  );

  if (weekday === 0) {
    if (nowMs >= todayOpen) {
      const monday = addLocalDays(parts.year, parts.month, parts.day, 1);
      const mondayCloseTime = getCmeCloseTime(
        session,
        monday.year,
        monday.month,
        monday.day,
      );
      const mondayClose = zonedDateTimeToUtcMs(
        session.timeZone,
        monday.year,
        monday.month,
        monday.day,
        mondayCloseTime.closeHour,
        mondayCloseTime.closeMinute,
      );

      return {
        isOpen: true,
        countdown: formatCountdown(mondayClose - nowMs),
        target: mondayCloseTime.earlyClose ? mondayCloseTime.earlyClose.name : "cierre",
      };
    }

    return {
      isOpen: false,
      countdown: formatCountdown(todayOpen - nowMs),
      target: "apertura",
    };
  }

  if (weekday >= 1 && weekday <= 4) {
    if (nowMs < todayClose || nowMs >= todayOpen) {
      const closeDate =
        nowMs >= todayOpen
          ? addLocalDays(parts.year, parts.month, parts.day, 1)
          : { year: parts.year, month: parts.month, day: parts.day };
      const closeTime = getCmeCloseTime(
        session,
        closeDate.year,
        closeDate.month,
        closeDate.day,
      );
      const nextClose = zonedDateTimeToUtcMs(
        session.timeZone,
        closeDate.year,
        closeDate.month,
        closeDate.day,
        closeTime.closeHour,
        closeTime.closeMinute,
      );

      return {
        isOpen: true,
        countdown: formatCountdown(nextClose - nowMs),
        target: closeTime.earlyClose ? closeTime.earlyClose.name : "cierre",
      };
    }

    return {
      isOpen: false,
      countdown: formatCountdown(todayOpen - nowMs),
      target: "apertura",
    };
  }

  if (weekday === 5 && nowMs < todayClose) {
    return {
      isOpen: true,
      countdown: formatCountdown(todayClose - nowMs),
      target: todayCloseTime.earlyClose ? todayCloseTime.earlyClose.name : "cierre",
    };
  }

  const nextSunday = getNextCmeSundayOpen(parts.year, parts.month, parts.day);
  const nextOpen = zonedDateTimeToUtcMs(
    session.timeZone,
    nextSunday.year,
    nextSunday.month,
    nextSunday.day,
    session.openHour,
    session.openMinute,
  );

  return {
    isOpen: false,
    countdown: formatCountdown(nextOpen - nowMs),
    target: "apertura",
  };
}

function getMarketClock(session: MarketSession, now: Date): MarketClockState {
  if (session.type === "cme") {
    return getCmeClock(session, now);
  }

  const parts = getZonedParts(now, session.timeZone);
  const earlyClose = getMarketEarlyClose(session, parts.year, parts.month, parts.day);
  const closeHour = earlyClose?.closeHour ?? session.closeHour;
  const closeMinute = earlyClose?.closeMinute ?? session.closeMinute;
  const todayOpen = zonedDateTimeToUtcMs(
    session.timeZone,
    parts.year,
    parts.month,
    parts.day,
    session.openHour,
    session.openMinute,
  );
  const todayClose = zonedDateTimeToUtcMs(
    session.timeZone,
    parts.year,
    parts.month,
    parts.day,
    closeHour,
    closeMinute,
  );
  const hasBreak =
    session.breakStartHour !== undefined &&
    session.breakStartMinute !== undefined &&
    session.breakEndHour !== undefined &&
    session.breakEndMinute !== undefined;
  const breakStart = hasBreak
    ? zonedDateTimeToUtcMs(
        session.timeZone,
        parts.year,
        parts.month,
        parts.day,
        session.breakStartHour!,
        session.breakStartMinute!,
      )
    : null;
  const breakEnd = hasBreak
    ? zonedDateTimeToUtcMs(
        session.timeZone,
        parts.year,
        parts.month,
        parts.day,
        session.breakEndHour!,
        session.breakEndMinute!,
      )
    : null;
  const nowMs = now.getTime();
  const holiday = getMarketHoliday(session, parts.year, parts.month, parts.day);
  const openToday = isTradingDay(session, parts.year, parts.month, parts.day);

  if (
    openToday &&
    breakStart !== null &&
    breakEnd !== null &&
    nowMs >= breakStart &&
    nowMs < breakEnd
  ) {
    return {
      isOpen: false,
      countdown: formatCountdown(breakEnd - nowMs),
      target: "apertura",
      statusLabel: "Break",
    };
  }

  if (openToday && nowMs >= todayOpen && nowMs < todayClose) {
    const nextTarget =
      breakStart !== null && nowMs < breakStart
        ? { ms: breakStart, label: "lunch break" }
        : { ms: todayClose, label: earlyClose ? earlyClose.name : "cierre" };

    return {
      isOpen: true,
      countdown: formatCountdown(nextTarget.ms - nowMs),
      target: nextTarget.label,
      statusLabel: "Open",
    };
  }

  const nextOpenDate =
    openToday && nowMs < todayOpen
      ? { year: parts.year, month: parts.month, day: parts.day }
      : getNextTradingDay(session, parts.year, parts.month, parts.day);
  const nextOpen = zonedDateTimeToUtcMs(
    session.timeZone,
    nextOpenDate.year,
    nextOpenDate.month,
    nextOpenDate.day,
    session.openHour,
    session.openMinute,
  );

  return {
    isOpen: false,
    countdown: formatCountdown(nextOpen - nowMs),
    target: holiday ? holiday.name : "apertura",
    statusLabel: holiday ? "Holiday" : "Closed",
  };
}

function MarketClocks() {
  const [now, setNow] = useState<Date | null>(null);
  const clocks = useMemo(
    () =>
      MARKET_SESSIONS.map((session) => ({
        session,
        clock: now ? getMarketClock(session, now) : null,
      })),
    [now],
  );

  useEffect(() => {
    const startId = window.setTimeout(() => setNow(new Date()), 0);
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => {
      window.clearTimeout(startId);
      window.clearInterval(id);
    };
  }, []);

  return (
    <div className="hidden min-w-0 items-center gap-1 xl:flex">
      {clocks.map(({ session, clock }) => (
        <div
          key={session.code}
          title={
            clock
              ? `${session.label}: ${clock.statusLabel ?? (clock.isOpen ? "Open" : "Closed")} - ${clock.target}`
              : session.label
          }
          className="flex h-7 items-center gap-1.5 rounded-sm border border-tv-border bg-tv-bg/40 px-2 text-[10px] leading-none text-tv-text-muted"
        >
          <span className="font-semibold text-tv-text">{session.code}</span>
          <span
            className={
              !clock
                ? "h-1.5 w-1.5 rounded-full bg-tv-text-muted"
                : clock.isOpen
                ? "h-1.5 w-1.5 rounded-full bg-tv-green"
                : "h-1.5 w-1.5 rounded-full bg-tv-red"
            }
          />
          <span
            className={
              !clock
                ? "text-tv-text-muted"
                : clock.isOpen
                  ? "text-tv-green"
                  : "text-tv-red"
            }
          >
            {clock ? (clock.statusLabel ?? (clock.isOpen ? "Open" : "Closed")) : "--"}
          </span>
          <span className="tabular-nums text-tv-text">
            {clock?.countdown ?? "--:--:--"}
          </span>
        </div>
      ))}
    </div>
  );
}

function PageBackgroundSelector() {
  const pageBackgroundColor = useChartStore((s) => s.pageBackgroundColor);
  const pagePanelColor = useChartStore((s) => s.pagePanelColor);
  const setPageBackgroundColor = useChartStore((s) => s.setPageBackgroundColor);
  const setPagePanelColor = useChartStore((s) => s.setPagePanelColor);
  const normalizedChartColor = /^#[0-9a-fA-F]{6}$/.test(pageBackgroundColor)
    ? pageBackgroundColor
    : DEFAULT_PAGE_BACKGROUND_COLOR;
  const normalizedPanelColor = /^#[0-9a-fA-F]{6}$/.test(pagePanelColor)
    ? pagePanelColor
    : DEFAULT_PAGE_PANEL_COLOR;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        title="Color de fondo"
        className="flex h-7 items-center gap-1.5 rounded px-2 text-xs text-tv-text-muted hover:bg-tv-panel-hover hover:text-tv-text"
      >
        <Palette className="h-3.5 w-3.5" />
        <span
          className="h-3.5 w-3.5 rounded-sm border border-tv-border"
          style={{ backgroundColor: normalizedChartColor }}
        />
        <span
          className="-ml-1 h-3.5 w-3.5 rounded-sm border border-tv-border"
          style={{ backgroundColor: normalizedPanelColor }}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 bg-tv-panel p-1.5">
        <div className="px-1 pb-1 text-[10px] uppercase text-tv-text-muted">
          Gráfico
        </div>
        <div className="grid grid-cols-3 gap-1">
          {PAGE_BACKGROUND_PRESETS.map((preset) => {
            const active =
              normalizedChartColor.toLowerCase() === preset.value.toLowerCase();

            return (
              <button
                key={preset.value}
                type="button"
                title={preset.label}
                onClick={() => setPageBackgroundColor(preset.value)}
                className="relative flex h-8 items-center justify-center rounded border border-tv-border hover:border-tv-text-muted"
              >
                <span
                  className="h-5 w-5 rounded-sm border border-tv-border"
                  style={{ backgroundColor: preset.value }}
                />
                {active && (
                  <Check className="absolute right-1 top-1 h-3 w-3 text-tv-blue" />
                )}
              </button>
            );
          })}
        </div>
        <label className="mt-2 flex h-8 items-center gap-2 rounded border border-tv-border bg-tv-bg px-2 text-[11px] text-tv-text-muted">
          <span>Personal</span>
          <input
            type="color"
            value={normalizedChartColor}
            onChange={(event) => setPageBackgroundColor(event.target.value)}
            className="ml-auto h-5 w-8 cursor-pointer rounded border border-tv-border bg-transparent p-0"
          />
        </label>
        <div className="mt-3 px-1 pb-1 text-[10px] uppercase text-tv-text-muted">
          Página
        </div>
        <div className="grid grid-cols-3 gap-1">
          {PAGE_PANEL_PRESETS.map((preset) => {
            const active =
              normalizedPanelColor.toLowerCase() === preset.value.toLowerCase();

            return (
              <button
                key={preset.value}
                type="button"
                title={preset.label}
                onClick={() => setPagePanelColor(preset.value)}
                className="relative flex h-8 items-center justify-center rounded border border-tv-border hover:border-tv-text-muted"
              >
                <span
                  className="h-5 w-5 rounded-sm border border-tv-border"
                  style={{ backgroundColor: preset.value }}
                />
                {active && (
                  <Check className="absolute right-1 top-1 h-3 w-3 text-tv-blue" />
                )}
              </button>
            );
          })}
        </div>
        <label className="mt-2 flex h-8 items-center gap-2 rounded border border-tv-border bg-tv-bg px-2 text-[11px] text-tv-text-muted">
          <span>Personal</span>
          <input
            type="color"
            value={normalizedPanelColor}
            onChange={(event) => setPagePanelColor(event.target.value)}
            className="ml-auto h-5 w-8 cursor-pointer rounded border border-tv-border bg-transparent p-0"
          />
        </label>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Header() {
  return (
    <header className="flex h-12 items-center justify-between border-b border-tv-border bg-tv-panel px-3 overflow-x-auto hide-scrollbar">
      <div className="flex shrink-0 items-center gap-1">
        <div className="hidden md:flex items-center gap-2 pr-2">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-tv-blue/20">
            <Zap className="h-4 w-4 text-tv-blue" />
          </div>
          <span className="text-sm font-semibold text-tv-text">ChartsAnalyzer</span>
        </div>
        <Separator orientation="vertical" className="h-6 bg-tv-border" />
        <SymbolSelector />
        <Separator orientation="vertical" className="h-6 bg-tv-border" />
        <TimeframeSelector />
        <Separator orientation="vertical" className="mx-1 h-6 bg-tv-border" />
        <IndicatorMenu />
        <Separator orientation="vertical" className="mx-1 hidden h-6 bg-tv-border xl:block" />
        <div className="hidden md:block">
          <MarketClocks />
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Link
          href="/heatmap"
          className="flex h-7 items-center gap-1.5 rounded px-2 text-xs font-medium text-tv-text-muted hover:bg-tv-panel-hover hover:text-tv-text"
        >
          <Grid2X2 className="h-3.5 w-3.5" />
          <span>Heatmap</span>
        </Link>
        <PageBackgroundSelector />
      </div>
    </header>
  );
}
