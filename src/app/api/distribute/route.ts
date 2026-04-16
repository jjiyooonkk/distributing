import { NextResponse } from 'next/server';
import { getProject, updateProject } from '@/lib/project';
import { distribute } from '@/lib/distribution';
import type { DistributionConfig } from '@/types';

export async function POST(request: Request) {
  try {
    const { code, config }: { code: string; config: DistributionConfig } =
      await request.json();

    const project = await getProject(code);
    if (!project) {
      return NextResponse.json({ error: '프로젝트를 찾을 수 없습니다.' }, { status: 404 });
    }
    if (project.data.length === 0) {
      return NextResponse.json({ error: '데이터를 먼저 업로드해주세요.' }, { status: 400 });
    }

    const groups = distribute(project.data, config, project.columns);

    const results = {
      groups,
      timestamp: new Date().toISOString(),
    };

    await updateProject(code, { config, results });

    return NextResponse.json(results);
  } catch (e) {
    console.error('POST /api/distribute error:', e);
    return NextResponse.json({ error: '분배 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
