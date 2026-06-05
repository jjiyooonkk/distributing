import type {
  PersonRow,
  ScheduleConfig,
  ScheduleResult,
  ScheduleAssignment,
  ColumnMeta,
  PinRule,
  SpreadRule,
  ExcludeRule,
  EnsureRule,
  RoomDef,
} from '@/types';
import { parseKoreanDateTime, computeStayNights, formatDate } from '../date-parse';

interface PersonSchedule {
  person: PersonRow;
  nights: string[];
}

export function distributeBySchedule(
  people: PersonRow[],
  config: ScheduleConfig,
  columns: ColumnMeta[]
): ScheduleResult {
  const { arrivalColumn, departureColumn, rooms, rules, baseYear } = config;

  // Parse each person's schedule
  const schedules: PersonSchedule[] = [];
  for (const person of people) {
    const arrival = parseKoreanDateTime(person[arrivalColumn] || '', baseYear);
    const departure = parseKoreanDateTime(person[departureColumn] || '', baseYear);
    if (!arrival || !departure) continue;
    const nights = computeStayNights(arrival, departure);
    if (nights.length > 0) {
      schedules.push({ person, nights });
    }
  }

  // Derive all dates
  const allDatesSet = new Set<string>();
  for (const s of schedules) {
    for (const n of s.nights) allDatesSet.add(n);
  }
  const dates = [...allDatesSet].sort((a, b) => {
    const [am, ad] = a.split('/').map(Number);
    const [bm, bd] = b.split('/').map(Number);
    return am !== bm ? am - bm : ad - bd;
  });

  const roomNames = rooms.map((r) => r.name);

  // Detect gender column
  const genderCol = columns.find((c) =>
    c.name.includes('성별') || c.name.toLowerCase() === 'gender'
  );

  function getPersonGender(person: PersonRow): string {
    if (!genderCol) return '';
    const val = (person[genderCol.name] || '').trim();
    if (['남', '남자', 'M', 'm', 'Male', 'male'].includes(val)) return '남';
    if (['여', '여자', 'F', 'f', 'Female', 'female'].includes(val)) return '여';
    return '';
  }

  function roomAcceptsGender(roomDef: RoomDef, person: PersonRow): boolean {
    if (!roomDef.gender) return true; // 혼성
    return getPersonGender(person) === roomDef.gender;
  }

  // Extract rules
  const pinRules = rules.filter((r) => r.type === 'pin' && 'value' in r && (r as PinRule).value) as PinRule[];
  const spreadRules = rules.filter((r) => r.type === 'spread') as SpreadRule[];
  const excludeRules = rules.filter((r) => r.type === 'exclude' && 'value' in r && (r as ExcludeRule).value) as ExcludeRule[];
  const ensureRules = rules.filter((r) => r.type === 'ensure' && 'value' in r && (r as EnsureRule).value) as EnsureRule[];

  const assignments: ScheduleAssignment[] = [];

  // Track previous night's room per person for stability
  const prevRoom = new Map<string, string>();

  for (const date of dates) {
    // Who is present this night?
    const present = schedules
      .filter((s) => s.nights.includes(date))
      .map((s) => s.person);

    // Room assignment for this night
    const roomMembers: Map<string, PersonRow[]> = new Map();
    for (const r of roomNames) roomMembers.set(r, []);

    // Phase 1: Pin rules
    const remaining: PersonRow[] = [];
    for (const person of present) {
      let pinned = false;
      for (const rule of pinRules) {
        if (person[rule.columnName] === rule.value) {
          const target = roomMembers.get(rule.targetGroup);
          const targetRoomDef = rooms.find((r) => r.name === rule.targetGroup);
          if (target && targetRoomDef) {
            const cap = targetRoomDef.capacity || Infinity;
            if (target.length < cap && roomAcceptsGender(targetRoomDef, person)) {
              target.push(person);
              pinned = true;
              break;
            }
          }
        }
      }
      if (!pinned) remaining.push(person);
    }

    // Phase 2: Ensure rules
    const ensuredIds = new Set<string>();
    for (const rule of ensureRules) {
      const candidates = remaining.filter((p) => p[rule.columnName] === rule.value);
      for (const [roomName, members] of roomMembers) {
        const currentCount = members.filter((m) => m[rule.columnName] === rule.value).length;
        const needed = rule.minPerGroup - currentCount;
        for (let n = 0; n < needed; n++) {
          const candidate = candidates.find((c) => !ensuredIds.has(c.id));
          if (!candidate) break;
          const cap = rooms.find((r) => r.name === roomName)?.capacity || Infinity;
          if (members.length < cap) {
            members.push(candidate);
            ensuredIds.add(candidate.id);
          }
        }
      }
    }

    const stillRemaining = remaining.filter((p) => !ensuredIds.has(p.id));

    // Sort: people staying longer get assigned first (they need room stability most)
    // Also prioritize people who already have a room from last night
    const personNightCount = new Map<string, number>();
    for (const s of schedules) personNightCount.set(s.person.id, s.nights.length);

    stillRemaining.sort((a, b) => {
      const aHasPrev = prevRoom.has(a.id) ? 1 : 0;
      const bHasPrev = prevRoom.has(b.id) ? 1 : 0;
      if (aHasPrev !== bHasPrev) return bHasPrev - aHasPrev; // prev room holders first
      const aNights = personNightCount.get(a.id) || 0;
      const bNights = personNightCount.get(b.id) || 0;
      return bNights - aNights; // longer stays first
    });

    // Phase 3: Greedy assignment
    for (const person of stillRemaining) {
      let bestRoom = '';
      let bestScore = -Infinity;

      for (const [roomName, members] of roomMembers) {
        const roomDef = rooms.find((r) => r.name === roomName);
        const cap = roomDef?.capacity || Infinity;
        if (members.length >= cap) continue;

        // Gender check
        if (roomDef && !roomAcceptsGender(roomDef, person)) continue;

        // Exclude check
        const excluded = excludeRules.some(
          (rule) => person[rule.columnName] === rule.value &&
            (rule.excludeGroups?.includes(roomName) ?? roomName === rule.excludeGroup)
        );
        if (excluded) continue;

        let score = 0;

        // Spread: penalize rooms with same value
        for (const rule of spreadRules) {
          const val = person[rule.columnName] || '';
          const count = members.filter((m) => m[rule.columnName] === val).length;
          score -= count * rule.weight;
        }

        // Stability: very strong bonus for staying in same room
        // The longer they've been in this room, the stronger the bonus
        const prev = prevRoom.get(person.id);
        if (prev === roomName) {
          const totalNights = personNightCount.get(person.id) || 1;
          score += 100 + totalNights * 10; // dominant factor — avoid room changes
        }

        // Balance: prefer less full rooms (weaker than stability)
        score -= members.length * 0.3;

        if (score > bestScore) {
          bestScore = score;
          bestRoom = roomName;
        }
      }

      // Fallback: find least full room
      if (!bestRoom) {
        let minSize = Infinity;
        for (const [roomName, members] of roomMembers) {
          if (members.length < minSize) {
            minSize = members.length;
            bestRoom = roomName;
          }
        }
      }

      if (bestRoom) {
        roomMembers.get(bestRoom)!.push(person);
      }
    }

    // Record assignments and update prevRoom
    for (const [roomName, members] of roomMembers) {
      for (const person of members) {
        assignments.push({ date, roomName, personId: person.id });
        prevRoom.set(person.id, roomName);
      }
    }
  }

  return {
    assignments,
    dates,
    rooms: roomNames,
    timestamp: new Date().toISOString(),
  };
}
