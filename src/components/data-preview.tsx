'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { PersonRow, ColumnMeta } from '@/types';

interface DataPreviewProps {
  rows: PersonRow[];
  columns: ColumnMeta[];
}

export default function DataPreview({ rows, columns }: DataPreviewProps) {
  if (rows.length === 0) return null;

  const displayRows = rows.slice(0, 50);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>총 {rows.length}명</span>
        <span>|</span>
        <span>{columns.length}개 칼럼</span>
        {rows.length > 50 && <span>| 처음 50명만 미리보기</span>}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {columns.map((col) => (
          <Badge key={col.name} variant="secondary">
            {col.name}
            <span className="ml-1 text-muted-foreground">({col.type})</span>
          </Badge>
        ))}
      </div>

      <div className="border rounded-lg overflow-auto max-h-[400px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              {columns.map((col) => (
                <TableHead key={col.name}>{col.name}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayRows.map((row, i) => (
              <TableRow key={row.id}>
                <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                {columns.map((col) => (
                  <TableCell key={col.name}>{row[col.name]}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
