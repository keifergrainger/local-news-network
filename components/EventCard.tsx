'use client';
export type LocalEvent = {
  id: string;
  title: string;
  start: string;     // ISO
  end?: string;      // ISO
  venue?: string;
  address?: string;
  source?: string;   // "Eventbrite" | "Ticketmaster" | "ICS"
  url?: string;
  free?: boolean;
};

export default function EventCard({ e }: { e: LocalEvent }) {
  const date = new Date(e.start);
  const end = e.end ? new Date(e.end) : undefined;
  const when =
    end && end.toDateString() !== date.toDateString()
      ? `${date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })} – ${end.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`
      : `${date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`;

  return (
    <a
      href={e.url || '#'}
      target={e.url ? "_blank" : undefined}
      rel={e.url ? "noopener noreferrer" : undefined}
      className="block card hover:bg-gray-900/90 transition"
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="badge">{e.source || 'Local'}</span>
          {e.free && <span className="badge">Free</span>}
        </div>
        <h3 className="text-base md:text-lg font-semibold text-white line-clamp-2">{e.title}</h3>
        <div className="text-sm text-gray-300">{when}</div>
        {(e.venue || e.address) && (
          <div className="text-sm text-gray-400">
            {e.venue}{e.venue && e.address ? ' — ' : ''}{e.address}
          </div>
        )}
      </div>
    </a>
  );
}

