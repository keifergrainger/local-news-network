'use client';

import { FormEvent, useEffect, useState } from 'react';

type SubmitEventModalProps = {
  open: boolean;
  onClose: () => void;
  defaultDate?: string | null;
};

type FormState = {
  name: string;
  dateTime: string;
  location: string;
  link: string;
  email: string;
};

const emptyForm: FormState = {
  name: '',
  dateTime: '',
  location: '',
  link: '',
  email: '',
};

export default function SubmitEventModal({ open, onClose, defaultDate }: SubmitEventModalProps) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStatus('idle');
    setMessage(null);
    setForm({
      ...emptyForm,
      dateTime: defaultDate ? `${defaultDate}T18:00` : '',
    });
  }, [open, defaultDate]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('sending');
    setMessage(null);

    try {
      const res = await fetch('/api/event-submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          dateTime: form.dateTime,
          location: form.location,
          link: form.link,
          email: form.email,
        }),
      });

      if (!res.ok) throw new Error('submit_failed');
      setStatus('success');
      setMessage("Thanks! We'll review your submission.");
      setForm(emptyForm);
    } catch (err) {
      console.error('event submit failed', err);
      setStatus('error');
      setMessage('Sorry, we could not send that. Please try again shortly.');
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-950">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
          <h2 className="text-lg font-semibold text-gray-100">Submit Your Event</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-transparent p-1 text-gray-300 hover:border-slate-700 hover:bg-slate-800"
            aria-label="Close submit event form"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          <label className="block text-sm">
            <span className="mb-1 block text-gray-300">Event name</span>
            <input
              required
              type="text"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-gray-100 outline-none focus:border-blue-500"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-gray-300">Date &amp; time</span>
            <input
              required
              type="datetime-local"
              value={form.dateTime}
              onChange={(e) => update('dateTime', e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-gray-100 outline-none focus:border-blue-500"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-gray-300">Location / address</span>
            <input
              required
              type="text"
              value={form.location}
              onChange={(e) => update('location', e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-gray-100 outline-none focus:border-blue-500"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-gray-300">Event link <span className="text-xs text-gray-500">(optional)</span></span>
            <input
              type="url"
              value={form.link}
              onChange={(e) => update('link', e.target.value)}
              placeholder="https://"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-gray-100 outline-none focus:border-blue-500"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-gray-300">Contact email <span className="text-xs text-gray-500">(optional)</span></span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-gray-100 outline-none focus:border-blue-500"
            />
          </label>

          {message && (
            <p
              className={`rounded-lg px-3 py-2 text-sm ${
                status === 'success'
                  ? 'border border-green-700 bg-green-900/20 text-green-200'
                  : status === 'error'
                  ? 'border border-red-700 bg-red-900/30 text-red-200'
                  : 'text-gray-300'
              }`}
            >
              {message}
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-gray-300 transition hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={status === 'sending'}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status === 'sending' ? 'Sending…' : 'Submit for Review'}
            </button>
          </div>
        </form>

        <p className="border-t border-slate-800 px-5 py-3 text-xs text-slate-500">
          Submissions are reviewed by our editors before appearing on the public calendar.
        </p>
      </div>
    </div>
  );
}
