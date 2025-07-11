"use client";

import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { useAppStore } from '@/lib/store';

const DynamicCanvas = dynamic(() => import('@/components/canvas').then(mod => ({ default: mod.Canvas })), { 
  ssr: false 
});

export default function Home() {
  const { saveToHistory } = useAppStore();

  useEffect(() => {
    // Save initial state to history
    saveToHistory();
  }, [saveToHistory]);

  return (
    <main className="w-full h-screen relative bg-gray-50 dark:bg-[#0a0a0a]">
      <DynamicCanvas />
    </main>
  );
}