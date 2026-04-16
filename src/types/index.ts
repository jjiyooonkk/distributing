export interface PersonRow {
  id: string;
  [columnName: string]: string;
}

export interface ColumnMeta {
  name: string;
  type: 'text' | 'number' | 'category';
  uniqueValues: string[];
}

// --- Column Rules ---

// "비전일 참석자는 다 1조로" 같은 고정 배정
export interface PinRule {
  type: 'pin';
  columnName: string;
  value: string;        // 칼럼 값 (예: "비전일")
  targetGroup: string;  // 그룹 이름 (예: "1조")
}

// "이전 지역과 최대한 겹치지 않게" 같은 분산 배정
export interface SpreadRule {
  type: 'spread';
  columnName: string;
  weight: number; // 1-10, 높을수록 강하게 분산
}

// "비슷한 전공끼리 같은 조" 같은 모음 배정
export interface ClusterRule {
  type: 'cluster';
  columnName: string;
  similarValues?: string[][]; // 비슷하다고 묶을 값 그룹 (예: [["간호","의학"],["약학","치의학"]])
  weight: number;
}

// 그룹별 최소/최대 인원
export interface GroupCapacity {
  groupName: string;
  min: number;
  max: number;
}

// "1종 운전 가능자가 각 팀에 최소 1명" 같은 보장 배정
export interface EnsureRule {
  type: 'ensure';
  columnName: string;
  value: string;        // 칼럼 값 (예: "가능", "Y")
  minPerGroup: number;  // 그룹당 최소 인원
}

// "이전에 서울 경험자는 서울 그룹에 배정하지 않기" 같은 제외 배정
export interface ExcludeRule {
  type: 'exclude';
  columnName: string;
  value: string;         // 칼럼 값 (예: "서울")
  excludeGroup: string;  // 이 그룹에 배정하지 않음
}

export type ColumnRule = PinRule | SpreadRule | ClusterRule | EnsureRule | ExcludeRule;

export interface DistributionConfig {
  mode: 'random' | 'balanced' | 'schedule' | 'custom';
  groupCount: number;
  groupNames?: string[];
  groupCapacities?: GroupCapacity[];
  rules: ColumnRule[];
  scheduleColumns?: string[];
}

export interface Group {
  id: string;
  name: string;
  members: PersonRow[];
  stats: Record<string, Record<string, number>>;
}

export interface DistributionResult {
  groups: Group[];
  timestamp: string;
}

export interface Project {
  code: string;
  name: string;
  createdAt: string;
  expiresAt: string;
  status: 'active' | 'completed';
  data: PersonRow[];
  columns: ColumnMeta[];
  config: DistributionConfig | null;
  results: DistributionResult | null;
}
