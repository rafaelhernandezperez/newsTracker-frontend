export interface Company {
  symbol: string;
  name: string;
  sector?: string;
  /** Exchange the company is listed on, when the source reports one. */
  exchange?: string;
  /**
   * Free-text blurb from the source, in whatever language it provided. Curated
   * companies have translated copy instead — see `LanguageService.companyBlurb`.
   */
  summary?: string;
}
