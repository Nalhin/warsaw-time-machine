import { localePath, type Locale } from './i18n';
import { MESSAGES } from './messages';
import { AUTHOR, GITHUB_URL, SITE_NAME, SITE_URL } from './site';
import { spotsFor } from './spot-data';
import type { Photo, Spot } from './spots';
import { YEAR_KEYS } from './years';

const en = MESSAGES.en;

function url(path: string, locale: Locale = 'en') {
  return `${SITE_URL}${localePath(locale, path)}`;
}

function intro() {
  return [
    `# ${SITE_NAME}`,
    `> ${en.site.description}`,
    `${SITE_NAME} (${SITE_URL}) is a free interactive map of Warsaw, Poland. It shows every aerial survey the City of Warsaw has published, from the 1935 photomap and the 1945 photos of the destroyed city through the rebuilding years to today, and lets you compare any two years with a draggable divider or play them as a timelapse. Pins on the map open street-level photos of the same places across the decades, each with its author, date and licence. The site is available in English and Polish (${url('/', 'pl')}). It was made by ${AUTHOR.name} and the code is open source under the MIT licence.`,
    [
      'Map links can be built from URL parameters:',
      '- `?at=<lat>,<lng>,<zoom>`: centre and zoom, e.g. `?at=52.2477,21.0136,17`',
      '- `?compare=<year>-<year>`: compare two years side by side, e.g. `?compare=1935-today` (the default is 1945-today)',
      '- `?year=<year>`: show a single year',
      '- `?timelapse=<year>`: play through the years starting at that year',
      '- `&divider=h`: horizontal instead of vertical divider in compare mode',
      `Valid years: ${YEAR_KEYS.join(', ')}.`,
    ].join('\n'),
  ];
}

function yearList() {
  return YEAR_KEYS.map((k) => `- ${en.years[k].long}${en.years[k].era ? ` (${en.years[k].era})` : ''}`).join('\n');
}

function firstSentence(text?: string) {
  return text?.split(/(?<=\.)\s/)[0] ?? '';
}

export function llmsIndex() {
  const pl = spotsFor('pl');
  return [
    ...intro(),
    '## Main pages',
    [
      `- [Interactive map](${url('/')}): aerial photos of Warsaw from 1935 to today`,
      `- [About](${url('/about')}): why the map exists and where the photos come from`,
      `- [Mapa po polsku](${url('/', 'pl')}): the Polish version`,
    ].join('\n'),
    '## Places',
    spotsFor('en')
      .map((s, i) => `- [${s.name}](${url(`/spots/${s.id}`)}): ${firstSentence(s.description)} Polish: [${pl[i].name}](${url(`/spots/${s.id}`, 'pl')})`)
      .join('\n'),
    '## Aerial photo years',
    yearList(),
    '## Optional',
    [
      `- [Full text](${SITE_URL}/llms-full.txt): every place description, photo caption and photo credit in one file`,
      `- [Source code](${GITHUB_URL}): Next.js app and the Python photo pipeline`,
      `- [Author](${AUTHOR.website})`,
    ].join('\n'),
  ].join('\n\n');
}

function photoEntry({ date, caption, credit }: Photo) {
  const source = credit.sourceUrl ? `[${credit.source ?? 'source'}](${credit.sourceUrl})` : credit.source;
  return `- ${date}: ${caption ?? ''} (${[credit.author, credit.licence, source].filter(Boolean).join(', ')})`;
}

function spotEntry(s: Spot, plName: string) {
  return [
    `### ${s.name}`,
    [
      `- URL: ${url(`/spots/${s.id}`)}`,
      plName !== s.name && `- Polish name: ${plName}`,
      `- Coordinates: ${s.lat}, ${s.lng}`,
      `- On the map: ${url('/')}?at=${s.lat},${s.lng},17`,
    ]
      .filter(Boolean)
      .join('\n'),
    s.description,
    `Photos:\n${s.photos.map(photoEntry).join('\n')}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function llmsFull() {
  const pl = spotsFor('pl');
  return [
    ...intro(),
    '## About',
    en.about.story.join('\n\n'),
    `Aerial photos and street names: City of Warsaw (https://mapa.um.warszawa.pl), served live from the city's WMS. Street-level photos: Wikimedia Commons and archives; every photo below lists its author and licence.`,
    '## Aerial photo years',
    yearList(),
    '## Places',
    ...spotsFor('en').map((s, i) => spotEntry(s, pl[i].name)),
  ].join('\n\n');
}

export function textResponse(body: string) {
  return new Response(`${body}\n`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
