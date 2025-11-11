export default function SubmitPage(){
  return (<div className="py-8">
    <h1 className="text-3xl font-bold mb-4">Submit Your Event</h1>
    <div className="card">
      <p className="text-gray-300 text-sm mb-4">Phase 1: This form uses Netlify Forms. Replace with Google Forms or a backend later.</p>
      <form name="event" method="POST" data-netlify="true" className="grid gap-4 max-w-xl">
        <input type="hidden" name="form-name" value="event" />
        <input className="p-3 rounded-xl bg-gray-800 border border-gray-700" name="name" placeholder="Your name" required />
        <input className="p-3 rounded-xl bg-gray-800 border border-gray-700" name="email" placeholder="Email" type="email" required />
        <input className="p-3 rounded-xl bg-gray-800 border border-gray-700" name="title" placeholder="Event title" required />
        <input className="p-3 rounded-xl bg-gray-800 border border-gray-700" name="date" placeholder="Date & time (e.g., Dec 12, 7:00 PM)" required />
        <input className="p-3 rounded-xl bg-gray-800 border border-gray-700" name="address" placeholder="Address" required />
        <input className="p-3 rounded-xl bg-gray-800 border border-gray-700" name="source" placeholder="Link to event page (optional)" />
        <textarea className="p-3 rounded-xl bg-gray-800 border border-gray-700" name="details" placeholder="Details" rows={4} />
        <button className="btn" type="submit">Submit</button>
      </form>
    </div>
  </div>);
}
