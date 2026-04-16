'use client';

import { useDroppable } from '@dnd-kit/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import PersonChip from './person-chip';
import type { Group, ColumnMeta } from '@/types';

interface GroupCardProps {
  group: Group;
  columns: ColumnMeta[];
}

export default function GroupCard({ group, columns }: GroupCardProps) {
  const { setNodeRef, isOver } = useDroppable({ id: group.id });

  // Sort members by 학번 asc, then 이름
  const hakbunCol = columns.find((c) =>
    c.name.includes('학번') || c.name.includes('학생번호') || c.name.toLowerCase().includes('student')
  );
  const nameCol = columns.find((c) =>
    c.name.includes('이름') || c.name.includes('성명') || c.name.toLowerCase() === 'name'
  );
  const sortedMembers = [...group.members].sort((a, b) => {
    if (hakbunCol) {
      const ha = Number(a[hakbunCol.name] || '0');
      const hb = Number(b[hakbunCol.name] || '0');
      if (ha !== hb) return ha - hb;
    }
    if (nameCol) {
      return (a[nameCol.name] || '').localeCompare(b[nameCol.name] || '', 'ko');
    }
    return 0;
  });

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
