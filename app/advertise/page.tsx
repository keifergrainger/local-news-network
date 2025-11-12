'use client';
export default function AdvertisePage(){
  return (<div className="py-8">
    <h1 className="text-3xl font-bold mb-4">Advertise With Us</h1>
    <div className="card">
      <ul className="list-disc pl-6 text-gray-200 space-y-2">
        <li><b>Featured Event Placement:</b> $25/week (top of Events page)</li>
        <li><b>Sponsored Article:</b> $75/post (written & published on /news)</li>
        <li><b>Featured Business Listing:</b> $15/month</li>
        <li><b>Multi-City Bundle:</b> Ask about discounts across our 8-city network.</li>
      </ul>
      <p className="text-sm text-gray-400 mt-4">Use the form on /submit or email us to get started.</p>
    </div>
  </div>);
}

