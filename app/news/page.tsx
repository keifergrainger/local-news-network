export default function NewsPage(){
  return (<div className="py-8">
    <h1 className="text-3xl font-bold mb-4">Local News</h1>
    <div className="card">
      <p className="text-gray-300 text-sm">Phase 1: Add manual posts here (static content). Phase 2: auto-post daily from APIs.</p>
      <ul className="list-disc pl-6 mt-3 text-gray-200">
        <li>City council recap placeholder</li>
        <li>New restaurant opening placeholder</li>
        <li>Weekend round-up placeholder</li>
      </ul>
    </div>
  </div>);
}
