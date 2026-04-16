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

export default function FileUpload({ onUpload, loading }: FileUploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    (file: File) => {
      setFileName(file.name);
      const ext = file.name.split('.').pop()?.toLowerCase();

      if (ext === 'csv' || ext === 'tsv') {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete(results) {
            const { rows, columns } = parseToRows(
              results.data as Record<string, string>[]
            );
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
          const rawRows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
            defval: '',
            raw: false,
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

  return (
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
  );
}
