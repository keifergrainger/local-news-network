'use client';
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const CATEGORIES = [
  "Coffee","Restaurants","Plumbers","HVAC","Electricians","Bars","Gyms","Landscapers","Pest Control","Real Estate",
];

export default function CategoryChips() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const active = sp.get("category") || "Coffee";

  function setCategory(cat: string) {
    const qs = new URLSearchParams(sp.toString());
    qs.set("category", cat);
    qs.delete("page");
    router.push(`${pathname}?${qs.toString()}`);
  }

  return (
    <div className="scrollbar-hide flex gap-2 overflow-x-auto py-1">
      {CATEGORIES.map((cat) => {
        const isActive = active === cat;
        return (
          <button
            key={cat}
            className={`chip whitespace-nowrap ${isActive ? "chip-active" : ""}`}
            onClick={() => setCategory(cat)}
            aria-pressed={isActive}
          >
            {cat}
          </button>
        );
      })}
    </div>
  );
}

