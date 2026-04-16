import type { PersonRow, Group, DistributionConfig } from '@/types';
import { nanoid } from 'nanoid';

export function distributeSchedule(
  people: PersonRow[],
  config: DistributionConfig
): Group[] {
  const { groupCount, scheduleColumns = [] } = config;

  const groups: Group[] = Array.from({ length: groupCount }, (_, i) => ({
    id: nanoid(8),
    name: config.groupNames?.[i] || `숙소 ${i + 1}`,
    members: [],
    stats: {},
  }));

  // Build schedule matrix: for each person, which time slots they're present
  const personSlots = people.map((person) => {
    const slots = new Set<string>();
    for (const col of scheduleColumns) {
      const val = (person[col] || '').trim().toUpperCase();
      if (val === 'O' || val === 'Y' || val === 'YES' || val === '1' || val === 'TRUE') {
        slots.add(col);
      }
    }
    return { person, slots };
  });

  // Sort by number of slots (descending) - people present more days go first
  personSlots.sort((a, b) => b.slots.size - a.slots.size);

  // Track max concurrent per group per slot
  const groupSlotCounts: Map<string, number>[] = Array.from(
    { length: groupCount },
    () => new Map()
  );

  for (const { person, slots } of personSlots) {
    // Assign to group with lowest max concurrent count for this person's slots
    let bestGroup = 0;
    let bestMax = Infinity;
    for (let g = 0; g < groupCount; g++) {
      let maxConcurrent = 0;
      for (const slot of slots) {
        maxConcurrent = Math.max(maxConcurrent, groupSlotCounts[g].get(slot) || 0);
      }
      if (maxConcurrent < bestMax) {
        bestMax = maxConcurrent;
        bestGroup = g;
      }
    }
    groups[bestGroup].members.push(person);
    for (const slot of slots) {
      groupSlotCounts[bestGroup].set(
        slot,
        (groupSlotCounts[bestGroup].get(slot) || 0) + 1
      );
    }
  }

  return groups;
}
