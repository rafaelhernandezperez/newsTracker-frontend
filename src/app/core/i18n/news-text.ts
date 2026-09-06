import { NewsItem } from '../models/news.model';
import { AppLanguage } from './translations';

/** Prefer the translated headline, falling back to the original title. */
export function newsHeadline(item: NewsItem): string {
  return item.localizedTitle?.trim() || item.title;
}

/** Use the AI summary or a feed snippet in the requested language; otherwise return an empty string. */
export function newsSummary(item: NewsItem, language: AppLanguage): string {
  const aiSummary = item.aiSummary?.trim();
  if (aiSummary) {
    return aiSummary;
  }

  const snippet = item.summary?.trim();
  return snippet && isInLanguage(item.language, language) ? snippet : '';
}

function isInLanguage(itemLanguage: string | undefined, language: AppLanguage): boolean {
  return itemLanguage?.trim().toLowerCase().startsWith(language) ?? false;
}
