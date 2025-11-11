export default function Footer(){
  return (<footer className="mt-16 border-t border-gray-800">
    <div className="container py-10 text-sm text-gray-400 flex flex-col md:flex-row gap-2 md:gap-6 justify-between">
      <div>© {new Date().getFullYear()} Local News Network</div>
      <div className="flex gap-4">
        <a className="nav-link" href="/privacy">Privacy</a>
        <a className="nav-link" href="/contact">Contact</a>
      </div>
    </div>
  </footer>);
}
