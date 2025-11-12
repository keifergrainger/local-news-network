'use client';
import Image from "next/image";
import { Business } from "@/types/business";

function starStr(r?: number) {
  if (typeof r !== "number") return "";
  const rounded = Math.round(r * 10) / 10;
  return `⭐ ${rounded}`;
}
function initials(name?: string) {
  const n = (name || "").trim();
  if (!n) return "?";
  const p = n.split(/\s+/);
  return (p[0][0] + (p[1]?.[0] || "")).toUpperCase();
}

export default function BusinessCard({ b }: { b: Business }) {
  const mapUrl =
    b.lat != null && b.lng != null
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${b.lat},${b.lng}`)}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${b.name || ""} ${b.address || ""}`)}`;

  const claimHref = `mailto:support@saltlakeut.com?subject=${encodeURIComponent(
    "Claim Listing: " + b.name
  )}&body=${encodeURIComponent(
    `Name: ${b.name}\nWebsite: ${b.website || ""}\nAddress: ${b.address || ""}\nSource: ${b.source}\n`
  )}`;

  const img = b.photoUrl ? `/api/image-proxy?url=${encodeURIComponent(b.photoUrl)}` : "";

  return (
    <article className="group overflow-hidden rounded-2xl border border-gray-800 bg-gray-950 shadow-sm transition hover:shadow-md focus-within:shadow-md">
      <div className="relative h-40 w-full">
        {img ? (
          <Image src={img} alt={`Photo of ${b.name}`} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-slate-700/50 text-2xl font-bold text-slate-300">
              {initials(b.name)}
            </div>
          </div>
        )}
        {b.openNow != null && (
          <span className={`absolute left-2 top-2 rounded-full px-2 py-1 text-xs ${b.openNow ? "bg-emerald-600/80 text-white" : "bg-gray-700/80 text-gray-100"}`}>
            {b.openNow ? "Open now" : "Closed"}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2 p-3">
        <h3 className="line-clamp-1 text-base font-semibold text-gray-100">{b.name}</h3>

        {(b.rating != null || b.reviewCount != null) && (
          <div className="text-sm text-gray-300">
            {b.rating != null && <span className="mr-2">{starStr(b.rating)}</span>}
            {b.reviewCount != null && <span>({b.reviewCount})</span>}
          </div>
        )}

        <p className="line-clamp-1 text-sm text-gray-400">{b.address || "&mdash;"}</p>

        <div className="mt-1 flex items-center gap-2">
          <a
            href={b.website || mapUrl}
            target="_blank"
            rel="noreferrer"
            className="btn btn-primary whitespace-nowrap"
            aria-label={`Visit website of ${b.name}`}
          >
            Visit Website
          </a>
          <a
            href={mapUrl}
            target="_blank"
            rel="noreferrer"
            className="btn btn-ghost whitespace-nowrap"
            aria-label={`View ${b.name} on map`}
          >
            View on Map
          </a>
          <a href={claimHref} className="ml-auto text-xs text-gray-400 underline-offset-2 hover:underline">
            Claim this listing
          </a>
        </div>
      </div>
    </article>
  );
}


