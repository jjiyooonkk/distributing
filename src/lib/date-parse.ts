/**
 * Parse Korean datetime strings like:
 * "5/8 6시", "5월 8일 오전 6시", "5/8 13:00", "5/8", "2024-05-08"
 */
export function parseKoreanDateTime(text: string, baseYear?: number): Date | null {
  if (!text || typeof text !== 'string') return null;
  const t = text.trim();
  const year = baseYear || new Date().getFullYear();

  // ISO format: 2024-05-08 or 2024-05-08T06:00
  const iso = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2}))?/);
  if (iso) {
    return new Date(+iso[1], +iso[2] - 1, +iso[3], +(iso[4] || 0), +(iso[5] || 0));
  }

  let month = 0, day = 0, hour = 0;

  // "5월 8일" or "5/8" pattern
  const dateMatch = t.match(/(\d{1,2})[\/월\-]\.?\s*(\d{1,2})[일]?/);
  if (!dateMatch) return null;
  month = +dateMatch[1];
  day = +dateMatch[2];

  // "오전/오후 N시" or "N시" or "N:MM"
  const timeKr = t.match(/오후\s*(\d{1,2})\s*시/);
  const timeAm = t.match(/오전\s*(\d{1,2})\s*시/);
  const timeSimple = t.match(/(\d{1,2})\s*시/);
  const timeNum = t.match(/(\d{1,2}):(\d{2})/);

  if (timeKr) {
    hour = +timeKr[1];
    if (hour < 12) hour += 12;
  } else if (timeAm) {
    hour = +timeAm[1];
    if (hour === 12) hour = 0;
  } else if (timeNum) {
    hour = +timeNum[1];
  } else if (timeSimple) {
    // Only use if it's not the month/day number
    const h = +timeSimple[1];
    if (timeSimple.index! > dateMatch.index! + dateMatch[0].length - 1) {
      hour = h;
    }
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return new Date(year, month - 1, day, hour, 0, 0);
}

/**
 * Compute nights stayed: arrival night through departure-1 night
 * e.g., arrive 5/8 6시, depart 5/10 13시 → nights: ["5/8", "5/9"]
 */
export function computeStayNights(arrival: Date, departure: Date): string[] {
  const nights: string[] = [];
  const d = new Date(arrival);
  d.setHours(0, 0, 0, 0);
  const depDay = new Date(departure);
  depDay.setHours(0, 0, 0, 0);

  while (d < depDay) {
    nights.push(formatDate(d));
    d.setDate(d.getDate() + 1);
  }
  return nights;
}

/**
 * Compute work/activity days: all days with any presence
 * e.g., arrive 5/8 6시, depart 5/10 13시 → work: ["5/8", "5/9", "5/10"]
 */
export function computeWorkDays(arrival: Date, departure: Date): string[] {
  const days: string[] = [];
  const d = new Date(arrival);
  d.setHours(0, 0, 0, 0);
  const depDay = new Date(departure);
  depDay.setHours(0, 0, 0, 0);

  while (d <= depDay) {
    days.push(formatDate(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

export function formatDate(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

export function formatDateLabel(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}(${DAY_NAMES[d.getDay()]})`;
}

export function parseDateStr(dateStr: string, baseYear?: number): Date {
  const year = baseYear || new Date().getFullYear();
  const m = dateStr.match(/(\d+)\/(\d+)/);
  if (!m) return new Date(year, 0, 1);
  return new Date(year, +m[1] - 1, +m[2]);
}
