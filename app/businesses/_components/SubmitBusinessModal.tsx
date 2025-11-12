'use client';
import { useState } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
};

const CATS = [
  'Coffee', 'Restaurants', 'Plumbers', 'HVAC', 'Electricians',
  'Bars', 'Gyms', 'Landscapers', 'Pest Control', 'Real Estate',
];

export default function SubmitBusinessModal({ open, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (!open) return null;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true); setOk(null); setErr(null);
    const fd = new FormData(e.currentTarget);
    const payload = Object.fromEntries(fd.entries());
    try {
      const r = await fetch('/api/submit-business', { method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' } });
      if (r.ok) {
        setOk('Thanks! We received your submission.');
        (e.target as HTMLFormElement).reset();
      } else {
        setErr('Submit failed. Please try again later.');
      }
    } catch {
      setErr('Submit failed. Please try again later.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-gray-800 bg-gray-950 p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-100">Submit Your Business</h2>
          <button onClick={onClose} className="rounded-md border border-gray-700 px-2 py-1 text-sm hover:bg-gray-800" aria-label="Close">✕</button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm text-gray-300">Business Name</label>
            <input name="name" required className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-300">Category</label>
            <select name="category" className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100">
              {CATS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-300">Website</label>
            <input name="website" type="url" placeholder="https://..." className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-300">Address</label>
            <input name="address" className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-300">Email</label>
            <input name="email" type="email" required className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100" />
          </div>

          {ok && <p className="text-sm text-emerald-400">{ok}</p>}
          {err && <p className="text-sm text-red-400">{err}</p>}

          <button disabled={loading} className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-500 disabled:opacity-60">
            {loading ? 'Submitting…' : 'Submit'}
          </button>
        </form>
      </div>
    </div>
  );
}


