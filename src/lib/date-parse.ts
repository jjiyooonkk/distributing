/**
 * Parse Korean datetime strings like:
 * "5/8 6시", "5월 8일 오전 6시", "5/8 13:00", "5/8", "2024-05-08"
 */
function parseTime(text: string): { hour: number; minute: number } {
  let hour = 0, minute = 0;
  // "오후 1시 25분" or "오후 1시"
  const pmKr = text.match(/오후\s*(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분)?/);
  const amKr = text.match(/오전\s*(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분)?/);
  // "13:25" or "13:00"
  const colonTime = text.match(/(\d{1,2}):(\d{2})/);
  // "11시 25분" or "11시" (without 오전/오후)
  const simpleKr = text.match(/(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분)?/);
  // ".11시" (dot-prefixed, e.g. 2026.05.08.11시)
  const dotTime = text.match(/[.](\d{1,2})\s*시/);

  if (pmKr) {
    hour = +pmKr[1]; if (hour < 12) hour += 12;
    minute = +(pmKr[2] || 0);
  } else if (amKr) {
    hour = +amKr[1]; if (hour === 12) hour = 0;
    minute = +(amKr[2] || 0);
  } else if (colonTime) {
    hour = +colonTime[1];
    minute = +colonTime[2];
  } else if (dotTime) {
    hour = +dotTime[1];
  } else if (simpleKr) {
    hour = +simpleKr[1];
    minute = +(simpleKr[2] || 0);
  }
  return { hour, minute };
}

export function parseKoreanDateTime(text: string, baseYear?: number): Date | null {
  if (!text || typeof text !== 'string') return null;
  const t = text.trim();
  const year = baseYear || new Date().getFullYear();

  // Full year format: 2026-05-08, 2026.05.10, 2026/05/10, 2026.05.08.11시
  const fullYear = t.match(/^(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/);
  if (fullYear) {
    const fy = +fullYear[1], fm = +fullYear[2], fd = +fullYear[3];
    const rest = t.slice(fullYear[0].length);
    const { hour: fh, minute: fmin } = parseTime(rest);
    return new Date(fy, fm - 1, fd, fh, fmin, 0);
  }

  // "5월 8일" or "5/8" or "5.8" pattern
  const dateMatch = t.match(/(\d{1,2})[\/월.\-]\s*(\d{1,2})[일]?/);
  if (!dateMatch) return null;
  const month = +dateMatch[1];
  const day = +dateMatch[2];

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const timeText = t.slice(dateMatch.index! + dateMatch[0].length);
  const { hour, minute } = parseTime(timeText);

  return new Date(year, month - 1, day, hour, minute, 0);
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
