'use client';
import React from "react";

type Item = {
  id?: string; title?: string; start?: string; end?: string | null;
  url?: string | null; venue?: string | null; address?: string | null;
};

const fmt = (s?: string) => { try { return s ? new Date(s).toLocaleString() : ""; } catch { return s || ""; } };

export default function EventsFromJson({ year, month }:{ year:number; month:number }) {
  const [items, setItems] = React.useState<Item[]>([]);
  React.useEffect(() => {
    fetch("/events.json").then(r => r.json()).then(d => setItems(Array.isArray(d) ? d as Item[] : [])).catch(() => setItems([]));
  }, []);
  const filtered = items.filter(i => {
    if (!i?.start) return false;
    const d = new Date(i.start);
    return d.getUTCFullYear() === year && (d.getUTCMonth()+1) === month;
  });
  if (filtered.length === 0) return <div>No events found in JSON.</div>;
  return (
    <div className="space-y-3">
      {filtered.map((e, i) => (
        <div key={e.id ?? i} className="border rounded p-3">
          <div className="font-medium">
            {e.url ? <a href={e.url} target="_blank" rel="noreferrer" className="underline">{e.title}</a> : e.title}
          </div>
          <div className="text-sm opacity-75">{fmt(e.start)}{e.end ? " – " + fmt(e.end) : ""}</div>
          {e.venue ? <div className="text-sm">{e.venue}</div> : null}
          {e.address ? <div className="text-xs opacity-70">{e.address}</div> : null}
        </div>
      ))}
    </div>
  );
}

