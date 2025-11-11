'use client';
import { useEffect, useState } from 'react';
import { getCityFromHost } from '@/lib/cities';
type Weather={temp:number; wind:number; description:string};
export default function WeatherTicker(){
  const [weather,setWeather]=useState<Weather|null>(null);
  const [host,setHost]=useState('');
  useEffect(()=>{ if(typeof window!=='undefined') setHost(window.location.hostname); },[]);
  const city=getCityFromHost(host);
  useEffect(()=>{
    async function fetchWx(){
      try{
        const url=`https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&current=temperature_2m,wind_speed_10m`;
        const res=await fetch(url,{cache:'no-store'}); const data=await res.json();
        setWeather({ temp:data?.current?.temperature_2m, wind:data?.current?.wind_speed_10m, description:'Current weather'});
      }catch(e){ console.error(e); }
    }
    fetchWx(); const id=setInterval(fetchWx, 15*60*1000); return ()=>clearInterval(id);
  },[city.lat, city.lon]);
  return (<div className="border-b border-gray-800 bg-black/40">
    <div className="container py-2 text-sm">
      <div className="ticker"><div>{weather?<>🌤 {city.city}, {city.state}: <b>{weather.temp}°C</b> • Wind {weather.wind} m/s • Updated just now.</>:<>Loading weather for {city.city}…</>}</div></div>
    </div></div>);
}
