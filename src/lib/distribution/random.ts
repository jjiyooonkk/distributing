import type { PersonRow, Group, DistributionConfig } from '@/types';
import { nanoid } from 'nanoid';

export function distributeRandom(
  people: PersonRow[],
  config: DistributionConfig
): Group[] {
  const shuffled = [...people];
  // Fisher-Yates shuffle
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const groups: Group[] = Array.from({ length: config.groupCount }, (_, i) => ({
    id: nanoid(8),
    name: config.groupNames?.[i] || `${i + 1}조`,
    members: [],
    stats: {},
  }));

  shuffled.forEach((person, i) => {
    groups[i % config.groupCount].members.push(person);
  });

  return groups;
}
