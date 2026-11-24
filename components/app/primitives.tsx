'use client';

import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatMoney, initials } from '@/lib/format';

/* ------------------------------------------------------------- avatars */

const TONES = [
  'bg-indigo-50 text-indigo-600 ring-indigo-100',
  'bg-emerald-50 text-emerald-600 ring-emerald-100',
  'bg-amber-50 text-amber-700 ring-amber-100',
  'bg-rose-50 text-rose-600 ring-rose-100',
  'bg-sky-50 text-sky-600 ring-sky-100',
  'bg-violet-50 text-violet-600 ring-violet-100',
  'bg-teal-50 text-teal-600 ring-teal-100',
  'bg-orange-50 text-orange-600 ring-orange-100',
];

export function toneFor(name: string): string {
  let h = 0;
  const key = name.trim().toLowerCase();
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return TONES[h % TONES.length];
}

const AVATAR_SIZES = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-7 w-7 text-[11px]',
  md: 'h-9 w-9 text-[13px]',
  lg: 'h-11 w-11 text-sm',
} as const;

export function Avatar({
  name,
  size = 'sm',
  className,
}: {
  name: string;
  size?: keyof typeof AVATAR_SIZES;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold ring-1',
        AVATAR_SIZES[size],
        toneFor(name),
        className
      )}
    >
      {initials(name)}
    </span>
  );
}

export function AvatarStack({ names, max = 4 }: { names: string[]; max?: number }) {
  if (names.length === 0) return null;
  const shown = names.slice(0, max);
  const extra = names.length - shown.length;
  return (
    <div className="flex items-center -space-x-1.5" aria-label={names.join(', ')}>
      {shown.map((n) => (
        <Avatar key={n} name={n} size="xs" className="ring-2 ring-white" />
      ))}
      {extra > 0 && (
        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-gray-100 px-1.5 text-[10px] font-semibold text-gray-500 ring-2 ring-white">
          +{extra}
        </span>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- money */

export function Money({
  amount,
  className,
  creditClassName = 'text-sky-600',
}: {
  amount: number;
  className?: string;
  creditClassName?: string;
}) {
  return (
    <span className={cn('tabular-nums', className, amount < 0 && creditClassName)}>
      {formatMoney(amount)}
    </span>
  );
}

/* ---------------------------------------------------------- containers */

export function Panel({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-3xl border border-gray-100 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function SectionHeader({
  title,
  count,
  action,
  className,
}: {
  title: React.ReactNode;
  count?: number;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-3 flex items-center gap-2 px-1', className)}>
      <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400">{title}</h2>
      {count !== undefined && count > 0 && (
        <span className="rounded-full bg-gray-200/70 px-1.5 py-px text-[11px] font-semibold tabular-nums text-gray-500">
          {count}
        </span>
      )}
      <div className="ml-1 h-px flex-1 bg-gray-200/70" />
      {action}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  children,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-3xl border border-dashed border-gray-200 bg-white/60 px-6 py-12 text-center',
        className
      )}
    >
      {icon && (
        <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-900 text-white [&_svg]:h-5 [&_svg]:w-5">
          {icon}
        </span>
      )}
      <h3 className="text-[17px] font-semibold tracking-tight text-gray-900">{title}</h3>
      {children && <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-gray-500">{children}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

/* -------------------------------------------------------------- status */

export function ProgressBar({
  value,
  className,
  tone = 'brand',
}: {
  value: number;
  className?: string;
  tone?: 'brand' | 'emerald';
}) {
  const pct = Math.max(0, Math.min(100, value * 100));
  return (
    <div
      className={cn('h-1.5 overflow-hidden rounded-full bg-gray-100', className)}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn(
          'h-full rounded-full transition-[width] duration-700 ease-out',
          tone === 'brand'
            ? 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500'
            : 'bg-emerald-500'
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function PaidPill({ paid, className }: { paid: boolean; className?: string }) {
  return paid ? (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700',
        className
      )}
    >
      <Check className="h-3 w-3" strokeWidth={3} />
      Paid
    </span>
  ) : (
    <span
      className={cn(
        'inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500',
        className
      )}
    >
      Unpaid
    </span>
  );
}

/* --------------------------------------------------------------- forms */

export const inputClass =
  'block w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-[15px] text-gray-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none transition placeholder:text-gray-400 hover:border-gray-300 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500';

export function Field({
  label,
  hint,
  htmlFor,
  optional,
  children,
  className,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  htmlFor?: string;
  optional?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline gap-2 text-sm font-medium text-gray-900">
        {label}
        {optional && <span className="text-xs font-normal text-gray-400">Optional</span>}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-[13px] leading-relaxed text-gray-500">{hint}</p>}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  id,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  id?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:ring-offset-2',
        checked ? 'bg-indigo-600' : 'bg-gray-200'
      )}
    >
      <span
        className={cn(
          'inline-block h-5 w-5 rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-[22px]' : 'translate-x-0.5'
        )}
      />
    </button>
  );
}

/* ------------------------------------------------------------- loading */

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        'inline-block h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-indigo-500',
        className
      )}
    />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-gray-200/60', className)} />;
}

/* --------------------------------------------------------------- toast */

type ToastState = { id: number; text: string; tone: 'success' | 'error' } | null;

/** Tiny single-slot toast: `const { toast, show } = useToast()` then render `<Toast toast={toast} />`. */
export function useToast(duration = 2200) {
  const [toast, setToast] = React.useState<ToastState>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = React.useCallback(
    (text: string, tone: 'success' | 'error' = 'success') => {
      if (timer.current) clearTimeout(timer.current);
      setToast({ id: Date.now(), text, tone });
      timer.current = setTimeout(() => setToast(null), duration);
    },
    [duration]
  );
  React.useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  return { toast, show };
}

export function Toast({ toast }: { toast: ToastState }) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-6 z-[90] flex justify-center px-4"
    >
      {toast && (
        <div
          key={toast.id}
          className="tw-app-rise inline-flex items-center gap-2 rounded-full bg-gray-900 px-4 py-2.5 text-sm font-medium text-white shadow-[0_12px_32px_-12px_rgba(15,23,42,0.6)]"
        >
          {toast.tone === 'success' ? (
            <Check className="h-4 w-4 text-emerald-400" strokeWidth={3} />
          ) : (
            <span aria-hidden className="h-2 w-2 rounded-full bg-red-400" />
          )}
          {toast.text}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------- clipboard */

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const el = document.createElement('textarea');
      el.value = text;
      el.setAttribute('readonly', '');
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(el);
      return ok;
    } catch {
      return false;
    }
  }
}
