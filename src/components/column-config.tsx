'use client';

import { useState } from 'react';
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
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import type {
  ColumnMeta,
  DistributionConfig,
  ColumnRule,
  PinRule,
  SpreadRule,
  ClusterRule,
  EnsureRule,
  ExcludeRule,
  RatioRule,
  GroupCapacity,
  GroupLeader,
} from '@/types';

interface ColumnConfigProps {
  columns: ColumnMeta[];
  onSubmit: (config: DistributionConfig) => void;
  loading?: boolean;
  initialConfig?: DistributionConfig | null;
}

type Mode = DistributionConfig['mode'];

const modeLabels: Record<Mode, { title: string; desc: string }> = {
  random: { title: '랜덤', desc: '완전 랜덤 배정' },
  balanced: {
    title: '균등 분배',
    desc: '칼럼 기반 고르게 분배',
  },
  schedule: {
    title: '스케줄 기반',
    desc: '일정 칼럼 기반 숙소 배정',
  },
  custom: {
    title: '커스텀 규칙',
    desc: '고정/분산/모음 규칙 직접 설정',
  },
};

/** Parse group names supporting both comma-separated and range syntax.
 *  e.g. "1조~10조" → ["1조","2조",...,"10조"]
 *       "A팀~D팀"  → ["A팀","B팀","C팀","D팀"]
 *       "1조, 2조, 3조" → ["1조","2조","3조"]
 *  Ranges work when prefix/suffix match and the varying part is numeric or single letter. */
function parseGroupNames(input: string): string[] {
  const trimmed = input.trim();
  if (!trimmed) return [];

  // Check for range pattern: "X~Y" (with optional spaces around ~)
  const rangeMatch = trimmed.match(/^(.+?)\s*~\s*(.+)$/);
  if (rangeMatch) {
    const [, startStr, endStr] = rangeMatch;
    const expanded = expandRange(startStr, endStr);
    if (expanded) return expanded;
  }

  // Fallback: comma-separated
  return trimmed.split(',').map((s) => s.trim()).filter(Boolean);
}

function expandRange(start: string, end: string): string[] | null {
  // Step 1: Find common suffix from the end
  // e.g. "1조" and "10조" → suffix="조", cores="1" and "10"
  // e.g. "A팀" and "D팀" → suffix="팀", cores="A" and "D"
  let suffixLen = 0;
  const minLen = Math.min(start.length, end.length);
  while (
    suffixLen < minLen &&
    start[start.length - 1 - suffixLen] === end[end.length - 1 - suffixLen]
  ) suffixLen++;

  const suffix = suffixLen > 0 ? start.slice(start.length - suffixLen) : '';
  const fromCore = suffixLen > 0 ? start.slice(0, start.length - suffixLen) : start;
  const toCore = suffixLen > 0 ? end.slice(0, end.length - suffixLen) : end;

  // Step 2: Check if cores are purely numeric
  if (/^\d+$/.test(fromCore) && /^\d+$/.test(toCore)) {
    const from = parseInt(fromCore, 10);
    const to = parseInt(toCore, 10);
    if (from > to || to - from > 100) return null;
    return Array.from({ length: to - from + 1 }, (_, i) => `${from + i}${suffix}`);
  }

  // Step 3: Check if cores are single letters (A~D, a~d)
  if (/^[A-Za-z]$/.test(fromCore) && /^[A-Za-z]$/.test(toCore)) {
    const from = fromCore.charCodeAt(0);
    const to = toCore.charCodeAt(0);
    if (from > to || to - from > 26) return null;
    return Array.from({ length: to - from + 1 }, (_, i) =>
      `${String.fromCharCode(from + i)}${suffix}`
    );
  }

  return null;
}

export default function ColumnConfig({ columns, onSubmit, loading, initialConfig }: ColumnConfigProps) {
  const [mode, setMode] = useState<Mode>(initialConfig?.mode ?? 'custom');
  const [groupCount, setGroupCount] = useState(initialConfig?.groupCount ?? 4);
  const [groupNames, setGroupNames] = useState(initialConfig?.groupNames?.join(', ') ?? '');
  const [useCapacity, setUseCapacity] = useState((initialConfig?.groupCapacities?.length ?? 0) > 0);
  const [capacities, setCapacities] = useState<GroupCapacity[]>(initialConfig?.groupCapacities ?? []);
  const [rules, setRules] = useState<ColumnRule[]>(initialConfig?.rules ?? []);
  const [useLeaders, setUseLeaders] = useState((initialConfig?.groupLeaders?.length ?? 0) > 0);
  const [leaders, setLeaders] = useState<GroupLeader[]>(initialConfig?.groupLeaders ?? []);
  const [scheduleColumns, setScheduleColumns] = useState<string[]>(initialConfig?.scheduleColumns ?? []);

  // Derived group names list (supports range syntax like "1조~10조")
  const parsedNames = parseGroupNames(groupNames);
  const groupNameList =
    parsedNames.length > 0
      ? parsedNames
      : Array.from({ length: groupCount }, (_, i) => `${i + 1}조`);

  // --- Capacity ---
  function initCapacities() {
    const base = Math.ceil(100 / groupCount); // placeholder
    setCapacities(
      groupNameList.map((name) => ({
        groupName: name,
        min: 1,
        max: base,
      }))
    );
  }

  function updateCapacity(idx: number, field: 'min' | 'max', value: number) {
    setCapacities((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c))
    );
  }

  // --- Leaders ---
  function initLeaders() {
    setLeaders(groupNameList.map((name) => ({ groupName: name, leader: '', subLeader: '', fixedMembers: [] })));
  }

  function updateLeader(idx: number, field: 'leader' | 'subLeader', value: string) {
    setLeaders((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l))
    );
  }

  function updateFixedMember(groupIdx: number, memberIdx: number, value: string) {
    setLeaders((prev) =>
      prev.map((l, i) => {
        if (i !== groupIdx) return l;
        const fixed = [...(l.fixedMembers || [])];
        fixed[memberIdx] = value;
        return { ...l, fixedMembers: fixed };
      })
    );
  }

  function addFixedMember(groupIdx: number) {
    setLeaders((prev) =>
      prev.map((l, i) => {
        if (i !== groupIdx) return l;
        const fixed = [...(l.fixedMembers || [])];
        // no limit on fixed members
        fixed.push('');
        return { ...l, fixedMembers: fixed };
      })
    );
  }

  function removeFixedMember(groupIdx: number, memberIdx: number) {
    setLeaders((prev) =>
      prev.map((l, i) => {
        if (i !== groupIdx) return l;
        const fixed = [...(l.fixedMembers || [])];
        fixed.splice(memberIdx, 1);
        return { ...l, fixedMembers: fixed };
      })
    );
  }

  // --- Rules ---
  function addRule(type: ColumnRule['type']) {
    const col = columns[0]?.name || '';
    if (type === 'pin') {
      setRules([
        ...rules,
        { type: 'pin', columnName: col, value: '', targetGroup: groupNameList[0] || '1조' } as PinRule,
      ]);
    } else if (type === 'spread') {
      setRules([
        ...rules,
        { type: 'spread', columnName: col, weight: 5 } as SpreadRule,
      ]);
    } else if (type === 'cluster') {
      setRules([
        ...rules,
        { type: 'cluster', columnName: col, weight: 5, similarValues: [] } as ClusterRule,
      ]);
    } else if (type === 'ensure') {
      setRules([
        ...rules,
        { type: 'ensure', columnName: col, value: '', minPerGroup: 1 } as EnsureRule,
      ]);
    } else if (type === 'exclude') {
      setRules([
        ...rules,
        { type: 'exclude', columnName: col, value: '', excludeGroup: groupNameList[0] || '1조' } as ExcludeRule,
      ]);
    } else if (type === 'ratio') {
      // Auto-populate ratios from unique values with equal weight
      const colMeta = columns.find((c) => c.name === col);
      const ratios: Record<string, number> = {};
      for (const v of colMeta?.uniqueValues || []) {
        ratios[v] = 1;
      }
      setRules([
        ...rules,
        { type: 'ratio', columnName: col, ratios, weight: 5 } as RatioRule,
      ]);
    }
  }

  function removeRule(index: number) {
    setRules(rules.filter((_, i) => i !== index));
  }

  function updateRule(index: number, updates: Record<string, unknown>) {
    setRules(
      rules.map((r, i) => (i === index ? { ...r, ...updates } as ColumnRule : r))
    );
  }

  // --- Schedule ---
  function toggleScheduleColumn(colName: string) {
    setScheduleColumns((prev) =>
      prev.includes(colName) ? prev.filter((c) => c !== colName) : [...prev, colName]
    );
  }

  function handleSubmit() {
    const finalGroupCount = groupNameList.length > 0 ? groupNameList.length : groupCount;
    const activeLeaders = useLeaders
      ? leaders
          .map((l) => ({
            ...l,
            fixedMembers: l.fixedMembers?.filter((m) => m.trim()) || [],
          }))
          .filter((l) => l.leader?.trim() || l.subLeader?.trim() || (l.fixedMembers && l.fixedMembers.length > 0))
      : undefined;
    onSubmit({
      mode,
      groupCount: finalGroupCount,
      groupNames: groupNameList.length > 0 ? groupNameList : undefined,
      groupCapacities: useCapacity ? capacities : undefined,
      groupLeaders: activeLeaders?.length ? activeLeaders : undefined,
      rules,
      scheduleColumns: mode === 'schedule' ? scheduleColumns : undefined,
    });
  }

  const ruleTypeLabels = {
    pin: { label: '고정 배정', color: 'text-blue-600', desc: '특정 값 → 특정 그룹' },
    spread: { label: '분산 배정', color: 'text-orange-600', desc: '같은 값이 겹치지 않게' },
    cluster: { label: '모음 배정', color: 'text-green-600', desc: '비슷한 값끼리 같은 그룹' },
    ensure: { label: '보장 배정', color: 'text-purple-600', desc: '특정 값이 각 그룹에 최소 N명' },
    exclude: { label: '제외 배정', color: 'text-red-600', desc: '특정 값 → 특정 그룹에 배정 안 함' },
    ratio: { label: '비율 배정', color: 'text-teal-600', desc: '각 그룹 내 값 비율 지정 (성비, 학번 등)' },
  };

  return (
    <div className="space-y-6">
      {/* Mode Selection */}
      <Card>
        <CardHeader>
          <CardTitle>분배 방식</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {(Object.entries(modeLabels) as [Mode, { title: string; desc: string }][]).map(
              ([key, { title, desc }]) => (
                <button
                  key={key}
                  onClick={() => setMode(key)}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    mode === key
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-muted-foreground/50'
                  }`}
                >
                  <div className="font-medium text-sm">{title}</div>
                  <div className="text-xs text-muted-foreground mt-1">{desc}</div>
                </button>
              )
            )}
          </div>
        </CardContent>
      </Card>

      {/* Group Settings */}
      <Card>
        <CardHeader>
          <CardTitle>그룹 설정</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>그룹 수</Label>
              <Input
                type="number"
                min={2}
                max={50}
                value={groupCount}
                onChange={(e) => setGroupCount(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>그룹 이름 (쉼표 또는 범위)</Label>
              <Input
                placeholder="예: 1조~10조 또는 1조, 2조, 3조"
                value={groupNames}
                onChange={(e) => setGroupNames(e.target.value)}
              />
            </div>
          </div>

          <Separator />

          {/* Min/Max Capacity */}
          <div className="flex items-center justify-between">
            <div>
              <Label>그룹별 최소/최대 인원</Label>
              <p className="text-xs text-muted-foreground">각 그룹의 인원 제한을 설정합니다</p>
            </div>
            <Switch
              checked={useCapacity}
              onCheckedChange={(v) => {
                setUseCapacity(v);
                if (v && capacities.length === 0) initCapacities();
              }}
            />
          </div>

          {useCapacity && (
            <div className="space-y-2">
              {groupNameList.map((name, i) => (
                <div key={name} className="flex items-center gap-3 text-sm">
                  <span className="w-16 font-medium truncate">{name}</span>
                  <Label className="text-xs text-muted-foreground">최소</Label>
                  <Input
                    type="number"
                    min={0}
                    value={capacities[i]?.min ?? 1}
                    onChange={(e) => updateCapacity(i, 'min', Number(e.target.value))}
                    className="w-16 h-8"
                  />
                  <Label className="text-xs text-muted-foreground">최대</Label>
                  <Input
                    type="number"
                    min={1}
                    value={capacities[i]?.max ?? 20}
                    onChange={(e) => updateCapacity(i, 'max', Number(e.target.value))}
                    className="w-16 h-8"
                  />
                </div>
              ))}
            </div>
          )}

          <Separator />

          {/* Leaders */}
          <div className="flex items-center justify-between">
            <div>
              <Label>조장 / 부조장 지정</Label>
              <p className="text-xs text-muted-foreground">각 조의 조장·부조장을 고정합니다 (이름 입력)</p>
            </div>
            <Switch
              checked={useLeaders}
              onCheckedChange={(v) => {
                setUseLeaders(v);
                if (v && leaders.length === 0) initLeaders();
              }}
            />
          </div>

          {useLeaders && (
            <div className="space-y-3">
              {groupNameList.map((name, i) => (
                <div key={name} className="space-y-1.5">
                  <div className="flex items-center gap-3 text-sm">
                    <span className="w-16 font-medium truncate">{name}</span>
                    <Label className="text-xs text-muted-foreground shrink-0">조장</Label>
                    <Input
                      placeholder="이름"
                      value={leaders[i]?.leader ?? ''}
                      onChange={(e) => updateLeader(i, 'leader', e.target.value)}
                      className="w-24 h-8"
                    />
                    <Label className="text-xs text-muted-foreground shrink-0">부조장</Label>
                    <Input
                      placeholder="이름"
                      value={leaders[i]?.subLeader ?? ''}
                      onChange={(e) => updateLeader(i, 'subLeader', e.target.value)}
                      className="w-24 h-8"
                    />
                  </div>
                  {/* 고정인원 */}
                  {(leaders[i]?.fixedMembers || []).map((member, mi) => (
                    <div key={mi} className="flex items-center gap-3 text-sm pl-16">
                      <Label className="text-xs text-muted-foreground shrink-0">고정{mi + 1}</Label>
                      <Input
                        placeholder="이름"
                        value={member}
                        onChange={(e) => updateFixedMember(i, mi, e.target.value)}
                        className="w-24 h-8"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFixedMember(i, mi)}
                        className="h-6 px-2 text-muted-foreground"
                      >
                        X
                      </Button>
                    </div>
                  ))}
                  <div className="pl-16">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addFixedMember(i)}
                      className="h-6 px-2 text-xs"
                    >
                      + 고정인원
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Schedule Columns */}
      {mode === 'schedule' && (
        <Card>
          <CardHeader>
            <CardTitle>스케줄 칼럼 선택</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              출석/일정을 나타내는 칼럼을 선택하세요. (O/Y/1 = 참석)
            </p>
            <div className="space-y-2">
              {columns.map((col) => (
                <label key={col.name} className="flex items-center gap-2">
                  <Switch
                    checked={scheduleColumns.includes(col.name)}
                    onCheckedChange={() => toggleScheduleColumn(col.name)}
                  />
                  <span className="text-sm">{col.name}</span>
                  <span className="text-xs text-muted-foreground">
                    ({col.uniqueValues.slice(0, 5).join(', ')})
                  </span>
                </label>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Column Rules (for balanced/custom) */}
      {(mode === 'balanced' || mode === 'custom') && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>칼럼 규칙</span>
              <div className="flex gap-1 flex-wrap">
                <Button variant="outline" size="sm" onClick={() => addRule('pin')}>
                  + 고정
                </Button>
                <Button variant="outline" size="sm" onClick={() => addRule('spread')}>
                  + 분산
                </Button>
                <Button variant="outline" size="sm" onClick={() => addRule('cluster')}>
                  + 모음
                </Button>
                <Button variant="outline" size="sm" onClick={() => addRule('ensure')}>
                  + 보장
                </Button>
                <Button variant="outline" size="sm" onClick={() => addRule('exclude')}>
                  + 제외
                </Button>
                <Button variant="outline" size="sm" onClick={() => addRule('ratio')}>
                  + 비율
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {rules.length === 0 && (
              <div className="text-center py-6 text-sm text-muted-foreground">
                <p>규칙을 추가해주세요</p>
                <p className="text-xs mt-1">
                  고정: 특정 값 → 특정 그룹 | 분산: 겹치지 않게 | 모음: 비슷한 값끼리
                </p>
              </div>
            )}

            {rules.map((rule, i) => (
              <div key={i} className="p-3 border rounded-lg space-y-3">
                {/* Rule header */}
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className={ruleTypeLabels[rule.type].color}>
                    {ruleTypeLabels[rule.type].label}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeRule(i)}
                    className="h-6 px-2 text-muted-foreground"
                  >
                    X
                  </Button>
                </div>

                {/* Column selector (all rules have this) */}
                <div className="flex items-center gap-2">
                  <Label className="text-xs w-12 shrink-0">칼럼</Label>
                  <Select
                    value={rule.columnName}
                    onValueChange={(v) => v && updateRule(i, { columnName: v })}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {columns.map((col) => (
                        <SelectItem key={col.name} value={col.name}>
                          {col.name} ({col.uniqueValues.length}종)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Pin rule specifics */}
                {rule.type === 'pin' && (
                  <>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs w-12 shrink-0">값</Label>
                      <Select
                        value={(rule as PinRule).value}
                        onValueChange={(v) => v && updateRule(i, { value: v })}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="선택..." />
                        </SelectTrigger>
                        <SelectContent>
                          {columns
                            .find((c) => c.name === rule.columnName)
                            ?.uniqueValues.map((val) => (
                              <SelectItem key={val} value={val}>
                                {val}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs w-12 shrink-0">그룹</Label>
                      <Select
                        value={(rule as PinRule).targetGroup}
                        onValueChange={(v) => v && updateRule(i, { targetGroup: v })}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {groupNameList.map((name) => (
                            <SelectItem key={name} value={name}>
                              {name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      이 값을 가진 사람은 무조건 선택한 그룹에 배정됩니다
                    </p>
                  </>
                )}

                {/* Spread rule specifics */}
                {rule.type === 'spread' && (
                  <>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs w-12 shrink-0">강도</Label>
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        value={(rule as SpreadRule).weight}
                        onChange={(e) => updateRule(i, { weight: Number(e.target.value) })}
                        className="w-16 h-8"
                      />
                      <span className="text-xs text-muted-foreground">
                        (1=약하게 ~ 10=강하게)
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {columns
                        .find((c) => c.name === rule.columnName)
                        ?.uniqueValues.slice(0, 20)
                        .map((v) => (
                          <Badge key={v} variant="outline" className="text-xs">
                            {v}
                          </Badge>
                        ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      같은 값을 가진 사람들을 최대한 다른 그룹에 배정합니다
                    </p>
                  </>
                )}

                {/* Cluster rule specifics */}
                {rule.type === 'cluster' && (
                  <ClusterRuleEditor
                    rule={rule as ClusterRule}
                    column={columns.find((c) => c.name === rule.columnName)}
                    onUpdate={(updates) => updateRule(i, updates)}
                  />
                )}

                {/* Ensure rule specifics */}
                {rule.type === 'ensure' && (
                  <>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs w-12 shrink-0">값</Label>
                      <Select
                        value={(rule as EnsureRule).value}
                        onValueChange={(v) => v && updateRule(i, { value: v })}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="선택..." />
                        </SelectTrigger>
                        <SelectContent>
                          {columns
                            .find((c) => c.name === rule.columnName)
                            ?.uniqueValues.map((val) => (
                              <SelectItem key={val} value={val}>
                                {val}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs shrink-0">그룹당 최소</Label>
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        value={(rule as EnsureRule).minPerGroup}
                        onChange={(e) => updateRule(i, { minPerGroup: Number(e.target.value) })}
                        className="w-16 h-8"
                      />
                      <span className="text-xs text-muted-foreground">명</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      이 값을 가진 사람이 모든 그룹에 최소 인원만큼 배정됩니다
                    </p>
                  </>
                )}

                {/* Exclude rule specifics */}
                {rule.type === 'exclude' && (
                  <>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs w-12 shrink-0">값</Label>
                      <Select
                        value={(rule as ExcludeRule).value}
                        onValueChange={(v) => v && updateRule(i, { value: v })}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="선택..." />
                        </SelectTrigger>
                        <SelectContent>
                          {columns
                            .find((c) => c.name === rule.columnName)
                            ?.uniqueValues.map((val) => (
                              <SelectItem key={val} value={val}>
                                {val}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">제외 그룹 (클릭하여 선택/해제)</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {groupNameList.map((name) => {
                          const selected = (rule as ExcludeRule).excludeGroups?.includes(name)
                            ?? (rule as ExcludeRule).excludeGroup === name;
                          return (
                            <button
                              key={name}
                              type="button"
                              onClick={() => {
                                const current = (rule as ExcludeRule).excludeGroups
                                  ?? ((rule as ExcludeRule).excludeGroup ? [(rule as ExcludeRule).excludeGroup] : []);
                                const next = selected
                                  ? current.filter((g) => g !== name)
                                  : [...current, name];
                                updateRule(i, { excludeGroups: next, excludeGroup: next[0] || '' });
                              }}
                              className={`px-2 py-1 rounded text-xs border transition-colors ${
                                selected
                                  ? 'bg-red-100 border-red-400 text-red-700'
                                  : 'bg-card border-border text-muted-foreground hover:border-muted-foreground/50'
                              }`}
                            >
                              {name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      이 값을 가진 사람은 선택한 그룹들에 배정되지 않습니다
                    </p>
                  </>
                )}

                {/* Ratio rule specifics */}
                {rule.type === 'ratio' && (
                  <RatioRuleEditor
                    rule={rule as RatioRule}
                    column={columns.find((c) => c.name === rule.columnName)}
                    onUpdate={(updates) => updateRule(i, updates)}
                  />
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Button className="w-full" size="lg" onClick={handleSubmit} disabled={loading}>
        {loading ? '분배 중...' : '분배 실행'}
      </Button>
    </div>
  );
}

// --- Cluster Rule Editor (handles similar value grouping) ---
function ClusterRuleEditor({
  rule,
  column,
  onUpdate,
}: {
  rule: ClusterRule;
  column?: ColumnMeta;
  onUpdate: (updates: Partial<ClusterRule>) => void;
}) {
  const [newGroupInput, setNewGroupInput] = useState('');

  const similarValues = rule.similarValues || [];

  function addSimilarGroup() {
    const values = newGroupInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (values.length < 2) return;
    onUpdate({ similarValues: [...similarValues, values] });
    setNewGroupInput('');
  }

  function removeSimilarGroup(idx: number) {
    onUpdate({
      similarValues: similarValues.filter((_, i) => i !== idx),
    });
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Label className="text-xs w-12 shrink-0">강도</Label>
        <Input
          type="number"
          min={1}
          max={10}
          value={rule.weight}
          onChange={(e) => onUpdate({ weight: Number(e.target.value) })}
          className="w-16 h-8"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs">비슷한 값 묶기</Label>
        <p className="text-xs text-muted-foreground">
          비슷하다고 볼 값들을 쉼표로 구분해 입력하세요 (예: 간호,의학,약학)
        </p>

        {similarValues.map((group, idx) => (
          <div key={idx} className="flex items-center gap-1.5">
            <div className="flex flex-wrap gap-1 flex-1">
              {group.map((v) => (
                <Badge key={v} variant="secondary" className="text-xs">
                  {v}
                </Badge>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeSimilarGroup(idx)}
              className="h-6 px-1.5"
            >
              X
            </Button>
          </div>
        ))}

        <div className="flex gap-2">
          <Input
            placeholder="간호, 의학, 약학"
            value={newGroupInput}
            onChange={(e) => setNewGroupInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addSimilarGroup()}
            className="h-8 text-sm"
          />
          <Button variant="outline" size="sm" onClick={addSimilarGroup}>
            추가
          </Button>
        </div>
      </div>

      {column && (
        <div className="flex flex-wrap gap-1">
          {column.uniqueValues.slice(0, 20).map((v) => (
            <Badge
              key={v}
              variant="outline"
              className="text-xs cursor-pointer"
              onClick={() => setNewGroupInput((prev) => (prev ? `${prev}, ${v}` : v))}
            >
              {v}
            </Badge>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        같거나 비슷한 값을 가진 사람들을 같은 그룹에 배정합니다
      </p>
    </>
  );
}

// --- Ratio Rule Editor ---
function RatioRuleEditor({
  rule,
  column,
  onUpdate,
}: {
  rule: RatioRule;
  column?: ColumnMeta;
  onUpdate: (updates: Record<string, unknown>) => void;
}) {
  const ratios = rule.ratios || {};
  const totalRatio = Object.values(ratios).reduce((s, r) => s + r, 0);

  function setRatio(val: string, num: number) {
    onUpdate({ ratios: { ...ratios, [val]: Math.max(0, num) } });
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Label className="text-xs w-12 shrink-0">강도</Label>
        <Input
          type="number"
          min={1}
          max={10}
          value={rule.weight}
          onChange={(e) => onUpdate({ weight: Number(e.target.value) })}
          className="w-16 h-8"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs">값별 비율</Label>
        <p className="text-xs text-muted-foreground">
          각 값의 비율 숫자를 입력하세요 (예: 남=2, 여=1 → 각 그룹에서 남:여 ≈ 2:1)
        </p>

        <div className="space-y-1.5">
          {(column?.uniqueValues || Object.keys(ratios)).map((val) => {
            const r = ratios[val] ?? 1;
            const pct = totalRatio > 0 ? ((r / totalRatio) * 100).toFixed(0) : '0';
            return (
              <div key={val} className="flex items-center gap-2">
                <span className="text-sm w-24 truncate">{val}</span>
                <Input
                  type="number"
                  min={0}
                  value={r}
                  onChange={(e) => setRatio(val, Number(e.target.value))}
                  className="w-16 h-7 text-sm"
                />
                <span className="text-xs text-muted-foreground w-12">≈ {pct}%</span>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        각 그룹 내에서 이 비율에 최대한 가깝게 배정합니다
      </p>
    </>
  );
}
