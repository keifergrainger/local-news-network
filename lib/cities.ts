export type CityConfig = { host:string; city:string; state:string; lat:number; lon:number; heroImage:string; tagline:string; };
export const CITIES: CityConfig[] = [
  { host:"saltlakeut.com", city:"Salt Lake City", state:"UT", lat:40.7608, lon:-111.8910, heroImage:"https://images.unsplash.com/photo-1466285746891-30d1cd3a5400?q=80&w=1600&auto=format&fit=crop", tagline:"Your Local Hub — News & Events in Salt Lake City" },
  { host:"irmosc.com", city:"Irmo", state:"SC", lat:34.0857, lon:-81.1832, heroImage:"https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1600&auto=format&fit=crop", tagline:"Irmo’s Community Hub for News & Events" },
  { host:"caycesc.com", city:"Cayce", state:"SC", lat:33.9657, lon:-81.0734, heroImage:"https://images.unsplash.com/photo-1521295121783-8a321d551ad2?q=80&w=1600&auto=format&fit=crop", tagline:"Cayce’s Local News, Weather, and Events" },
  { host:"elizabethnc.com", city:"Elizabeth", state:"NC", lat:35.2050, lon:-80.8150, heroImage:"https://images.unsplash.com/photo-1482192596544-9eb780fc7f66?q=80&w=1600&auto=format&fit=crop", tagline:"Stay Connected — News & Events in Elizabeth, NC" },
  { host:"fresnoca.org", city:"Fresno", state:"CA", lat:36.7378, lon:-119.7871, heroImage:"https://images.unsplash.com/photo-1469474968028-56623f02e42e?q=80&w=1600&auto=format&fit=crop", tagline:"Local News and Events in Fresno, California" },
  { host:"indioca.com", city:"Indio", state:"CA", lat:33.7206, lon:-116.2156, heroImage:"https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?q=80&w=1600&auto=format&fit=crop", tagline:"What’s Happening in Indio — Your Local Source" },
  { host:"kahuluihi.com", city:"Kahului", state:"HI", lat:20.8893, lon:-156.4729, heroImage:"https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?q=80&w=1600&auto=format&fit=crop", tagline:"Kahului’s Island News & Local Happenings" },
  { host:"perrisca.com", city:"Perris", state:"CA", lat:33.7825, lon:-117.2286, heroImage:"https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?q=80&w=1600&auto=format&fit=crop", tagline:"Local News and Community Updates for Perris, CA" }
];
export function getCityFromHost(hostname?:string):CityConfig{
  const host=(hostname||"").toLowerCase();
  const match=CITIES.find(c=>host.includes(c.host));
  return match || CITIES[0];
}
