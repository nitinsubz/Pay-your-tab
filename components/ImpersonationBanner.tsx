'use client';

import { useRouter } from 'next/navigation';
import { useEffectiveAuth } from '@/lib/impersonation';

/**
 * Floating reminder that the current session is acting as someone else.
 * Rendered from the root layout so it follows you onto every page.
 */
export function ImpersonationBanner() {
  const router = useRouter();
  const { impersonating, stopImpersonating } = useEffectiveAuth();

  if (!impersonating) return null;

  const label = impersonating.displayName || impersonating.email || impersonating.uid;

  const handleExit = () => {
    stopImpersonating();
    router.push('/admin');
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] px-4 w-full max-w-md">
      <div className="flex items-center gap-3 rounded-2xl bg-amber-500 text-white shadow-lg shadow-amber-500/25 px-4 py-2.5">
        <span className="text-base leading-none" aria-hidden>👁️</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-100">Viewing as</p>
          <p className="text-sm font-medium truncate">{label}</p>
        </div>
        <button
          onClick={handleExit}
          className="shrink-0 bg-white/20 hover:bg-white/30 text-white text-sm font-medium px-3 py-1.5 rounded-xl transition-colors"
        >
          Exit
        </button>
      </div>
    </div>
  );
}
