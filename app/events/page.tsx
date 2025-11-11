export default function EventsPage(){
  return (<div className="py-8">
    <h1 className="text-3xl font-bold mb-4">Events</h1>
    <div className="card">
      <p className="text-gray-300 text-sm">Phase 1: List events manually or embed a Google Calendar. Phase 2: auto-ingest from Eventbrite/Ticketmaster.</p>
      <div className="mt-4 grid md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl border border-gray-800">
          <div className="badge">Nov 25 • 7:00 PM</div>
          <h3 className="text-lg font-semibold mt-2">Community Concert</h3>
          <p className="text-sm text-gray-300">123 Main St • Source: <a className="nav-link" href="#" target="_blank">example.com</a></p>
        </div>
        <div className="p-4 rounded-xl border border-gray-800">
          <div className="badge">Nov 27 • 6:30 PM</div>
          <h3 className="text-lg font-semibold mt-2">Farmers Market</h3>
          <p className="text-sm text-gray-300">456 Oak Ave • Source: <a className="nav-link" href="#" target="_blank">example.com</a></p>
        </div>
      </div>
    </div>
  </div>);
}
