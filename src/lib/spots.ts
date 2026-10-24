export interface Credit {
  author: string;
  date?: string;
  licence: string;
  licenceUrl?: string;
  source?: string;
  sourceUrl?: string;
}

export interface Spot {
  id: string;
  name: string;
  lat: number;
  lng: number;
  /** Short note on the view direction, e.g. "widok w stronę Krakowskiego Przedmieścia". */
  heading?: string;
  description?: string;
  /** Year or range of the old photo, shown on the slider label, e.g. "1930". */
  oldYear?: string;
  old: string;
  restored?: string;
  today: string;
  og?: string;
  /** Either plain strings ("author, licence, link") or structured credits. */
  credits: { old: string | Credit; today: string | Credit };
}

export async function loadSpots(): Promise<Spot[]> {
  const res = await fetch(`${import.meta.env.BASE_URL}spots.json`);
  if (!res.ok) throw new Error(`spots.json: ${res.status}`);
  return res.json();
}
