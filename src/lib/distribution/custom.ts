import type {
  PersonRow,
  Group,
  DistributionConfig,
  PinRule,
  SpreadRule,
  ClusterRule,
  EnsureRule,
  ExcludeRule,
  RatioRule,
  GroupCapacity,
} from '@/types';
import { nanoid } from 'nanoid';

function createGroups(config: DistributionConfig): Group[] {
  return Array.from({ length: config.groupCount }, (_, i) => ({
    id: nanoid(8),
    name: config.groupNames?.[i] || `${i + 1}조`,
    members: [],
    stats: {},
  }));
}

function getCapacity(
  groupName: string,
  capacities: GroupCapacity[] | undefined,
  totalPeople: number,
  groupCount: number
): { min: number; max: number } {
  const cap = capacities?.find((c) => c.groupName === groupName);
  if (cap) return { min: cap.min, max: cap.max };
  // Default: roughly even
  const base = Math.floor(totalPeople / groupCount);
  return { min: Math.max(1, base - 1), max: base + 2 };
}

// Spread score: how much a group already has of a given column value
// Lower is better for spread (we want to put this person in a group that has LESS of their value)
function spreadScore(group: Group, columnName: string, value: string): number {
  let count = 0;
  for (const m of group.members) {
    if (m[columnName] === value) count++;
  }
  return count;
}

// Cluster score: how much a group already has of similar values
// Higher is better for cluster (we want to put this person with similar people)
function clusterScore(
  group: Group,
  rule: ClusterRule,
  value: string
): number {
  // Find which similarity group this value belongs to
  const simGroup = rule.similarValues?.find((g) => g.includes(value));
  let score = 0;
  for (const m of group.members) {
    const mVal = m[rule.columnName];
    if (mVal === value) {
      score += 2; // exact match
    } else if (simGroup && simGroup.includes(mVal)) {
      score += 1; // similar
    }
  }
  return score;
}

export function distributeCustom(
  people: PersonRow[],
  config: DistributionConfig
): Group[] {
  const groups = createGroups(config);
  const pinRules = config.rules.filter((r): r is PinRule => r.type === 'pin' && !!r.value);
  const spreadRules = config.rules.filter((r): r is SpreadRule => r.type === 'spread');
  const clusterRules = config.rules.filter((r): r is ClusterRule => r.type === 'cluster');
  const ensureRules = config.rules.filter((r): r is EnsureRule => r.type === 'ensure' && !!r.value);
  const excludeRules = config.rules.filter((r): r is ExcludeRule => r.type === 'exclude' && !!r.value);
  const ratioRules = config.rules.filter((r): r is RatioRule => r.type === 'ratio');

  const remaining: PersonRow[] = [];

  // Phase 0: Pin leaders/sub-leaders to their groups by name matching
  const leaderPinnedIds = new Set<string>();
  if (config.groupLeaders) {
    // Find the name column
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

  // Phase 1: Apply pin rules (fixed assignments)
  for (const person of people) {
    if (leaderPinnedIds.has(person.id)) continue;
    let pinned = false;
    for (const rule of pinRules) {
      if (person[rule.columnName] === rule.value) {
        const target = groups.find((g) => g.name === rule.targetGroup);
        if (target) {
          target.members.push(person);
          pinned = true;
          break;
        }
      }
    }
    if (!pinned) {
      remaining.push(person);
    }
  }

  // Phase 1.5: Ensure rules — guarantee min count of specific values per group
  // e.g. "1종 운전 가능자가 각 그룹에 최소 1명"
  const ensuredIds = new Set<string>();
  for (const rule of ensureRules) {
    // Find all people with the matching value who are still in remaining
    const candidates = remaining.filter(
      (p) => p[rule.columnName] === rule.value
    );

    // For each group, check if it already meets the minimum (from pinned people)
    for (const group of groups) {
      const currentCount = group.members.filter(
        (m) => m[rule.columnName] === rule.value
      ).length;
      const needed = rule.minPerGroup - currentCount;

      for (let n = 0; n < needed; n++) {
        // Find a candidate not yet assigned
        const candidate = candidates.find(
          (c) => !ensuredIds.has(c.id) && remaining.includes(c)
        );
        if (!candidate) break; // not enough people to satisfy
        group.members.push(candidate);
        ensuredIds.add(candidate.id);
        remaining.splice(remaining.indexOf(candidate), 1);
      }
    }
  }

  // Shuffle remaining for fairness before greedy assignment
  for (let i = remaining.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
  }

  // Phase 2: Greedy assignment with spread + cluster scoring
  for (const person of remaining) {
    let bestGroup = -1;
    let bestScore = -Infinity;

    for (let g = 0; g < groups.length; g++) {
      const group = groups[g];
      const cap = getCapacity(
        group.name,
        config.groupCapacities,
        people.length,
        config.groupCount
      );

      // Skip if group is full
      if (group.members.length >= cap.max) continue;

      // Skip if excluded
      const excluded = excludeRules.some(
        (rule) => person[rule.columnName] === rule.value && group.name === rule.excludeGroup
      );
      if (excluded) continue;

      let score = 0;

      // Spread: penalize groups that already have same value
      for (const rule of spreadRules) {
        const val = person[rule.columnName] || '';
        score -= spreadScore(group, rule.columnName, val) * rule.weight;
      }

      // Cluster: reward groups that have similar values
      for (const rule of clusterRules) {
        const val = person[rule.columnName] || '';
        score += clusterScore(group, rule, val) * rule.weight;
      }

      // Ratio: penalize deviation from target ratios
      for (const rule of ratioRules) {
        const val = person[rule.columnName] || '';
        const totalRatio = Object.values(rule.ratios).reduce((s, r) => s + r, 0);
        const targetRatio = (rule.ratios[val] || 0) / (totalRatio || 1);
        const currentTotal = group.members.length + 1;
        const currentCount = group.members.filter(
          (m) => m[rule.columnName] === val
        ).length + 1;
        const deviation = Math.abs(currentCount / currentTotal - targetRatio);
        score -= deviation * rule.weight * 10;
      }

      // Prefer smaller groups (balance)
      score -= group.members.length * 0.5;

      if (score > bestScore) {
        bestScore = score;
        bestGroup = g;
      }
    }

    // If all groups hit max, find the one with most room
    if (bestGroup === -1) {
      let minSize = Infinity;
      for (let g = 0; g < groups.length; g++) {
        if (groups[g].members.length < minSize) {
          minSize = groups[g].members.length;
          bestGroup = g;
        }
      }
    }

    groups[bestGroup].members.push(person);
  }

  // Phase 3: Post-optimization with simulated annealing
  // Respect pin + ensure + leader rules: these people don't move
  const pinnedIds = new Set<string>([...ensuredIds, ...leaderPinnedIds]);
  for (const rule of pinRules) {
    for (const person of people) {
      if (person[rule.columnName] === rule.value) {
        pinnedIds.add(person.id);
      }
    }
  }

  let temperature = 50;
  const coolingRate = 0.995;

  for (let iter = 0; iter < 3000; iter++) {
    const g1idx = Math.floor(Math.random() * groups.length);
    let g2idx = Math.floor(Math.random() * groups.length);
    if (g1idx === g2idx) g2idx = (g2idx + 1) % groups.length;

    const g1 = groups[g1idx];
    const g2 = groups[g2idx];

    // Find swappable (non-pinned) members
    const swappable1 = g1.members.filter((m) => !pinnedIds.has(m.id));
    const swappable2 = g2.members.filter((m) => !pinnedIds.has(m.id));
    if (swappable1.length === 0 || swappable2.length === 0) continue;

    const i1 = Math.floor(Math.random() * swappable1.length);
    const i2 = Math.floor(Math.random() * swappable2.length);
    const p1 = swappable1[i1];
    const p2 = swappable2[i2];

    const idx1 = g1.members.indexOf(p1);
    const idx2 = g2.members.indexOf(p2);

    // Calculate current score
    const scoreBefore = calcGroupScore(g1, spreadRules, clusterRules, ensureRules, ratioRules) +
      calcGroupScore(g2, spreadRules, clusterRules, ensureRules, ratioRules);

    // Swap
    g1.members[idx1] = p2;
    g2.members[idx2] = p1;

    const scoreAfter = calcGroupScore(g1, spreadRules, clusterRules, ensureRules, ratioRules) +
      calcGroupScore(g2, spreadRules, clusterRules, ensureRules, ratioRules);

    const delta = scoreAfter - scoreBefore;

    // Check capacity constraints after swap
    const cap1 = getCapacity(g1.name, config.groupCapacities, people.length, config.groupCount);
    const cap2 = getCapacity(g2.name, config.groupCapacities, people.length, config.groupCount);
    const withinCap =
      g1.members.length >= cap1.min && g1.members.length <= cap1.max &&
      g2.members.length >= cap2.min && g2.members.length <= cap2.max;

    // Check exclude rules aren't violated by swap
    const excludeViolation = excludeRules.some(
      (rule) =>
        (p2[rule.columnName] === rule.value && g1.name === rule.excludeGroup) ||
        (p1[rule.columnName] === rule.value && g2.name === rule.excludeGroup)
    );

    if (withinCap && !excludeViolation && (delta < 0 || Math.random() < Math.exp(-delta / temperature))) {
      // Accept
    } else {
      // Revert
      g1.members[idx1] = p1;
      g2.members[idx2] = p2;
    }

    temperature *= coolingRate;
  }

  return groups;
}

function calcGroupScore(
  group: Group,
  spreadRules: SpreadRule[],
  clusterRules: ClusterRule[],
  ensureRules: EnsureRule[],
  ratioRules: RatioRule[]
): number {
  let score = 0;

  // Spread penalty: for each value that appears multiple times
  for (const rule of spreadRules) {
    const counts: Record<string, number> = {};
    for (const m of group.members) {
      const v = m[rule.columnName] || '';
      counts[v] = (counts[v] || 0) + 1;
    }
    for (const count of Object.values(counts)) {
      if (count > 1) score += (count - 1) * rule.weight;
    }
  }

  // Cluster reward: for each pair of similar values together
  for (const rule of clusterRules) {
    for (let i = 0; i < group.members.length; i++) {
      for (let j = i + 1; j < group.members.length; j++) {
        const v1 = group.members[i][rule.columnName] || '';
        const v2 = group.members[j][rule.columnName] || '';
        if (v1 === v2) {
          score -= 2 * rule.weight; // reward (negative = better)
        } else {
          const simGroup = rule.similarValues?.find(
            (g) => g.includes(v1) && g.includes(v2)
          );
          if (simGroup) score -= 1 * rule.weight;
        }
      }
    }
  }

  // Ensure penalty: heavily penalize if group doesn't meet minimum
  for (const rule of ensureRules) {
    const count = group.members.filter(
      (m) => m[rule.columnName] === rule.value
    ).length;
    if (count < rule.minPerGroup) {
      score += (rule.minPerGroup - count) * 100;
    }
  }

  // Ratio penalty: penalize deviation from target ratios
  for (const rule of ratioRules) {
    const totalRatio = Object.values(rule.ratios).reduce((s, r) => s + r, 0);
    if (totalRatio === 0 || group.members.length === 0) continue;
    for (const [val, ratio] of Object.entries(rule.ratios)) {
      const targetPct = ratio / totalRatio;
      const actualCount = group.members.filter((m) => m[rule.columnName] === val).length;
      const actualPct = actualCount / group.members.length;
      score += Math.abs(actualPct - targetPct) * rule.weight * 5;
    }
  }

  return score;
}
