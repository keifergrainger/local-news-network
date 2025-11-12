'use client';
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export default function SearchBar() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [val, setVal] = useState(sp.get("q") || "");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const qs = new URLSearchParams(sp.toString());
      if (val.trim()) qs.set("q", val.trim());
      else qs.delete("q");
      qs.delete("page");
      router.push(`${pathname}?${qs.toString()}`);
    }, 500);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [val]); // eslint-disable-line react-hooks/exhaustive-deps

  function clear() {
    setVal("");
    const qs = new URLSearchParams(sp.toString());
    qs.delete("q"); qs.delete("page");
    router.push(`${pathname}?${qs.toString()}`);
  }

  return (
    <div className="flex items-center gap-2">
      <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="Search businesses (e.g., 'roasters', '24/7 plumber')"
        className="h-9 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 text-sm text-gray-100 placeholder-gray-500 outline-none focus:ring-2 focus:ring-blue-600"
        aria-label="Search businesses"
      />
      <button className="btn btn-ghost btn-sm whitespace-nowrap" onClick={clear} aria-label="Clear search">Clear</button>
    </div>
  );
}

