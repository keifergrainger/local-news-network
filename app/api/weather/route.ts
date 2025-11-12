import { NextRequest, NextResponse } from "next/server";
import { getCityFromHost } from "@/lib/cities";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function codeToLabel(code: number) {
  const map: Record<number, string> = {
    0:"Clear",1:"Mainly clear",2:"Partly cloudy",3:"Overcast",
    45:"Fog",48:"Rime fog",51:"Light drizzle",53:"Drizzle",55:"Dense drizzle",
    61:"Light rain",63:"Rain",65:"Heavy rain",71:"Light snow",73:"Snow",75:"Heavy snow",
    80:"Showers",81:"Showers",82:"Heavy showers",95:"Thunderstorm",96:"T-storm/hail",99:"T-storm/hail"
  };
  return map[code] || "Weather";
}

export async function GET(req: NextRequest) {
  const host = req.headers.get("host") || "";
  const city = getCityFromHost(host);

  const url = new URL(req.url);
  const lat = Number(url.searchParams.get("lat") ?? city.lat);
  const lng = Number(url.searchParams.get("lng") ?? city.lon);
  const units = (url.searchParams.get("units") || "f").toLowerCase(); // f|c

  const api = new URL("https://api.open-meteo.com/v1/forecast");
  api.searchParams.set("latitude", String(lat));
  api.searchParams.set("longitude", String(lng));
  api.searchParams.set("timezone", "auto");
  api.searchParams.set("current", "temperature_2m,weather_code,wind_speed_10m");
  api.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,precipitation_probability_max");
  if (units === "f") { api.searchParams.set("temperature_unit", "fahrenheit"); api.searchParams.set("wind_speed_unit", "mph"); }
  else { api.searchParams.set("temperature_unit", "celsius"); api.searchParams.set("wind_speed_unit", "kmh"); }

  try {
    const r = await fetch(api.toString(), { next: { revalidate: 600 } });
    if (!r.ok) throw new Error(`Open-Meteo ${r.status}`);
    const j: any = await r.json();
    const cur = j.current || {};
    const daily = j.daily || {};
    const code = Number(cur.weather_code ?? NaN);
    const unitT = units === "f" ? "°F" : "°C";
    const unitW = units === "f" ? "mph" : "km/h";

    const current = {
      temp: Number(cur.temperature_2m ?? NaN),
      wind: Number(cur.wind_speed_10m ?? NaN),
      label: codeToLabel(code),
      unitT, unitW,
    };
    const today = {
      high: Number(daily.temperature_2m_max?.[0] ?? NaN),
      low: Number(daily.temperature_2m_min?.[0] ?? NaN),
      precip: Number(daily.precipitation_probability_max?.[0] ?? NaN),
      unitT,
    };

    const chip = `${Math.round(current.temp)}${unitT} • ${current.label} • Wind ${Math.round(current.wind)} ${unitW} • H:${Math.round(today.high)}° L:${Math.round(today.low)}° • ${isFinite(today.precip)?today.precip:0}%`;

    return NextResponse.json({
      city: { city: city.city, state: city.state, lat: city.lat, lon: city.lon },
      current, today, chip, source: "open-meteo",
    });
  } catch (e) {
    return NextResponse.json({ city: { city: city.city, state: city.state }, error: "weather_unavailable" }, { status: 200 });
  }
}
