'use client';
import EventsFromJson from "../components/EventsFromJson";
import Link from 'next/link';
import { getCityFromHost } from '@/lib/cities';
import { useEffect, useState } from 'react';
import Calendar from '@/components/Calendar';

export default function HomePage() {
  const [host, setHost] = useState('');
  useEffect(() => { if (typeof window !== 'undefined') setHost(window.location.hostname); }, []);
  const city = getCityFromHost(host);

  return (
    <div className="py-8">
      {/* Hero */}
      <section className="rounded-2xl overflow-hidden border border-gray-800 mb-8">
        <div
          className="h-[240px] md:h-[360px] w-full bg-cover bg-center"
          style={{ backgroundImage: `url(${city.heroImage})` }}
        />
        <div className="p-6 md:p-8 bg-gradient-to-b from-black/20 to-black/60">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            {city.city}, {city.state} — Local News & Events
          </h1>
          <p className="text-gray-300 max-w-3xl">{city.tagline}</p>
          <div className="mt-4 flex gap-3">
            <Link href="/events" className="btn">View Events</Link>
            <Link href="/submit" className="btn bg-gray-700 hover:bg-gray-600">Submit Your Event</Link>
          </div>
        </div>
      </section>

      {/* ⬇️ Calendar goes here ABOVE the three cards */}
      <Calendar />

      {/* Three cards */}
      <section className="mt-8 md:mt-12 grid md:grid-cols-3 gap-6">
        <div className="card">
          <h2 className="text-xl font-semibold mb-3">Top Local Services</h2>
          <ul className="text-sm space-y-2 text-gray-300">
            <li>• Roofing • HVAC • Electricians • Landscapers</li>
            <li>• Real Estate • Pest Control • Auto Repair</li>
            <li className="text-gray-400">Add featured businesses on /advertise</li>
          </ul>
        </div>

        <div className="card">
          <h2 className="text-xl font-semibold mb-3">Latest News</h2>
          <p className="text-gray-300 text-sm">
            Post daily updates under <b>/news</b>. You can automate later.
          </p>
          <a href="/news" className="nav-link mt-2 inline-block">Go to News →</a>
        </div>

        <div className="card">
          <h2 className="text-xl font-semibold mb-3">Advertise</h2>
          <p className="text-gray-300 text-sm">
            Promote events or sponsor posts across this city, or bundle multiple cities.
          </p>
          <a href="/advertise" className="nav-link mt-2 inline-block">See options →</a>
        </div>
      </section>

      {/* Other city sites */}
      <section className="card mt-6">
        <h2 className="text-xl font-semibold mb-3">Our Other City Sites</h2>
        <p className="text-sm text-gray-300">Crosslink all sites in your footer to pass authority.</p>
        <ul className="grid md:grid-cols-2 gap-2 mt-3 text-sm">
          {[
            "saltlakeut.com",
            "irmosc.com",
            "caycesc.com",
            "elizabethnc.com",
            "fresnoca.org",
            "indioca.com",
            "kahuluihi.com",
            "perrisca.com",
          ].map((h) => (
            <li key={h}>
              <a className="nav-link" href={`https://${h}`} target="_blank" rel="noreferrer">
                {h}
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

<EventsFromJson year={2025} month={11} />


