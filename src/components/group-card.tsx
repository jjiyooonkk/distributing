'use client';

import { useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import PersonChip from './person-chip';
import type { Group, ColumnMeta, PersonRow } from '@/types';

interface GroupCardProps {
  group: Group;
  columns: ColumnMeta[];
  allColumns: ColumnMeta[];
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

export default function GroupCard({ group, columns, allColumns }: GroupCardProps) {
  const { setNodeRef, isOver } = useDroppable({ id: group.id });

  const sortedMembers = useMemo(() => {
    const numCol = findNumericSortCol(allColumns, group.members);
    const nameCol = allColumns.find((c) =>
      c.name.includes('이름') || c.name.includes('성명') || c.name.toLowerCase() === 'name'
    );

    return [...group.members].sort((a, b) => {
      if (numCol) {
        const ha = Number(a[numCol] || '0');
        const hb = Number(b[numCol] || '0');
        if (ha !== hb) return ha - hb;
      }
      if (nameCol) {
        return (a[nameCol.name] || '').localeCompare(b[nameCol.name] || '', 'ko');
      }
      return 0;
    });
  }, [group.members, allColumns]);

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
          {sortedMembers.map((person) => (
            <PersonChip key={person.id} person={person} columns={columns} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
