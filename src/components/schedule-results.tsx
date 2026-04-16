'use client';

import { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import type { ScheduleResult, PersonRow, ColumnMeta } from '@/types';
import { parseDateStr, formatDateLabel } from '@/lib/date-parse';

interface ScheduleResultsProps {
  results: ScheduleResult;
  data: PersonRow[];
  columns: ColumnMeta[];
  onUpdate: (results: ScheduleResult) => void;
  onNotify: () => void;
}

type ViewMode = 'date' | 'person' | 'room';

export default function ScheduleResults({
  results,
  data,
  columns,
  onUpdate,
  onNotify,
}: ScheduleResultsProps) {
  const [view, setView] = useState<ViewMode>('date');
  const [filter, setFilter] = useState('');
  const [selectedDate, setSelectedDate] = useState(results.dates[0] || '');

  const nameCol = columns.find((c) =>
    c.name.includes('이름') || c.name.includes('성명') || c.name.toLowerCase() === 'name'
  );

  const personMap = useMemo(() => {
    const m = new Map<string, PersonRow>();
    for (const p of data) m.set(p.id, p);
    return m;
  }, [data]);

  function getPersonName(id: string): string {
    const p = personMap.get(id);
    if (!p) return id.slice(0, 4);
    return nameCol ? p[nameCol.name] || id.slice(0, 4) : id.slice(0, 4);
  }

  function getGenderColor(id: string): string {
    const p = personMap.get(id);
    if (!p) return '';
    for (const col of columns) {
      if (['성별', 'gender', 'Gender'].includes(col.name)) {
        const val = (p[col.name] || '').trim();
        if (['여', '여자', 'F', 'female'].includes(val)) return 'bg-pink-50';
        if (['남', '남자', 'M', 'male'].includes(val)) return 'bg-sky-50';
      }
    }
    return '';
  }

  // Build per-person schedule: personId → { date → roomName }
  const personSchedule = useMemo(() => {
    const m = new Map<string, Map<string, string>>();
    for (const a of results.assignments) {
      if (!m.has(a.personId)) m.set(a.personId, new Map());
      m.get(a.personId)!.set(a.date, a.roomName);
    }
    return m;
  }, [results]);

  // Build per-date per-room: date → roomName → personIds
  const dateRoomMap = useMemo(() => {
    const m = new Map<string, Map<string, string[]>>();
    for (const date of results.dates) m.set(date, new Map());
    for (const a of results.assignments) {
      const dateMap = m.get(a.date)!;
      if (!dateMap.has(a.roomName)) dateMap.set(a.roomName, []);
      dateMap.get(a.roomName)!.push(a.personId);
    }
    return m;
  }, [results]);

  function handleRoomChange(personId: string, date: string, newRoom: string) {
    const updated = results.assignments.map((a) =>
      a.personId === personId && a.date === date ? { ...a, roomName: newRoom } : a
    );
    onUpdate({ ...results, assignments: updated, timestamp: new Date().toISOString() });
  }

  // Filtered people
  const filteredPeople = useMemo(() => {
    const ids = [...personSchedule.keys()];
    if (!filter.trim()) return ids;
    const q = filter.toLowerCase();
    return ids.filter((id) => {
      const p = personMap.get(id);
      if (!p) return false;
      return Object.values(p).some((v) => v?.toLowerCase().includes(q));
    });
  }, [personSchedule, filter, personMap]);

  function exportToExcel() {
    const rows: Record<string, string>[] = [];
    for (const personId of filteredPeople) {
      const p = personMap.get(personId);
      if (!p) continue;
      const row: Record<string, string> = {};
      if (nameCol) row['이름'] = p[nameCol.name] || '';
      for (const date of results.dates) {
        const d = parseDateStr(date);
        row[formatDateLabel(d)] = personSchedule.get(personId)?.get(date) || '-';
      }
      rows.push(row);
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '숙소배정');
    XLSX.writeFile(wb, `숙소배정_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  async function exportToGoogleSheets() {
    const headers = ['이름', ...results.dates.map((d) => formatDateLabel(parseDateStr(d)))];
    const rows = filteredPeople.map((id) => {
      const p = personMap.get(id);
      const name = p && nameCol ? p[nameCol.name] || '' : '';
      const rooms = results.dates.map((d) => personSchedule.get(id)?.get(d) || '-');
      return [name, ...rooms];
    });
    const html = `<table><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</table>`;
    const tsv = [headers.join('\t'), ...rows.map((r) => r.join('\t'))].join('\n');
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([tsv], { type: 'text/plain' }),
        }),
      ]);
    } catch {
      await navigator.clipboard.writeText(tsv).catch(() => {});
    }
    toast.success('데이터 복사 완료! 새 시트에서 Ctrl+V로 붙여넣기하세요.', { duration: 8000 });
    setTimeout(() => window.open('https://sheets.new', '_blank'), 500);
  }

  const totalPeople = personSchedule.size;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm text-muted-foreground">
          {results.rooms.length}개 방 | {results.dates.length}박 | 총 {totalPeople}명
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportToGoogleSheets}>
            구글 시트
          </Button>
          <Button variant="outline" size="sm" onClick={exportToExcel}>
            엑셀
          </Button>
          <Button variant="outline" size="sm" onClick={onNotify}>
            발송
          </Button>
        </div>
      </div>

      {/* View toggle + filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex border rounded-lg overflow-hidden">
          {([['date', '날짜별'], ['person', '개인별'], ['room', '방별']] as [ViewMode, string][]).map(
            ([key, label]) => (
              <button
                key={key}
                onClick={() => setView(key)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  view === key ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                }`}
              >
                {label}
              </button>
            )
          )}
        </div>
        <Input
          placeholder="검색..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-[200px] h-8"
        />
        {view === 'date' && (
          <Select value={selectedDate} onValueChange={(v) => v && setSelectedDate(v)}>
            <SelectTrigger className="h-8 w-auto text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {results.dates.map((d) => (
                <SelectItem key={d} value={d}>
                  {formatDateLabel(parseDateStr(d))}밤
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Date View: show rooms for selected date */}
      {view === 'date' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {results.rooms.map((room) => {
            const people = dateRoomMap.get(selectedDate)?.get(room) || [];
            return (
              <Card key={room}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span>{room}</span>
                    <Badge variant="secondary">{people.length}명</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1.5">
                    {people.map((id) => (
                      <span
                        key={id}
                        className={`inline-flex px-2.5 py-1 rounded-md text-sm border ${getGenderColor(id)}`}
                      >
                        {getPersonName(id)}
                      </span>
                    ))}
                    {people.length === 0 && (
                      <span className="text-xs text-muted-foreground">비어있음</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Person View: each person's full schedule */}
      {view === 'person' && (
        <div className="border rounded-lg overflow-auto max-h-[600px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>이름</TableHead>
                {results.dates.map((d) => (
                  <TableHead key={d} className="text-center text-xs">
                    {formatDateLabel(parseDateStr(d))}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPeople.map((id) => (
                <TableRow key={id} className={getGenderColor(id)}>
                  <TableCell className="font-medium text-sm">{getPersonName(id)}</TableCell>
                  {results.dates.map((date) => {
                    const room = personSchedule.get(id)?.get(date);
                    return (
                      <TableCell key={date} className="p-1 text-center">
                        {room ? (
                          <Select
                            value={room}
                            onValueChange={(v) => v && handleRoomChange(id, date, v)}
                          >
                            <SelectTrigger className="h-6 text-xs w-full min-w-[60px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {results.rooms.map((r) => (
                                <SelectItem key={r} value={r}>{r}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Room View: room occupancy across all dates */}
      {view === 'room' && (
        <div className="border rounded-lg overflow-auto max-h-[600px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>방</TableHead>
                {results.dates.map((d) => (
                  <TableHead key={d} className="text-center text-xs">
                    {formatDateLabel(parseDateStr(d))}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.rooms.map((room) => (
                <TableRow key={room}>
                  <TableCell className="font-medium text-sm">{room}</TableCell>
                  {results.dates.map((date) => {
                    const people = dateRoomMap.get(date)?.get(room) || [];
                    return (
                      <TableCell key={date} className="text-xs p-1">
                        <div className="space-y-0.5">
                          {people.map((id) => (
                            <div key={id} className={`px-1 rounded ${getGenderColor(id)}`}>
                              {getPersonName(id)}
                            </div>
                          ))}
                          {people.length === 0 && (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </div>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
