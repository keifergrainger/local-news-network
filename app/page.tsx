'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Calendar from '@/components/Calendar';
import SubmitEventModal from '@/components/SubmitEventModal';
import { getCityFromHost } from '@/lib/cities';
import EventsFromJson from '../components/EventsFromJson';

export default function HomePage() {
  const [host, setHost] = useState('');
  useEffect(() => {
    if (typeof window !== 'undefined') setHost(window.location.hostname);
  }, []);
  const city = getCityFromHost(host);

  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitDate, setSubmitDate] = useState<string | null>(null);

  const openSubmit = useCallback((ymd?: string | null) => {
    setSubmitDate(ymd ?? null);
    setSubmitOpen(true);
  }, []);

  const closeSubmit = useCallback(() => {
    setSubmitOpen(false);
    setSubmitDate(null);
  }, []);

  const handleViewEvents = useCallback(() => {
    const el = document.getElementById('calendar-section');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const heroBackground = useMemo(
    () => ({ backgroundImage: `url(${city.heroImage})` }),
    [city.heroImage],
  );

  const businesses = useMemo(
    () => [
      {
        name: 'Beehive Roofing Co.',
        category: 'Roofing',
        blurb: 'Licensed roof repair and replacements across the Wasatch Front.',
        website: 'https://example.com/roofing',
      },
      {
        name: 'Great Salt HVAC',
        category: 'Heating & Cooling',
        blurb: '24/7 HVAC service, installations, and seasonal tune-ups.',
        website: 'https://example.com/hvac',
      },
      {
        name: 'Wasatch Electric Pros',
        category: 'Electricians',
        blurb: 'Commercial and residential electricians with emergency availability.',
        website: 'https://example.com/electric',
      },
      {
        name: 'Jordan River Landscaping',
        category: 'Landscaping',
        blurb: 'Yard design, maintenance, and snow removal for Salt Lake neighborhoods.',
        website: 'https://example.com/landscaping',
      },
      {
        name: 'Summit Realty Group',
        category: 'Real Estate',
        blurb: 'Buy, sell, or invest with agents focused on Salt Lake County.',
        website: 'https://example.com/real-estate',
      },
      {
        name: 'Pioneer Auto Care',
        category: 'Auto Repair',
        blurb: 'Trusted mechanics for inspections, brakes, and everyday repairs.',
        website: 'https://example.com/auto',
      },
    ],
    [],
  );

  return (
    <div className="pb-12">
      <section className="relative mb-10 overflow-hidden rounded-3xl border border-slate-800">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-slate-950/60" />
          <div className="h-full w-full bg-cover bg-center" style={heroBackground} />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/70 to-slate-900/10" />
        </div>
        <div className="relative flex flex-col gap-6 px-6 py-12 sm:px-10 md:flex-row md:items-center md:justify-between md:py-16">
          <div className="max-w-2xl">
            <h1 className="text-3xl font-bold text-white sm:text-4xl">
              {city.city}, {city.state} — Local News & Events
            </h1>
            <p className="mt-3 text-base text-slate-200 sm:text-lg">
              {city.tagline}
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={handleViewEvents}
                className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-900/40 transition hover:bg-blue-500"
              >
                View Events
              </button>
              <button
                type="button"
                onClick={() => openSubmit(null)}
                className="inline-flex items-center justify-center rounded-xl border border-slate-200/30 bg-slate-900/60 px-5 py-2.5 text-sm font-semibold text-slate-100 transition hover:border-slate-200/50 hover:bg-slate-900"
              >
                Submit Your Event
              </button>
            </div>
          </div>
          <div className="hidden max-w-xs rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-sm text-slate-200 shadow-lg shadow-slate-950/50 md:block">
            <p className="font-semibold text-slate-100">Quick links</p>
            <ul className="mt-2 space-y-1">
              <li><a className="hover:underline" href="/news">Local News Feed</a></li>
              <li><a className="hover:underline" href="/events">Full Events Calendar</a></li>
              <li><a className="hover:underline" href="/businesses">Business Directory</a></li>
            </ul>
          </div>
        </div>
      </section>

      <Calendar id="calendar-section" onRequestSubmitEvent={() => openSubmit(null)} />

      <section className="mt-10 rounded-3xl border border-slate-800 bg-slate-950/60 p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-white">Top Local Services</h2>
            <p className="text-sm text-slate-300">
              Trusted Salt Lake City businesses ready to help with home projects, repairs, and more.
            </p>
          </div>
          <a
            href="/businesses"
            className="text-sm font-medium text-blue-300 hover:text-blue-200"
          >
            Browse full directory →
          </a>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {businesses.map((biz) => (
            <div key={biz.name} className="flex h-full flex-col justify-between rounded-2xl border border-slate-800/80 bg-slate-900/70 p-4 shadow-sm">
              <div>
                <div className="text-xs uppercase tracking-wide text-blue-200">{biz.category}</div>
                <h3 className="mt-1 text-lg font-semibold text-white">{biz.name}</h3>
                <p className="mt-2 text-sm text-slate-300">{biz.blurb}</p>
              </div>
              <div className="mt-4">
                <a
                  href={biz.website}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center rounded-lg bg-blue-600/90 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-500"
                >
                  Visit Website
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="card">
          <h2 className="mb-2 text-xl font-semibold">Latest News</h2>
          <p className="text-sm text-gray-300">
            Catch daily stories from Salt Lake City journalists and official city updates.
          </p>
          <a href="/news" className="mt-3 inline-flex text-sm font-medium text-blue-300 hover:text-blue-200">
            Go to News →
          </a>
        </div>
        <div className="card">
          <h2 className="mb-2 text-xl font-semibold">Advertise With Us</h2>
          <p className="text-sm text-gray-300">
            Promote your event or sponsor featured placements across our local network.
          </p>
          <a href="/advertise" className="mt-3 inline-flex text-sm font-medium text-blue-300 hover:text-blue-200">
            See options →
          </a>
        </div>
      </section>

      <section className="card mt-8">
        <h2 className="mb-3 text-xl font-semibold">Our Other City Sites</h2>
        <p className="text-sm text-gray-300">Crosslink all sites in your footer to pass authority.</p>
        <ul className="mt-3 grid gap-2 text-sm md:grid-cols-2">
          {["saltlakeut.com","irmosc.com","caycesc.com","elizabethnc.com","fresnoca.org","indioca.com","kahuluihi.com","perrisca.com"].map((h) => (
            <li key={h}>
              <a className="nav-link" href={`https://${h}`} target="_blank" rel="noreferrer">
                {h}
              </a>
            </li>
          ))}
        </ul>
      </section>

      <SubmitEventModal open={submitOpen} onClose={closeSubmit} defaultDate={submitDate ?? undefined} />
    </div>
  );
}

<EventsFromJson year={2025} month={11} />
