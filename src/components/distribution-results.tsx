'use client';

import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import GroupCard from './group-card';
import PersonChip from './person-chip';
import ResultsTable from './results-table';
import type { DistributionResult, PersonRow, ColumnMeta } from '@/types';

interface ResultsProps {
  results: DistributionResult;
  columns: ColumnMeta[];
  onUpdate: (results: DistributionResult) => void;
  onNotify: () => void;
}

type ViewMode = 'card' | 'table';

export default function DistributionResults({
  results,
  columns,
  onUpdate,
  onNotify,
}: ResultsProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
    const defaults = new Set<string>();
    for (const col of columns) {
      if (['이름', 'name', 'Name', '성명', '학번', '학과', '성별'].includes(col.name)) {
        defaults.add(col.name);
      }
    }
    if (defaults.size === 0) {
      columns.slice(0, 3).forEach((c) => defaults.add(c.name));
    }
    return defaults;
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const filteredColumns = columns.filter((c) => visibleColumns.has(c.name));

  const activePerson = activeId
    ? results.groups.flatMap((g) => g.members).find((m) => m.id === activeId)
    : null;

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);
      const { active, over } = event;
      if (!over) return;
      movePerson(active.id as string, undefined, over.id as string);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [results, columns]
  );

  const movePerson = useCallback(
    (personId: string, fromGroupId: string | undefined, toGroupId: string) => {
      const sourceGroup = fromGroupId
        ? results.groups.find((g) => g.id === fromGroupId)
        : results.groups.find((g) => g.members.some((m) => m.id === personId));
      const targetGroup = results.groups.find((g) => g.id === toGroupId);

      if (!sourceGroup || !targetGroup || sourceGroup.id === targetGroup.id) return;

      const person = sourceGroup.members.find((m) => m.id === personId)!;

      const newGroups = results.groups.map((g) => {
        if (g.id === sourceGroup.id) {
          const members = g.members.filter((m) => m.id !== personId);
          return { ...g, members, stats: recomputeStats(members, columns) };
        }
        if (g.id === targetGroup.id) {
          const members = [...g.members, person];
          return { ...g, members, stats: recomputeStats(members, columns) };
        }
        return g;
      });

      onUpdate({ ...results, groups: newGroups, timestamp: new Date().toISOString() });
    },
    [results, columns, onUpdate]
  );

  function toggleColumn(colName: string) {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(colName)) {
        if (next.size > 1) next.delete(colName);
      } else {
        next.add(colName);
      }
      return next;
    });
  }

  function exportToExcel() {
    const rows: Record<string, string>[] = [];
    for (const group of results.groups) {
      for (const member of group.members) {
        const row: Record<string, string> = { '배정 그룹': group.name };
        for (const col of filteredColumns) {
          row[col.name] = member[col.name] || '';
        }
        rows.push(row);
      }
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '배정결과');
    XLSX.writeFile(wb, `배정결과_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  const totalPeople = results.groups.reduce((s, g) => s + g.members.length, 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm text-muted-foreground">
          {results.groups.length}개 그룹 | 총 {totalPeople}명 |{' '}
          {new Date(results.timestamp).toLocaleString('ko-KR')}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportToExcel}>
            스프레드시트 다운로드
          </Button>
          <Button variant="outline" size="sm" onClick={onNotify}>
            결과 발송
          </Button>
        </div>
      </div>

      {/* Column filter + View toggle */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1.5 flex-1">
          <p className="text-xs text-muted-foreground">표시할 칼럼:</p>
          <div className="flex flex-wrap gap-1.5">
            {columns.map((col) => (
              <Badge
                key={col.name}
                variant={visibleColumns.has(col.name) ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => toggleColumn(col.name)}
              >
                {col.name}
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex border rounded-lg overflow-hidden">
          <button
            onClick={() => setViewMode('table')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              viewMode === 'table' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
            }`}
          >
            표
          </button>
          <button
            onClick={() => setViewMode('card')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              viewMode === 'card' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
            }`}
          >
            카드
          </button>
        </div>
      </div>

      {/* Table View */}
      {viewMode === 'table' && (
        <ResultsTable
          results={results}
          columns={columns}
          visibleColumns={visibleColumns}
          onMove={movePerson}
        />
      )}

      {/* Card View */}
      {viewMode === 'card' && (
        <>
          <p className="text-xs text-muted-foreground">
            사람을 드래그해서 다른 그룹으로 이동할 수 있습니다.
          </p>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {results.groups.map((group) => (
                <GroupCard key={group.id} group={group} columns={filteredColumns} />
              ))}
            </div>
            <DragOverlay>
              {activePerson ? (
                <PersonChip person={activePerson} columns={filteredColumns} overlay />
              ) : null}
            </DragOverlay>
          </DndContext>
        </>
      )}
    </div>
  );
}

function recomputeStats(
  members: PersonRow[],
  columns: ColumnMeta[]
): Record<string, Record<string, number>> {
  const stats: Record<string, Record<string, number>> = {};
  for (const col of columns) {
    stats[col.name] = {};
    for (const m of members) {
      const v = m[col.name] || 'N/A';
      stats[col.name][v] = (stats[col.name][v] || 0) + 1;
    }
  }
  return stats;
}
