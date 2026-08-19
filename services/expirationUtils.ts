// Utility to calculate standard US Monthly Options Expiration Dates (3rd Friday of each month)

export interface MonthlyExpiration {
  year: number;
  month: number; // 1-12
  monthName: string; // "Aug", "Sep", etc.
  day: number; // Day of month (e.g. 21)
  date: Date;
  dateString: string; // e.g. "Aug 21, 2026"
  shortDateString: string; // e.g. "Aug 21"
  isoString: string; // e.g. "2026-08-21"
  dte: number; // Days to expiration from reference date
  label: string; // e.g. "Aug 21, 2026 (7 DTE)"
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

/**
 * Calculates the 3rd Friday of a given year and month (0-indexed month: 0=Jan, 7=Aug)
 */
export function getThirdFriday(year: number, monthIndex: number): Date {
  // Find day of week for 1st of the month (0=Sun, 5=Fri, 6=Sat)
  const firstOfMonth = new Date(Date.UTC(year, monthIndex, 1));
  const dayOfWeek = firstOfMonth.getUTCDay();
  
  // Days until the 1st Friday of the month
  const daysToFirstFriday = (5 - dayOfWeek + 7) % 7;
  const firstFridayDate = 1 + daysToFirstFriday;
  
  // 3rd Friday is 14 days after the 1st Friday
  const thirdFridayDate = firstFridayDate + 14;
  
  // 20:00 UTC (4:00 PM EST market close)
  return new Date(Date.UTC(year, monthIndex, thirdFridayDate, 20, 0, 0));
}

/**
 * Returns a list of upcoming standard monthly expiration dates (3rd Friday of each month).
 */
export function getUpcomingMonthlyExpirations(count: number = 12, fromDate: Date = new Date()): MonthlyExpiration[] {
  const expirations: MonthlyExpiration[] = [];
  const nowUtc = fromDate.getTime();
  
  let currentYear = fromDate.getUTCFullYear();
  let currentMonthIndex = fromDate.getUTCMonth(); // 0-11
  
  while (expirations.length < count) {
    const thirdFriday = getThirdFriday(currentYear, currentMonthIndex);
    
    // If the 3rd Friday is in the future (or today before market close)
    if (thirdFriday.getTime() >= nowUtc - (1000 * 60 * 60 * 24)) {
      const diffMs = thirdFriday.getTime() - nowUtc;
      const dte = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
      const monthName = MONTH_NAMES[currentMonthIndex];
      const day = thirdFriday.getUTCDate();
      const dateString = `${monthName} ${day}, ${currentYear}`;
      const shortDateString = `${monthName} ${day}`;
      const isoString = thirdFriday.toISOString().split('T')[0];
      
      expirations.push({
        year: currentYear,
        month: currentMonthIndex + 1,
        monthName,
        day,
        date: thirdFriday,
        dateString,
        shortDateString,
        isoString,
        dte,
        label: `${dateString} (${dte} DTE)`
      });
    }
    
    // Advance to next month
    currentMonthIndex++;
    if (currentMonthIndex > 11) {
      currentMonthIndex = 0;
      currentYear++;
    }
  }
  
  return expirations;
}

/**
 * Finds the standard monthly expiration closest to a target DTE (e.g. 30 DTE, 45 DTE).
 */
export function getClosestMonthlyExpiration(targetDte: number, fromDate: Date = new Date()): MonthlyExpiration {
  const upcoming = getUpcomingMonthlyExpirations(18, fromDate);
  if (upcoming.length === 0) {
    const fallbackDate = new Date(fromDate.getTime() + targetDte * 24 * 60 * 60 * 1000);
    const monthName = MONTH_NAMES[fallbackDate.getUTCMonth()];
    return {
      year: fallbackDate.getUTCFullYear(),
      month: fallbackDate.getUTCMonth() + 1,
      monthName,
      day: fallbackDate.getUTCDate(),
      date: fallbackDate,
      dateString: `${monthName} ${fallbackDate.getUTCDate()}, ${fallbackDate.getUTCFullYear()}`,
      shortDateString: `${monthName} ${fallbackDate.getUTCDate()}`,
      isoString: fallbackDate.toISOString().split('T')[0],
      dte: targetDte,
      label: `${monthName} ${fallbackDate.getUTCDate()}, ${fallbackDate.getUTCFullYear()} (${targetDte} DTE)`
    };
  }
  
  let closest = upcoming[0];
  let minDiff = Math.abs(closest.dte - targetDte);
  
  for (const exp of upcoming) {
    const diff = Math.abs(exp.dte - targetDte);
    if (diff < minDiff) {
      minDiff = diff;
      closest = exp;
    }
  }
  
  return closest;
}

/**
 * Formats a DTE value into a standard monthly expiration string e.g. "Aug 21, 2026" or "Sep 18, 2026"
 */
export function formatDteToMonthlyExpiration(dte: number, fromDate: Date = new Date()): string {
  const closest = getClosestMonthlyExpiration(dte, fromDate);
  return `${closest.dateString} (${closest.dte} DTE)`;
}
