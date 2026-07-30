import { NewsItem } from '../models/news.model';
import { newsHeadline, newsSummary } from './news-text';

function newsItem(overrides: Partial<NewsItem> = {}): NewsItem {
  return {
    id: 'id-1',
    title: 'Nvidia beats estimates',
    link: 'https://example.com/a',
    source: 'Example',
    matchedTickers: ['NVDA'],
    score: 5,
    ...overrides,
  };
}

describe('newsHeadline', () => {
  it('prefers the AI translation for the requested interface language', () => {
    const item = newsItem({ localizedTitle: 'Nvidia supera las previsiones' });
    expect(newsHeadline(item)).toBe('Nvidia supera las previsiones');
  });

  it('falls back to the original headline when no translation exists', () => {
    expect(newsHeadline(newsItem({ localizedTitle: '  ' }))).toBe('Nvidia beats estimates');
  });
});

describe('newsSummary', () => {
  it('uses the AI summary, which is generated in the requested language', () => {
    const item = newsItem({ aiSummary: 'Resumen en español', summary: 'English snippet' });
    expect(newsSummary(item, 'es')).toBe('Resumen en español');
  });

  it('reuses the feed snippet when the article is in the interface language', () => {
    const item = newsItem({ summary: 'English snippet', language: 'en' });
    expect(newsSummary(item, 'en')).toBe('English snippet');
  });

  it('drops a snippet written in another language instead of mixing languages', () => {
    const item = newsItem({ summary: 'English snippet', language: 'en' });
    expect(newsSummary(item, 'es')).toBe('');
  });

  it('drops a snippet of unknown language', () => {
    const item = newsItem({ summary: 'English snippet' });
    expect(newsSummary(item, 'es')).toBe('');
  });
});
