'use client';

import { useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import PersonChip from './person-chip';
import type { Group, ColumnMeta, PersonRow, GroupLeader } from '@/types';

interface GroupCardProps {
  group: Group;
  columns: ColumnMeta[];
  allColumns: ColumnMeta[];
  groupLeaders?: GroupLeader[];
}

function findNumericSortCol(allColumns: ColumnMeta[], members: PersonRow[]): string | null {
  // 1. Try known names
  const known = allColumns.find((c) =>
    c.name.includes('학번') || c.name.includes('학생번호') || c.name.toLowerCase().includes('student')
  );
  if (known) return known.name;

  // 2. Fallback: find first column where most values are 2-digit numbers (학번 pattern)
  for (const col of allColumns) {
    if (col.type === 'number' || col.type === 'category') {
      const sample = members.slice(0, 10).map((m) => m[col.name]);
      const allShortNumbers = sample.every((v) => /^\d{1,4}$/.test(v?.trim() || ''));
      if (allShortNumbers && sample.length > 0) return col.name;
    }
  }
  return null;
}

export default function GroupCard({ group, columns, allColumns, groupLeaders }: GroupCardProps) {
  const { setNodeRef, isOver } = useDroppable({ id: group.id });

  const leaderInfo = groupLeaders?.find((l) => l.groupName === group.name);
  const nameCol = allColumns.find((c) =>
    c.name.includes('이름') || c.name.includes('성명') || c.name.toLowerCase() === 'name'
  );

  function getLeaderRole(person: PersonRow): string | null {
    if (!leaderInfo || !nameCol) return null;
    const name = person[nameCol.name]?.trim();
    if (!name) return null;
    if (leaderInfo.leader?.trim() === name) return '조장';
    if (leaderInfo.subLeader?.trim() === name) return '부조장';
    return null;
  }

  const sortedMembers = useMemo(() => {
    const numCol = findNumericSortCol(allColumns, group.members);
    const nCol = allColumns.find((c) =>
      c.name.includes('이름') || c.name.includes('성명') || c.name.toLowerCase() === 'name'
    );

    return [...group.members].sort((a, b) => {
      // Leaders always first: 조장 > 부조장 > others
      const roleA = getLeaderRole(a);
      const roleB = getLeaderRole(b);
      const orderA = roleA === '조장' ? 0 : roleA === '부조장' ? 1 : 2;
      const orderB = roleB === '조장' ? 0 : roleB === '부조장' ? 1 : 2;
      if (orderA !== orderB) return orderA - orderB;

      if (numCol) {
        const ha = Number(a[numCol] || '0');
        const hb = Number(b[numCol] || '0');
        if (ha !== hb) return ha - hb;
      }
      if (nCol) {
        return (a[nCol.name] || '').localeCompare(b[nCol.name] || '', 'ko');
      }
      return 0;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.members, allColumns, leaderInfo]);

  // Show top stats for category columns
  const categoryColumns = columns.filter((c) => c.type === 'category').slice(0, 3);

  return (
    <Card
      ref={setNodeRef}
      className={`transition-colors ${isOver ? 'ring-2 ring-primary' : ''}`}
    >
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span>{group.name}</span>
          <Badge variant="secondary">{group.members.length}명</Badge>
        </CardTitle>
        {categoryColumns.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {categoryColumns.map((col) => {
              const stat = group.stats[col.name];
              if (!stat) return null;
              return Object.entries(stat).map(([val, count]) => (
                <Badge
                  key={`${col.name}-${val}`}
                  variant="outline"
                  className="text-xs"
                >
                  {col.name}:{val}({count})
                </Badge>
              ));
            })}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-1.5">
          {sortedMembers.map((person) => {
            const role = getLeaderRole(person);
            return (
              <PersonChip key={person.id} person={person} columns={columns} role={role} />
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
