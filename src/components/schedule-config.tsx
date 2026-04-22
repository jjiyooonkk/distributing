'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ColumnMeta, ScheduleConfig, RoomDef, ColumnRule, PersonRow } from '@/types';
import { parseKoreanDateTime, computeStayNights, formatDateLabel, parseDateStr } from '@/lib/date-parse';

interface ScheduleConfigProps {
  columns: ColumnMeta[];
  data: PersonRow[];
  onSubmit: (config: ScheduleConfig) => void;
  loading?: boolean;
}

export default function ScheduleConfigComponent({
  columns,
  data,
  onSubmit,
  loading,
}: ScheduleConfigProps) {
  const [arrivalCol, setArrivalCol] = useState('');
  const [departureCol, setDepartureCol] = useState('');
  const [rooms, setRooms] = useState<RoomDef[]>([
    { name: '1호실', capacity: 6 },
    { name: '2호실', capacity: 6 },
  ]);
  const [rules, setRules] = useState<ColumnRule[]>([]);

  // Preview parsed dates
  const preview = useMemo(() => {
    if (!arrivalCol || !departureCol) return null;

    const allNights = new Set<string>();
    let parsed = 0;
    let failed = 0;
    const samplePeople: { name: string; nights: string[] }[] = [];

    for (const person of data) {
      const arr = parseKoreanDateTime(person[arrivalCol] || '');
      const dep = parseKoreanDateTime(person[departureCol] || '');
      if (arr && dep) {
        parsed++;
        const nights = computeStayNights(arr, dep);
        nights.forEach((n) => allNights.add(n));
        if (samplePeople.length < 3) {
          const nameCol = columns.find((c) =>
            c.name.includes('이름') || c.name.includes('성명')
          );
          samplePeople.push({
            name: nameCol ? person[nameCol.name] || '?' : person.id.slice(0, 4),
            nights,
          });
        }
      } else {
        failed++;
      }
    }

    const sortedNights = [...allNights].sort((a, b) => {
      const da = parseDateStr(a);
      const db = parseDateStr(b);
      return da.getTime() - db.getTime();
    });

    return { parsed, failed, nights: sortedNights, samplePeople };
  }, [arrivalCol, departureCol, data, columns]);

  function addRoom() {
    setRooms([...rooms, { name: `${rooms.length + 1}호실`, capacity: 6 }]);
  }

  function updateRoom(idx: number, field: keyof RoomDef, value: string | number) {
    setRooms(rooms.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  }

  function removeRoom(idx: number) {
    if (rooms.length <= 1) return;
    setRooms(rooms.filter((_, i) => i !== idx));
  }

  function handleSubmit() {
    onSubmit({
      arrivalColumn: arrivalCol,
      departureColumn: departureCol,
      rooms,
      rules,
    });
  }

  return (
    <div className="space-y-6">
      {/* Date Column Selection */}
      <Card>
        <CardHeader>
          <CardTitle>날짜 칼럼 선택</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>도착 시간 칼럼</Label>
              <Select value={arrivalCol} onValueChange={(v) => v && setArrivalCol(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="선택..." />
                </SelectTrigger>
                <SelectContent>
                  {columns.map((col) => (
                    <SelectItem key={col.name} value={col.name}>
                      {col.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>출발 시간 칼럼</Label>
              <Select value={departureCol} onValueChange={(v) => v && setDepartureCol(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="선택..." />
                </SelectTrigger>
                <SelectContent>
                  {columns.map((col) => (
                    <SelectItem key={col.name} value={col.name}>
                      {col.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Date Preview */}
          {preview && (
            <div className="p-3 bg-muted rounded-lg space-y-2 text-sm">
              <div className="flex gap-3">
                <span>파싱 성공: <strong>{preview.parsed}명</strong></span>
                {preview.failed > 0 && (
                  <span className="text-destructive">실패: {preview.failed}명</span>
                )}
              </div>
              {preview.nights.length > 0 && (
                <>
                  <div>
                    전체 기간: <strong>{preview.nights[0]} ~ {preview.nights[preview.nights.length - 1]}</strong>
                    {' '}({preview.nights.length}박)
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {preview.nights.map((n) => {
                      const d = parseDateStr(n);
                      return (
                        <Badge key={n} variant="secondary" className="text-xs">
                          {formatDateLabel(d)}
                        </Badge>
                      );
                    })}
                  </div>
                  {preview.samplePeople.length > 0 && (
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <div className="font-medium">미리보기:</div>
                      {preview.samplePeople.map((p, i) => (
                        <div key={i}>{p.name}: {p.nights.join(', ')}박</div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Room Setup */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>방/팀 설정</span>
            <Button variant="outline" size="sm" onClick={addRoom}>
              + 추가
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {rooms.map((room, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={room.name}
                onChange={(e) => updateRoom(i, 'name', e.target.value)}
                className="flex-1 h-8"
                placeholder="방 이름"
              />
              <Select
                value={room.gender || '__mixed__'}
                onValueChange={(v) => v && updateRoom(i, 'gender', v === '__mixed__' ? '' : v)}
              >
                <SelectTrigger className="w-20 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__mixed__">혼성</SelectItem>
                  <SelectItem value="남">남</SelectItem>
                  <SelectItem value="여">여</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="number"
                min={1}
                value={room.capacity}
                onChange={(e) => updateRoom(i, 'capacity', Number(e.target.value))}
                className="w-16 h-8"
              />
              <span className="text-xs text-muted-foreground">명</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeRoom(i)}
                className="h-8 px-2 text-muted-foreground"
                disabled={rooms.length <= 1}
              >
                X
              </Button>
            </div>
          ))}
          <div className="text-xs text-muted-foreground">
            총 수용: {rooms.reduce((s, r) => s + r.capacity, 0)}명/밤
          </div>
        </CardContent>
      </Card>

      {/* Rules (reuse spread/pin/exclude) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>추가 규칙 (선택)</span>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" onClick={() => {
                const col = columns[0]?.name || '';
                setRules([...rules, { type: 'pin', columnName: col, value: '', targetGroup: rooms[0]?.name || '' }]);
              }}>
                + 고정
              </Button>
              <Button variant="outline" size="sm" onClick={() => {
                const col = columns[0]?.name || '';
                setRules([...rules, { type: 'spread', columnName: col, weight: 5 }]);
              }}>
                + 분산
              </Button>
              <Button variant="outline" size="sm" onClick={() => {
                const col = columns[0]?.name || '';
                setRules([...rules, { type: 'exclude', columnName: col, value: '', excludeGroup: rooms[0]?.name || '' }]);
              }}>
                + 제외
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {rules.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-2">
              성별 분산, 특정 방 제외 등 규칙을 추가할 수 있습니다
            </p>
          )}
          {rules.map((rule, i) => (
            <div key={i} className="flex items-center gap-2 p-2 border rounded-lg text-sm">
              <Badge variant="secondary" className="text-xs">
                {rule.type === 'spread' ? '분산' : rule.type === 'pin' ? '고정' : '제외'}
              </Badge>
              <Select
                value={rule.columnName}
                onValueChange={(v) => {
                  if (!v) return;
                  const updated = [...rules];
                  updated[i] = { ...updated[i], columnName: v } as ColumnRule;
                  setRules(updated);
                }}
              >
                <SelectTrigger className="h-7 w-28 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {columns.map((col) => (
                    <SelectItem key={col.name} value={col.name}>{col.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {rule.type === 'spread' && (
                <>
                  <Label className="text-xs">강도</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={(rule as { weight: number }).weight}
                    onChange={(e) => {
                      const updated = [...rules];
                      updated[i] = { ...updated[i], weight: Number(e.target.value) } as ColumnRule;
                      setRules(updated);
                    }}
                    className="w-14 h-7 text-xs"
                  />
                </>
              )}
              {rule.type === 'pin' && (
                <>
                  <Select
                    value={(rule as { value: string }).value || ''}
                    onValueChange={(v) => {
                      if (!v) return;
                      const updated = [...rules];
                      updated[i] = { ...updated[i], value: v } as ColumnRule;
                      setRules(updated);
                    }}
                  >
                    <SelectTrigger className="h-7 w-24 text-xs">
                      <SelectValue placeholder="값" />
                    </SelectTrigger>
                    <SelectContent>
                      {columns
                        .find((c) => c.name === rule.columnName)
                        ?.uniqueValues.map((val) => (
                          <SelectItem key={val} value={val}>{val}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <span className="text-xs text-muted-foreground">→</span>
                  <Select
                    value={(rule as { targetGroup: string }).targetGroup || ''}
                    onValueChange={(v) => {
                      if (!v) return;
                      const updated = [...rules];
                      updated[i] = { ...updated[i], targetGroup: v } as ColumnRule;
                      setRules(updated);
                    }}
                  >
                    <SelectTrigger className="h-7 w-24 text-xs">
                      <SelectValue placeholder="방" />
                    </SelectTrigger>
                    <SelectContent>
                      {rooms.map((r) => (
                        <SelectItem key={r.name} value={r.name}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              )}
              {rule.type === 'exclude' && (
                <>
                  <Select
                    value={(rule as { value: string }).value || ''}
                    onValueChange={(v) => {
                      if (!v) return;
                      const updated = [...rules];
                      updated[i] = { ...updated[i], value: v } as ColumnRule;
                      setRules(updated);
                    }}
                  >
                    <SelectTrigger className="h-7 w-24 text-xs">
                      <SelectValue placeholder="값" />
                    </SelectTrigger>
                    <SelectContent>
                      {columns
                        .find((c) => c.name === rule.columnName)
                        ?.uniqueValues.map((val) => (
                          <SelectItem key={val} value={val}>{val}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <span className="text-xs text-muted-foreground">제외:</span>
                  <Select
                    value={(rule as { excludeGroup: string }).excludeGroup || ''}
                    onValueChange={(v) => {
                      if (!v) return;
                      const updated = [...rules];
                      updated[i] = { ...updated[i], excludeGroup: v } as ColumnRule;
                      setRules(updated);
                    }}
                  >
                    <SelectTrigger className="h-7 w-24 text-xs">
                      <SelectValue placeholder="방" />
                    </SelectTrigger>
                    <SelectContent>
                      {rooms.map((r) => (
                        <SelectItem key={r.name} value={r.name}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRules(rules.filter((_, j) => j !== i))}
                className="h-7 px-2 ml-auto"
              >
                X
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Button
        className="w-full"
        size="lg"
        onClick={handleSubmit}
        disabled={loading || !arrivalCol || !departureCol || rooms.length === 0}
      >
        {loading ? '배정 중...' : '숙소 배정 실행'}
      </Button>
    </div>
  );
}
