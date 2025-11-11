'use client';
import Link from 'next/link';
import { getCityFromHost } from '@/lib/cities';
import { useEffect, useState } from 'react';
export default function Header(){
  const [host,setHost]=useState('');
  useEffect(()=>{ if(typeof window!=='undefined') setHost(window.location.hostname); },[]);
  const city=getCityFromHost(host);
  return (<header className="border-b border-gray-800 sticky top-0 z-40 backdrop-blur bg-black/30">
    <div className="container flex items-center justify-between h-16">
      <Link href="/" className="text-lg font-semibold"><span className="text-accent">{city.city}</span> {city.state}</Link>
      <nav className="flex items-center gap-5">
        <Link className="nav-link" href="/news">News</Link>
        <Link className="nav-link" href="/events">Events</Link>
        <Link className="nav-link" href="/submit">Submit</Link>
        <Link className="nav-link" href="/advertise">Advertise</Link>
      </nav>
    </div>
  </header>);
}
