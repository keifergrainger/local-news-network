'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';

const DEFAULT_CATEGORIES = [
  'Coffee', 'Restaurants', 'Plumbers', 'HVAC', 'Electricians',
  'Bars', 'Gyms', 'Landscapers', 'Pest Control', 'Real Estate',
];

export default function CategoryChips({ categories = DEFAULT_CATEGORIES }: { categories?: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const active = sp.get('category') || 'Coffee';

  const qs = useMemo(() => new URLSearchParams(sp.toString()), [sp]);

  function setCategory(cat: string) {
    qs.set('category', cat);
    qs.delete('page'); // reset pagination
    router.push(`${pathname}?${qs.toString()}`);
  }

  return (
    <div className="flex items-center gap-2 overflow-x-auto py-2">
      {categories.map((c) => {
        const isActive = c === active;
        return (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`flex-shrink-0 rounded-full px-3 py-1 text-sm border transition
              ${isActive ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-700 text-gray-200 hover:bg-gray-800'}`}
            aria-pressed={isActive}
            aria-label={`Filter category ${c}`}
          >
            {c}
          </button>
        );
      })}
    </div>
  );
}
