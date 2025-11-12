'use client';
import React from "react";
import EventsFromJson from "@/components/EventsFromJson";

export default function Page() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth()+1;
  return (
    <main className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Events (from public/events.json)</h1>
      <EventsFromJson year={year} month={month} />
    </main>
  );
}

