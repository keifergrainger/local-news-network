'use client';
import TopTicker from "@/app/_components/TopTicker";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <div className="p-4">
      <TopTicker />
      <div className="mt-6 text-sm text-gray-400">
        Debug page: The marquee above interleaves 2 news items with 1 weather chip. It auto-refreshes every 60s.
      </div>
    </div>
  );
}

