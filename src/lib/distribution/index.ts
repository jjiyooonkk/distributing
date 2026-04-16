import type { PersonRow, Group, DistributionConfig, ColumnMeta } from '@/types';
import { distributeRandom } from './random';
import { distributeSchedule } from './schedule';
import { distributeCustom } from './custom';

function computeStats(groups: Group[], columns: ColumnMeta[]): Group[] {
  return groups.map((group) => {
    const stats: Record<string, Record<string, number>> = {};
    for (const col of columns) {
      stats[col.name] = {};
      for (const member of group.members) {
        const v = member[col.name] || 'N/A';
        stats[col.name][v] = (stats[col.name][v] || 0) + 1;
      }
    }
    return { ...group, stats };
  });
}

export function distribute(
  people: PersonRow[],
  config: DistributionConfig,
  columns: ColumnMeta[]
): Group[] {
  let groups: Group[];

  switch (config.mode) {
    case 'random':
      groups = distributeRandom(people, config);
      break;
    case 'schedule':
      groups = distributeSchedule(people, config);
      break;
    case 'balanced':
    case 'custom':
    default:
      groups = distributeCustom(people, config);
      break;
  }

  return computeStats(groups, columns);
}
