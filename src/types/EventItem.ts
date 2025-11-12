export interface EventItem {
  id: string;
  title: string;
  start: string;       // ISO 8601
  end?: string;        // ISO 8601 (optional; Ticketmaster often omits)
  venue?: string;
  address?: string;
  lat?: number;
  lng?: number;
  url?: string;
  source?: string;     // "ticketmaster" | "ics" | etc.
}
