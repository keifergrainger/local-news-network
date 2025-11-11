'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export default function SearchBar() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [value, setValue] = useState(sp.get('q') || '');

  const qs = useMemo(() => new URLSearchParams(sp.toString()), [sp]);
  const timer = useRef<any>(null);

  useEffect(() => {
    setValue(sp.get('q') || '');
  }, [sp]);

  function apply(v: string) {
    if (v) qs.set('q', v); else qs.delete('q');
    qs.delete('page');
    router.push(`${pathname}?${qs.toString()}`);
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setValue(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => apply(v), 500); // debounce 500ms
  }

  function clear() {
    setValue('');
    apply('');
  }

  return (
    <div className="flex w-full items-center gap-2">
      <input
        aria-label="Search businesses"
        placeholder="Search businesses (e.g., 'roasters', '24/7 plumber')"
        className="w-full rounded-xl border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
        value={value}
        onChange={onChange}
      />
      {value ? (
        <button onClick={clear} className="rounded-lg border border-gray-700 px-3 py-2 text-sm hover:bg-gray-800" aria-label="Clear search">Clear</button>
      ) : null}
    </div>
  );
}
