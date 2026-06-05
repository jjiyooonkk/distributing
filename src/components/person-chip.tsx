'use client';

import { useDraggable } from '@dnd-kit/core';
import type { PersonRow, ColumnMeta } from '@/types';

interface PersonChipProps {
  person: PersonRow;
  columns: ColumnMeta[];
  overlay?: boolean;
  role?: string | null; // "조장" | "부조장" | "고정"
}

function getGenderStyle(person: PersonRow, columns: ColumnMeta[]): string {
  for (const col of columns) {
    if (['성별', 'gender', 'Gender', '성'].includes(col.name)) {
      const val = (person[col.name] || '').trim();
      if (['여', '여자', 'F', 'f', 'Female', 'female'].includes(val))
        return 'border-pink-300 bg-pink-50';
      if (['남', '남자', 'M', 'm', 'Male', 'male'].includes(val))
        return 'border-sky-300 bg-sky-50';
    }
  }
  return 'bg-card';
}

export default function PersonChip({ person, columns, overlay, role }: PersonChipProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: person.id,
  });

  const display = columns
    .map((c) => person[c.name])
    .filter(Boolean)
    .join(' / ');

  const genderStyle = overlay ? '' : getGenderStyle(person, columns);

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      {...(overlay ? {} : { ...listeners, ...attributes })}
      className={`inline-flex items-center px-2.5 py-1 rounded-md text-sm border cursor-grab active:cursor-grabbing select-none transition-opacity ${
        isDragging ? 'opacity-30' : 'opacity-100'
      } ${overlay ? 'bg-primary text-primary-foreground shadow-lg' : `hover:bg-accent ${genderStyle}`}`}
    >
      {role && (
        <span className={`mr-1 text-xs font-semibold ${role === '조장' ? 'text-amber-600' : role === '부조장' ? 'text-blue-600' : 'text-emerald-600'}`}>
          {role === '조장' ? '★' : role === '부조장' ? '☆' : '◆'}
        </span>
      )}
      {display || person.id.slice(0, 4)}
    </div>
  );
}
