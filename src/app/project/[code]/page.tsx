'use client';

import { useEffect, useState, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import FileUpload from '@/components/file-upload';
import DataPreview from '@/components/data-preview';
import ColumnConfig from '@/components/column-config';
import DistributionResults from '@/components/distribution-results';
import ScheduleConfigComponent from '@/components/schedule-config';
import ScheduleResults from '@/components/schedule-results';
import NotifyDialog from '@/components/notify-dialog';
import ConfigSummary from '@/components/config-summary';
import type { Project, PersonRow, ColumnMeta, DistributionConfig, DistributionResult, ScheduleConfig, ScheduleResult } from '@/types';
import { toast } from 'sonner';

type Step = 'upload' | 'configure' | 'results';

export default function ProjectPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [distributing, setDistributing] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [step, setStep] = useState<Step>('upload');

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/project/${code}`);
      if (!res.ok) {
        router.push('/');
        return;
      }
      const data: Project = await res.json();
      setProject(data);

      // Auto-select step based on project state
      if (data.results) setStep('results');
      else if (data.data.length > 0) setStep('configure');
      else setStep('upload');
    } catch {
      router.push('/');
    } finally {
      setLoading(false);
    }
  }, [code, router]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  async function handleUpload(rows: PersonRow[], columns: ColumnMeta[]) {
    try {
      const res = await fetch(`/api/project/${code}/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows, columns }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '업로드 실패');
      setProject(data as Project);
      setStep('configure');
      toast.success(`${rows.length}명 데이터가 업로드되었습니다.`);
    } catch (e) {
      toast.error(`데이터 업로드 실패: ${e instanceof Error ? e.message : '알 수 없는 오류'}`);
    }
  }

  async function handleDistribute(config: DistributionConfig | ScheduleConfig) {
    setDistributing(true);
    try {
      const res = await fetch('/api/distribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, config }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '분배 실패');
      setProject((prev) => prev ? { ...prev, config, results: data } : prev);
      setStep('results');
      toast.success(project?.projectMode === 'schedule' ? '숙소 배정이 완료되었습니다!' : '분배가 완료되었습니다!');
    } catch (e) {
      toast.error(`분배 실패: ${e instanceof Error ? e.message : '알 수 없는 오류'}`);
    } finally {
      setDistributing(false);
    }
  }

  async function handleResultsUpdate(results: DistributionResult | ScheduleResult) {
    setProject((prev) => prev ? { ...prev, results } : prev);
    // Save to server
    await fetch(`/api/project/${code}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ results }),
    });
  }

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground">불러오는 중...</p>
      </main>
    );
  }

  if (!project) return null;

  return (
    <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{project.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="font-mono tracking-wider">
              {project.code}
            </Badge>
            <span className="text-sm text-muted-foreground">
              이 코드를 공유하면 다른 사람도 접근할 수 있습니다
            </span>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => router.push('/')}>
          홈으로
        </Button>
      </div>

      <Separator />

      {/* Step Navigation */}
      <div className="flex gap-1">
        <Button
          variant={step === 'upload' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setStep('upload')}
        >
          1. 데이터 업로드
        </Button>
        <Button
          variant={step === 'configure' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setStep('configure')}
          disabled={project.data.length === 0}
        >
          2. 분배 설정
        </Button>
        <Button
          variant={step === 'results' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setStep('results')}
          disabled={!project.results}
        >
          3. 결과 확인
        </Button>
      </div>

      {/* Step Content */}
      {step === 'upload' && (
        <div className="space-y-6">
          <FileUpload onUpload={handleUpload} />
          {project.data.length > 0 && (
            <>
              <Separator />
              <DataPreview rows={project.data} columns={project.columns} />
              <Button onClick={() => setStep('configure')}>
                다음: 분배 설정
              </Button>
            </>
          )}
        </div>
      )}

      {step === 'configure' && project.data.length > 0 && (
        <div className="space-y-4">
          <DataPreview rows={project.data} columns={project.columns} />
          <Separator />
          {project.projectMode === 'schedule' ? (
            <ScheduleConfigComponent
              columns={project.columns}
              data={project.data}
              onSubmit={handleDistribute}
              loading={distributing}
              initialConfig={project.config as ScheduleConfig | null}
            />
          ) : (
            <ColumnConfig
              columns={project.columns}
              onSubmit={handleDistribute}
              loading={distributing}
              initialConfig={project.config as DistributionConfig | null}
            />
          )}
        </div>
      )}

      {step === 'results' && project.results && (
        <>
          {project.config && (
            <ConfigSummary config={project.config} />
          )}
          {'assignments' in project.results ? (
            <ScheduleResults
              results={project.results as ScheduleResult}
              data={project.data}
              columns={project.columns}
              onUpdate={handleResultsUpdate as (r: ScheduleResult) => void}
              onNotify={() => setNotifyOpen(true)}
            />
          ) : (
            <DistributionResults
              results={project.results as DistributionResult}
              columns={project.columns}
              onUpdate={handleResultsUpdate as (r: DistributionResult) => void}
              onNotify={() => setNotifyOpen(true)}
            />
          )}
          <NotifyDialog
            open={notifyOpen}
            onClose={() => setNotifyOpen(false)}
            columns={project.columns}
            projectCode={project.code}
          />
        </>
      )}
    </main>
  );
}
