import { NextResponse } from 'next/server';
import { getProject, updateProject, deleteProject } from '@/lib/project';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const project = await getProject(code);
    if (!project) {
      return NextResponse.json({ error: '프로젝트를 찾을 수 없습니다.' }, { status: 404 });
    }
    return NextResponse.json(project);
  } catch (e) {
    console.error('GET /api/project/[code] error:', e);
    return NextResponse.json({ error: '오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const updates = await request.json();
    const project = await updateProject(code, updates);
    if (!project) {
      return NextResponse.json({ error: '프로젝트를 찾을 수 없습니다.' }, { status: 404 });
    }
    return NextResponse.json(project);
  } catch (e) {
    console.error('PUT /api/project/[code] error:', e);
    return NextResponse.json({ error: '오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    await deleteProject(code);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/project/[code] error:', e);
    return NextResponse.json({ error: '오류가 발생했습니다.' }, { status: 500 });
  }
}
