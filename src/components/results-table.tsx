'use client';

import { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import type { DistributionResult, ColumnMeta, PersonRow } from '@/types';

interface ResultsTableProps {
  results: DistributionResult;
  columns: ColumnMeta[];
  visibleColumns: Set<string>;
  onMove: (personId: string, fromGroupId: string, toGroupId: string) => void;
}

export default function ResultsTable({
  results,
  columns,
  visibleColumns,
  onMove,
}: ResultsTableProps) {
  const hakbunCol = columns.find((c) =>
    c.name.includes('학번') || c.name.includes('학생번호') || c.name.toLowerCase().includes('student')
  );
  const nameCol = columns.find((c) =>
    c.name.includes('이름') || c.name.includes('성명') || c.name.toLowerCase() === 'name'
  );
  const [sortCol, setSortCol] = useState<string>(hakbunCol ? hakbunCol.name : '__group__');
  const [sortAsc, setSortAsc] = useState(true);
  const [filter, setFilter] = useState('');

  // Show selected columns, but put 학번 and 이름 first
  const shownCols = (() => {
    const selected = columns.filter((c) => visibleColumns.has(c.name));
    const priority: typeof selected = [];
    const rest: typeof selected = [];
    for (const col of selected) {
      if (hakbunCol && col.name === hakbunCol.name) priority.unshift(col);
      else if (nameCol && col.name === nameCol.name) priority.push(col);
      else rest.push(col);
    }
    return [...priority, ...rest];
  })();
  const groupNames = results.groups.map((g) => g.name);

  // Flatten groups into rows with group info
  const allRows = useMemo(() => {
    const rows: { person: PersonRow; groupId: string; groupName: string }[] = [];
    for (const group of results.groups) {
      for (const person of group.members) {
        rows.push({ person, groupId: group.id, groupName: group.name });
      }
    }
    return rows;
  }, [results]);

  // Filter
  const filtered = useMemo(() => {
    if (!filter.trim()) return allRows;
    const q = filter.toLowerCase();
    return allRows.filter((row) => {
      if (row.groupName.toLowerCase().includes(q)) return true;
      return shownCols.some((col) =>
        (row.person[col.name] || '').toLowerCase().includes(q)
      );
    });
  }, [allRows, filter, shownCols]);

  // Sort
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      // Primary sort by selected column
      let va: string, vb: string;
      if (sortCol === '__group__') {
        va = a.groupName;
        vb = b.groupName;
      } else {
        va = a.person[sortCol] || '';
        vb = b.person[sortCol] || '';
      }
      const na = Number(va);
      const nb = Number(vb);
      const cmp = (!isNaN(na) && !isNaN(nb)) ? na - nb : va.localeCompare(vb, 'ko');
      const primary = sortAsc ? cmp : -cmp;
      if (primary !== 0) return primary;

      // Secondary sort: 학번 오름차순 → 이름 오름차순
      if (hakbunCol && sortCol !== hakbunCol.name) {
        const ha = Number(a.person[hakbunCol.name] || '0');
        const hb = Number(b.person[hakbunCol.name] || '0');
        if (ha !== hb) return ha - hb;
      }
      if (nameCol && sortCol !== nameCol.name) {
        return (a.person[nameCol.name] || '').localeCompare(b.person[nameCol.name] || '', 'ko');
      }
      return 0;
    });
  }, [filtered, sortCol, sortAsc, hakbunCol, nameCol]);

  function handleSort(col: string) {
    if (sortCol === col) {
      setSortAsc(!sortAsc);
    } else {
      setSortCol(col);
      setSortAsc(true);
    }
  }

  function handleGroupChange(personId: string, currentGroupId: string, newGroupName: string) {
    const newGroup = results.groups.find((g) => g.name === newGroupName);
    if (!newGroup || newGroup.id === currentGroupId) return;
    onMove(personId, currentGroupId, newGroup.id);
  }

  const sortIndicator = (col: string) => {
    if (sortCol !== col) return '';
    return sortAsc ? ' ↑' : ' ↓';
  };

  function getGenderColor(person: PersonRow): string {
    for (const col of columns) {
      if (['성별', 'gender', 'Gender', '성'].includes(col.name)) {
        const val = (person[col.name] || '').trim();
        if (['여', '여자', 'F', 'f', 'Female', 'female'].includes(val)) return 'bg-pink-50';
        if (['남', '남자', 'M', 'm', 'Male', 'male'].includes(val)) return 'bg-sky-50';
      }
    }
    return '';
  }

  const sortOptions = [
    { value: '__group__', label: '배정 그룹' },
    ...shownCols.map((c) => ({ value: c.name, label: c.name })),
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Input
          placeholder="검색..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-[200px] h-8"
        />
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>정렬:</span>
          <Select value={sortCol} onValueChange={(v) => v && setSortCol(v)}>
            <SelectTrigger className="h-7 w-auto min-w-[80px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            onClick={() => setSortAsc(!sortAsc)}
            className="px-2 py-1 rounded border text-xs hover:bg-muted"
          >
            {sortAsc ? '↑ 오름차순' : '↓ 내림차순'}
          </button>
        </div>
      </div>

      <div className="border rounded-lg overflow-auto max-h-[600px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted min-w-[100px]"
                onClick={() => handleSort('__group__')}
              >
                배정 그룹{sortIndicator('__group__')}
              </TableHead>
              {shownCols.map((col) => (
                <TableHead
                  key={col.name}
                  className="cursor-pointer hover:bg-muted"
                  onClick={() => handleSort(col.name)}
                >
                  {col.name}{sortIndicator(col.name)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((row, i) => (
              <TableRow key={row.person.id} className={getGenderColor(row.person)}>
                <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                <TableCell className="p-1">
                  <Select
                    value={row.groupName}
                    onValueChange={(v) =>
                      v && handleGroupChange(row.person.id, row.groupId, v)
                    }
                  >
                    <SelectTrigger className="h-7 text-xs w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {groupNames.map((name) => (
                        <SelectItem key={name} value={name}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                {shownCols.map((col) => (
                  <TableCell key={col.name} className="text-sm">
                    {row.person[col.name] || ''}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        총 {sorted.length}명 표시 | 그룹 드롭다운을 변경하면 즉시 재배정됩니다
      </p>
    </div>
  );
}
