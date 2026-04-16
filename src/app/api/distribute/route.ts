import { NextResponse } from 'next/server';
import { getProject, updateProject } from '@/lib/project';
import { distribute } from '@/lib/distribution';
import { distributeBySchedule } from '@/lib/distribution/schedule-assign';
import type { DistributionConfig, ScheduleConfig, isScheduleConfig } from '@/types';

export async function POST(request: Request) {
  try {
    const { code, config } = await request.json();

    const project = await getProject(code);
    if (!project) {
      return NextResponse.json({ error: '프로젝트를 찾을 수 없습니다.' }, { status: 404 });
    }
    if (project.data.length === 0) {
      return NextResponse.json({ error: '데이터를 먼저 업로드해주세요.' }, { status: 400 });
    }

    if (project.projectMode === 'schedule') {
      const schedConfig = config as ScheduleConfig;
      const results = distributeBySchedule(project.data, schedConfig, project.columns);
      await updateProject(code, { config: schedConfig, results });
      return NextResponse.json(results);
    } else {
      const groupConfig = config as DistributionConfig;
      const groups = distribute(project.data, groupConfig, project.columns);
      const results = { groups, timestamp: new Date().toISOString() };
      await updateProject(code, { config: groupConfig, results });
      return NextResponse.json(results);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('POST /api/distribute error:', msg);
    return NextResponse.json({ error: `분배 실패: ${msg}` }, { status: 500 });
  }
}
