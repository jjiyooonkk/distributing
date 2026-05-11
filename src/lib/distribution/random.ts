import type { PersonRow, Group, DistributionConfig } from '@/types';
import { nanoid } from 'nanoid';

export function distributeRandom(
  people: PersonRow[],
  config: DistributionConfig
): Group[] {
  const groups: Group[] = Array.from({ length: config.groupCount }, (_, i) => ({
    id: nanoid(8),
    name: config.groupNames?.[i] || `${i + 1}조`,
    members: [],
    stats: {},
  }));

  // Pin leaders first
  const leaderPinnedIds = new Set<string>();
  if (config.groupLeaders) {
    const nameKey = Object.keys(people[0] || {}).find((k) =>
      ['이름', '성명', 'name', 'Name'].includes(k)
    );
    if (nameKey) {
      for (const gl of config.groupLeaders) {
        const group = groups.find((g) => g.name === gl.groupName);
        if (!group) continue;
        for (const name of [gl.leader, gl.subLeader]) {
          if (!name?.trim()) continue;
          const person = people.find(
            (p) => p[nameKey]?.trim() === name.trim() && !leaderPinnedIds.has(p.id)
          );
          if (person) {
            group.members.push(person);
            leaderPinnedIds.add(person.id);
          }
        }
      }
    }
  }

  const remaining = people.filter((p) => !leaderPinnedIds.has(p.id));
  // Fisher-Yates shuffle
  for (let i = remaining.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
  }

  remaining.forEach((person, i) => {
    groups[i % config.groupCount].members.push(person);
  });

  return groups;
}
