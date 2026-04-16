import { NextResponse } from 'next/server';
import { getProject, updateProject } from '@/lib/project';
import type { PersonRow, ColumnMeta } from '@/types';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const project = await getProject(code);
    if (!project) {
      return NextResponse.json({ error: '프로젝트를 찾을 수 없습니다.' }, { status: 404 });
    }

    const { rows, columns }: { rows: PersonRow[]; columns: ColumnMeta[] } =
      await request.json();

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: '데이터가 비어있습니다.' }, { status: 400 });
    }

    const updated = await updateProject(code, {
      data: rows,
      columns,
      config: null,
      results: null,
    });

    return NextResponse.json(updated);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('POST /api/project/[code]/upload error:', msg);
    return NextResponse.json({ error: `업로드 실패: ${msg}` }, { status: 500 });
  }
}
