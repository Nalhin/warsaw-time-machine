import { localePath, type Locale } from './i18n';
import { MESSAGES } from './messages';
import { AUTHOR, GITHUB_URL, SITE_NAME, SITE_URL } from './site';

export const WEBSITE_ID = `${SITE_URL}/#website`;
export const AUTHOR_ID = `${SITE_URL}/#author`;

export const WARSAW = {
  '@type': 'City',
  name: 'Warsaw',
  alternateName: 'Warszawa',
  sameAs: ['https://www.wikidata.org/wiki/Q270', 'https://en.wikipedia.org/wiki/Warsaw'],
};

export function websiteNode(locale: Locale) {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name: SITE_NAME,
    url: `${SITE_URL}${localePath(locale, '/')}`,
    description: MESSAGES[locale].site.description,
    inLanguage: locale,
    publisher: { '@id': AUTHOR_ID },
    author: { '@id': AUTHOR_ID },
    about: WARSAW,
  };
}

export const AUTHOR_NODE = {
  '@type': 'Person',
  '@id': AUTHOR_ID,
  name: AUTHOR.name,
  url: AUTHOR.website,
  sameAs: [AUTHOR.x, AUTHOR.website, GITHUB_URL.replace(/\/[^/]+$/, '')],
};

export function jsonLdScript(data: object) {
  return { __html: JSON.stringify(data).replace(/</g, '\\u003c') };
}
