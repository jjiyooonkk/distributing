'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import type { ProjectMode } from '@/types';

export default function HomePage() {
  const router = useRouter();
  const [projectName, setProjectName] = useState('');
  const [projectMode, setProjectMode] = useState<ProjectMode>('group');
  const [projectCode, setProjectCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleCreate() {
    if (!projectName.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: projectName.trim(), mode: projectMode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push(`/project/${data.code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin() {
    const code = projectCode.trim().toUpperCase();
    if (!code) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/project?code=${code}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push(`/project/${code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">분배하기</h1>
          <p className="text-muted-foreground">
            스프레드시트 기반 인원 분배 도구
          </p>
        </div>

        {error && (
          <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
            {error}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>새 프로젝트 만들기</CardTitle>
            <CardDescription>
              새로운 인원 분배 프로젝트를 시작합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="프로젝트 이름 (예: 2024 여름 MT 조편성)"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setProjectMode('group')}
                className={`p-2.5 rounded-lg border text-left transition-colors ${
                  projectMode === 'group'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground/50'
                }`}
              >
                <div className="font-medium text-sm">조 편성</div>
                <div className="text-xs text-muted-foreground">그룹/팀 나누기</div>
              </button>
              <button
                onClick={() => setProjectMode('schedule')}
                className={`p-2.5 rounded-lg border text-left transition-colors ${
                  projectMode === 'schedule'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground/50'
                }`}
              >
                <div className="font-medium text-sm">기간별 배정</div>
                <div className="text-xs text-muted-foreground">숙소/스텝 배정</div>
              </button>
            </div>
            <Button
              className="w-full"
              onClick={handleCreate}
              disabled={loading || !projectName.trim()}
            >
              {loading ? '생성 중...' : '프로젝트 생성'}
            </Button>
          </CardContent>
        </Card>

        <div className="flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-sm text-muted-foreground">또는</span>
          <Separator className="flex-1" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>기존 프로젝트 참여</CardTitle>
            <CardDescription>
              프로젝트 코드를 입력해서 결과를 확인하거나 수정하세요.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="프로젝트 코드 (예: A3X9K2)"
              value={projectCode}
              onChange={(e) => setProjectCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              maxLength={6}
              className="text-center text-lg tracking-widest font-mono"
            />
            <Button
              variant="outline"
              className="w-full"
              onClick={handleJoin}
              disabled={loading || projectCode.trim().length < 6}
            >
              {loading ? '확인 중...' : '프로젝트 참여'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
