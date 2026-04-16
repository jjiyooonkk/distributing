import { NextResponse } from 'next/server';
import { createProject, getProject } from '@/lib/project';

export async function POST(request: Request) {
  try {
    const { name } = await request.json();
    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: '프로젝트 이름을 입력해주세요.' }, { status: 400 });
    }
    const project = await createProject(name.trim());
    return NextResponse.json(project);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('POST /api/project error:', msg);
    return NextResponse.json({ error: `프로젝트 생성 실패: ${msg}` }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    if (!code) {
      return NextResponse.json({ error: '코드를 입력해주세요.' }, { status: 400 });
    }
    const project = await getProject(code.toUpperCase());
    if (!project) {
      return NextResponse.json({ error: '프로젝트를 찾을 수 없습니다.' }, { status: 404 });
    }
    return NextResponse.json(project);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('GET /api/project error:', msg);
    return NextResponse.json({ error: `프로젝트 조회 실패: ${msg}` }, { status: 500 });
  }
}
