"use client";

import { useState, useEffect } from 'react';
import { subscribe, type Toast } from '@/lib/toast';

const COLORS: Record<string, string> = {
  error: 'bg-red-950 border-red-800 text-red-200',
  warning: 'bg-amber-950 border-amber-800 text-amber-200',
  success: 'bg-emerald-950 border-emerald-800 text-emerald-200',
  info: 'bg-zinc-900 border-zinc-700 text-zinc-200',
};

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => subscribe(setToasts), []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] space-y-2 max-w-sm">
      {toasts.map(t => (
        <div key={t.id} className={`px-4 py-3 rounded-lg border text-sm animate-in slide-in-from-bottom-2 ${COLORS[t.type]}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
