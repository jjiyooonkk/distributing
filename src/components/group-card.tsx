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
          {group.members.map((person) => (
            <PersonChip key={person.id} person={person} columns={columns} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
