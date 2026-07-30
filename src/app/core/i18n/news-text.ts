import { NewsItem } from '../models/news.model';
import { AppLanguage } from './translations';

/**
 * The headline to display: the AI translation into the requested interface
 * language when the backend produced one, else the original headline.
 */
export function newsHeadline(item: NewsItem): string {
  return item.localizedTitle?.trim() || item.title;
}

/**
 * The summary to display, guaranteed to be in `language`.
 *
 * `aiSummary` is generated in the language the news request asked for, so it is
 * always safe. The raw feed snippet is only reused when the article itself is in
 * the interface language — otherwise a Spanish reader would get an English
 * paragraph under a Spanish headline. Returns '' when nothing fits; callers
 * decide whether to hide the paragraph or show a localized placeholder.
 */
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
