'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type {
  DistributionConfig,
  PinRule,
  SpreadRule,
  ClusterRule,
  EnsureRule,
  ExcludeRule,
  RatioRule,
} from '@/types';

interface ConfigSummaryProps {
  config: DistributionConfig;
}

const modeLabels: Record<string, string> = {
  random: '랜덤',
  balanced: '균등 분배',
  schedule: '스케줄 기반',
  custom: '커스텀 규칙',
};

const ruleStyles: Record<string, { label: string; color: string }> = {
  pin: { label: '고정', color: 'bg-blue-100 text-blue-700' },
  spread: { label: '분산', color: 'bg-orange-100 text-orange-700' },
  cluster: { label: '모음', color: 'bg-green-100 text-green-700' },
  ensure: { label: '보장', color: 'bg-purple-100 text-purple-700' },
  exclude: { label: '제외', color: 'bg-red-100 text-red-700' },
  ratio: { label: '비율', color: 'bg-teal-100 text-teal-700' },
};

function describeRule(rule: DistributionConfig['rules'][number]): string {
  switch (rule.type) {
    case 'pin': {
      const r = rule as PinRule;
      return `${r.columnName}: "${r.value}" → ${r.targetGroup}`;
    }
    case 'spread': {
      const r = rule as SpreadRule;
      return `${r.columnName} 분산 (강도 ${r.weight})`;
    }
    case 'cluster': {
      const r = rule as ClusterRule;
      const groups = r.similarValues?.length
        ? ` — ${r.similarValues.map((g) => g.join('·')).join(' | ')}`
        : '';
      return `${r.columnName} 모음 (강도 ${r.weight})${groups}`;
    }
    case 'ensure': {
      const r = rule as EnsureRule;
      return `${r.columnName}: "${r.value}" 그룹당 최소 ${r.minPerGroup}명`;
    }
    case 'exclude': {
      const r = rule as ExcludeRule;
      return `${r.columnName}: "${r.value}" → ${r.excludeGroup} 제외`;
    }
    case 'ratio': {
      const r = rule as RatioRule;
      const total = Object.values(r.ratios).reduce((s, v) => s + v, 0);
      const parts = Object.entries(r.ratios)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => `${k}:${v}`)
        .join(' / ');
      return `${r.columnName} 비율 ${parts}${total > 0 ? '' : ' (균등)'}`;
    }
    default:
      return '';
  }
}

export default function ConfigSummary({ config }: ConfigSummaryProps) {
  if (!config) return null;

  const hasCapacities = config.groupCapacities && config.groupCapacities.length > 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          적용된 분배 설정
          <Badge variant="secondary" className="text-xs font-normal">
            {modeLabels[config.mode] || config.mode}
          </Badge>
          <span className="text-muted-foreground font-normal">
            {config.groupCount}개 그룹
            {config.groupNames?.length ? ` (${config.groupNames.join(', ')})` : ''}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {hasCapacities && (
          <div className="text-xs text-muted-foreground">
            인원 제한:{' '}
            {config.groupCapacities!.map((c) => (
              <span key={c.groupName} className="mr-2">
                {c.groupName} {c.min}~{c.max}명
              </span>
            ))}
          </div>
        )}

        {config.rules.length > 0 ? (
          <div className="space-y-1">
            {config.rules.map((rule, i) => {
              const style = ruleStyles[rule.type];
              return (
                <div key={i} className="flex items-start gap-1.5 text-xs">
                  <Badge className={`${style.color} text-[10px] px-1.5 py-0 shrink-0`}>
                    {style.label}
                  </Badge>
                  <span>{describeRule(rule)}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">설정된 규칙 없음</p>
        )}

        {config.scheduleColumns && config.scheduleColumns.length > 0 && (
          <div className="text-xs text-muted-foreground">
            스케줄 칼럼: {config.scheduleColumns.join(', ')}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
