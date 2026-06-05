'use client';

import { useCallback, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { nanoid } from 'nanoid';
import { Button } from '@/components/ui/button';
import type { PersonRow, ColumnMeta } from '@/types';

interface FileUploadProps {
  onUpload: (rows: PersonRow[], columns: ColumnMeta[]) => void;
  loading?: boolean;
}

function detectColumnType(values: string[]): ColumnMeta['type'] {
  const nonEmpty = values.filter((v) => v.trim() !== '');
  if (nonEmpty.length === 0) return 'text';
  const allNumbers = nonEmpty.every((v) => !isNaN(Number(v)));
  if (allNumbers) return 'number';
  const unique = new Set(nonEmpty);
  if (unique.size <= Math.max(10, nonEmpty.length * 0.3)) return 'category';
  return 'text';
}

function parseToRows(
  rawRows: Record<string, string>[]
): { rows: PersonRow[]; columns: ColumnMeta[] } {
  if (rawRows.length === 0) return { rows: [], columns: [] };

  const colNames = Object.keys(rawRows[0]).filter(
    (k) => k !== '__rowNum__' && k.trim() !== ''
  );

  const columns: ColumnMeta[] = colNames.map((name) => {
    const values = rawRows.map((r) => String(r[name] ?? ''));
    const unique = [...new Set(values.filter((v) => v.trim() !== ''))];
    return {
      name,
      type: detectColumnType(values),
      uniqueValues: unique.slice(0, 50),
    };
  });

  const rows: PersonRow[] = rawRows.map((raw) => {
    const row: PersonRow = { id: nanoid(8) };
    for (const col of colNames) {
      row[col] = String(raw[col] ?? '').trim();
    }
    return row;
  });

  return { rows, columns };
}

function parseManualInput(text: string): { rows: PersonRow[]; columns: ColumnMeta[] } | null {
  const lines = text.trim().split('\n').filter((l) => l.trim());
  if (lines.length === 0) return null;

  const parsed: { 학번: string; 이름: string; 성별: string }[] = [];

  for (const line of lines) {
    // Split by whitespace, comma, or tab
    const parts = line.trim().split(/[\s,\t]+/).filter(Boolean);
    if (parts.length < 2) continue;

    if (parts.length === 2) {
      // 이름 성별 or 학번 이름
      const [a, b] = parts;
      if (['남', '여', '남자', '여자', 'M', 'F'].includes(b)) {
        parsed.push({ 학번: '', 이름: a, 성별: b });
      } else {
        parsed.push({ 학번: a, 이름: b, 성별: '' });
      }
    } else {
      // 학번 이름 성별
      parsed.push({ 학번: parts[0], 이름: parts[1], 성별: parts[2] });
    }
  }

  if (parsed.length === 0) return null;

  const has학번 = parsed.some((p) => p.학번);
  const has성별 = parsed.some((p) => p.성별);

  const colNames: string[] = [];
  if (has학번) colNames.push('학번');
  colNames.push('이름');
  if (has성별) colNames.push('성별');

  const rows: PersonRow[] = parsed.map((p) => {
    const row: PersonRow = { id: nanoid(8) };
    if (has학번) row['학번'] = p.학번;
    row['이름'] = p.이름;
    if (has성별) row['성별'] = p.성별;
    return row;
  });

  const columns: ColumnMeta[] = colNames.map((name) => {
    const values = rows.map((r) => r[name] || '');
    const unique = [...new Set(values.filter((v) => v.trim() !== ''))];
    return {
      name,
      type: detectColumnType(values),
      uniqueValues: unique.slice(0, 50),
    };
  });

  return { rows, columns };
}

export default function FileUpload({ onUpload, loading }: FileUploadProps) {
  const [mode, setMode] = useState<'file' | 'manual'>('file');
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState('');
  const [manualText, setManualText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    (file: File) => {
      setFileName(file.name);
      const ext = file.name.split('.').pop()?.toLowerCase();

      if (ext === 'csv' || ext === 'tsv') {
        Papa.parse(file, {
          header: false,
          skipEmptyLines: true,
          complete(results) {
            const allRows = results.data as string[][];
            // 첫 번째 비어있지 않은 행을 헤더로 사용
            const headerIdx = allRows.findIndex((row) =>
              row.some((cell) => cell.trim() !== '')
            );
            if (headerIdx === -1) {
              onUpload([], []);
              return;
            }
            const headers = allRows[headerIdx];
            const dataRows = allRows.slice(headerIdx + 1);
            const rawRows = dataRows
              .filter((row) => row.some((cell) => cell.trim() !== ''))
              .map((row) => {
                const obj: Record<string, string> = {};
                headers.forEach((h, i) => {
                  if (h.trim() !== '') obj[h] = row[i] ?? '';
                });
                return obj;
              });
            const { rows, columns } = parseToRows(rawRows);
            onUpload(rows, columns);
          },
        });
      } else {
        // Excel
        const reader = new FileReader();
        reader.onload = (e) => {
          const data = new Uint8Array(e.target!.result as ArrayBuffer);
          const wb = XLSX.read(data, { type: 'array' });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          // 시트의 전체 데이터를 배열로 읽어서 첫 번째 비어있지 않은 행을 찾음
          const allRows = XLSX.utils.sheet_to_json<string[]>(sheet, {
            header: 1,
            defval: '',
            raw: false,
          });
          const headerIdx = allRows.findIndex((row) =>
            row.some((cell) => String(cell).trim() !== '')
          );
          if (headerIdx === -1) {
            onUpload([], []);
            return;
          }
          const headers = allRows[headerIdx].map((h) => String(h));
          const dataRows = allRows.slice(headerIdx + 1);
          const rawRows = dataRows
            .filter((row) => row.some((cell) => String(cell).trim() !== ''))
            .map((row) => {
              const obj: Record<string, string> = {};
              headers.forEach((h, i) => {
                if (h.trim() !== '') obj[h] = String(row[i] ?? '');
              });
              return obj;
            });
          const { rows, columns } = parseToRows(rawRows);
          onUpload(rows, columns);
        };
        reader.readAsArrayBuffer(file);
      }
    },
    [onUpload]
  );

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  function handleManualSubmit() {
    const result = parseManualInput(manualText);
    if (!result || result.rows.length === 0) return;
    onUpload(result.rows, result.columns);
  }

  const parsedPreview = manualText.trim() ? parseManualInput(manualText) : null;

  return (
    <div className="space-y-3">
      {/* Mode toggle */}
      <div className="flex gap-1">
        <button
          onClick={() => setMode('file')}
          className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
            mode === 'file'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:text-foreground'
          }`}
        >
          파일 업로드
        </button>
        <button
          onClick={() => setMode('manual')}
          className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
            mode === 'manual'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:text-foreground'
          }`}
        >
          직접 입력
        </button>
      </div>

      {mode === 'file' ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragOver
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-muted-foreground/50'
          }`}
        >
          <div className="space-y-3">
            <div className="text-4xl">📄</div>
            <div>
              <p className="font-medium">
                {fileName || '파일을 드래그하거나 클릭해서 업로드'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Excel (.xlsx, .xls) 또는 CSV 파일
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv,.tsv"
              onChange={handleFileInput}
              className="hidden"
            />
            <Button
              variant="outline"
              type="button"
              disabled={loading}
              onClick={() => fileInputRef.current?.click()}
            >
              {loading ? '업로드 중...' : '파일 선택'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="border rounded-lg p-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              한 줄에 한 명씩 입력하세요. 학번(생년), 이름, 성별을 공백/쉼표/탭으로 구분합니다.
            </p>
            <textarea
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder={`예시:\n97 홍길동 남\n98 김영희 여\n99 이철수 남\n\n또는 이름만:\n홍길동\n김영희\n이철수`}
              className="w-full h-48 p-3 border rounded-md text-sm font-mono resize-y bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {parsedPreview && parsedPreview.rows.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {parsedPreview.rows.length}명 인식됨
                {parsedPreview.columns.map((c) => c.name).join(', ')} 칼럼
              </p>
            )}
            <Button
              onClick={handleManualSubmit}
              disabled={loading || !parsedPreview || parsedPreview.rows.length === 0}
            >
              {loading ? '업로드 중...' : `${parsedPreview?.rows.length ?? 0}명 등록`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
