import React from "react";
import SafeEventList from "./SafeEventList";
import type { EventItem } from "../types/EventItem";

export default function EventsFromJson({ year, month }: { year: number; month: number }) {
  const [items, setItems] = React.useState<EventItem[]>([]);

  React.useEffect(() => {
    fetch("/events.json")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setItems(data as EventItem[]);
        else setItems([]);
      })
      .catch(() => setItems([]));
  }, []);

  return <SafeEventList items={items} year={year} month={month} />;
}
