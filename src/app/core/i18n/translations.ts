/**
 * Every user-facing string in the app, in both supported languages.
 *
 * The English map is the source of truth: its keys define `TranslationKey`, so
 * the Spanish map (and every `t('...')` call in a template) fails to compile if
 * a key is missing or misspelled. Placeholders use `{name}` and are filled in by
 * `LanguageService.t`.
 */

export type AppLanguage = 'en' | 'es';

/** Locale used for every Intl date/number format, derived from the language. */
export const LOCALES: Record<AppLanguage, string> = {
  en: 'en-GB',
  es: 'es-ES',
};

const EN = {
  // Language switcher
  'lang.label': 'Language',
  'lang.en': 'English',
  'lang.es': 'Spanish',

  // Top navigation
  'nav.dashboard': 'Dashboard',
  'nav.stockDetail': 'Stock detail',
  'nav.logout': 'Log out',
  'nav.primaryAria': 'Primary',

  // Watchlist sidebar
  'watchlist.title': 'Watchlist',
  'watchlist.manage': 'Manage',
  'watchlist.loading': 'Loading your watchlist…',
  'watchlist.empty': 'No companies yet. Use “Manage” to add some.',

  // Dashboard
  'dashboard.title': 'Latest company news',
  'dashboard.newsLoading': 'Loading the latest news for your companies…',
  'dashboard.noRecentNews': 'No recent news found',
  'dashboard.noRecentNewsBody':
    'We haven’t found recent coverage for {company}. Open the company for a wider range.',
  'dashboard.viewMore': 'View more',
  'dashboard.noCompanies': 'No companies in your watchlist yet.',
  'dashboard.addCompanies': 'Add companies',

  // News copy shared by the dashboard and the detail page
  'news.latestUpdate': 'Latest update',
  'news.readFullArticle': 'Read full article',
  'news.summaryUnavailable': 'No AI summary is available for this story yet.',
  'news.tagHeadline': 'headline',

  // Relative timestamps
  'time.latest': 'Latest',
  'time.hoursAgo': '{count}h ago',
  'time.daysAgo': '{count}d ago',

  // Company detail — header
  'detail.showWatchlist': 'Show watchlist',
  'detail.hideWatchlist': 'Hide watchlist',
  'detail.today': 'today',
  'detail.updatedAt': 'Updated {time}',
  'detail.companyNotFound': 'Company not found',
  'detail.companyNotFoundBody': 'We couldn’t find the company you selected.',

  // Company detail — stats
  'stat.open': 'Open',
  'stat.dayHigh': 'Day high',
  'stat.dayLow': 'Day low',
  'stat.volume': 'Volume',
  'stat.week52High': '52w high',
  'stat.week52Low': '52w low',
  'stat.peRatio': 'P/E ratio',
  'stat.marketCap': 'Mkt cap',

  // Company detail — chart
  'chart.loading': 'Loading chart…',
  'chart.noData': 'Not enough price history to draw the chart.',
  'chart.legendNote':
    'Circles mark news on its publish date — size = AI importance, color = sentiment.',
  'chart.positive': 'Positive',
  'chart.negative': 'Negative',
  'chart.neutral': 'Neutral',
  'chart.ariaLabel': 'Price history for {company}',

  // Company detail — related news
  'detail.todaysRelatedNews': 'Today’s related news',
  'detail.relatedNews': 'Related news',
  'detail.noRssToday': 'No RSS articles found today.',
  'detail.noArticlesInRange': 'No articles found for this range.',

  // AI importance labels
  'importance.veryImportant': 'Very important',
  'importance.important': 'Important',
  'importance.lowRelevance': 'Low relevance',
  'importance.neutral': 'Neutral importance',
  'importance.pending': 'Importance pending',

  // Market data errors
  'market.timeout': 'The market request timed out or returned an invalid response.',
  'market.unreachable':
    'The frontend could not reach the backend. Check that the server is running and the proxy is configured.',
  'market.failedWithStatus': 'Market data could not be loaded ({status}).',
  'market.failed': 'Market data could not be loaded.',
  'market.payloadError': 'The backend responded, but the payload could not be processed.',
  'market.noTicker': 'No ticker was provided.',

  // Company selector modal
  'modal.title': 'Manage your companies',
  'modal.intro':
    'Choose which companies stay in your news tracker. Your sidebar and dashboard will update from this selection.',
  'modal.searchPlaceholder': 'Search any listed company or ticker (e.g. Iberdrola, AMZN)',
  'modal.searching': 'Searching listed companies…',
  'modal.noResults': 'No listed companies match “{term}”.',
  'modal.selectedCount': '{count} companies selected',
  'modal.save': 'Save watchlist',
  'modal.closeAria': 'Close modal',

  // Generic actions
  'action.cancel': 'Cancel',
  'action.close': 'Close',
  'action.back': 'Back',
  'action.previous': 'Previous',
  'action.next': 'Next',

  // Login — welcome
  'login.heroLine1': 'The news moving',
  'login.heroLine2': 'your portfolio',
  'login.heroSubtitle':
    'Follow the companies you care about, and catch the headlines that move them — in one focused dashboard.',
  'login.getStarted': 'Get started',

  // Login — auth form
  'login.logIn': 'Log in',
  'login.register': 'Register',
  'login.accountEyebrow': 'Account',
  'login.logInTitle': 'Log in to your account',
  'login.registerTitle': 'Create your account',
  'login.logInSubtitle':
    'Sign in first, then we’ll help you choose the companies you want to follow.',
  'login.registerSubtitle':
    'Set up your account first, then personalize the companies you want to follow.',
  'login.fullName': 'Full name',
  'login.fullNamePlaceholder': 'Your name',
  'login.email': 'Email',
  'login.password': 'Password',
  'login.confirmPassword': 'Confirm password',
  'login.pleaseWait': 'Please wait…',
  'login.continue': 'Continue',
  'login.createAccount': 'Create account',
  'login.firstTime': 'First time here?',
  'login.alreadyHaveAccount': 'Already have an account?',

  // Login — auth errors
  'auth.missingCredentials': 'Enter your email and password.',
  'auth.passwordMismatch': 'The passwords do not match.',
  'auth.firebaseMisconfigured': 'Incomplete Firebase configuration (firebase.config.ts).',
  'auth.invalidCredentials': 'Incorrect email or password.',
  'auth.emailInUse': 'An account with this email already exists.',
  'auth.weakPassword': 'The password must be at least 6 characters long.',
  'auth.invalidEmail': 'The email address is not valid.',
  'auth.generic': 'The operation could not be completed. Please try again.',

  // Onboarding wizard
  'wizard.eyebrow': 'Setup',
  // Short labels for the numbered step rail; the titles below are the long form.
  'wizard.tickersLabel': 'Tickers',
  'wizard.alertsLabel': 'Alerts',
  'wizard.selectedCount': '{count} selected',
  'wizard.enabledCount': '{count} enabled',
  'wizard.step1Eyebrow': 'Step 1 of 2',
  'wizard.step2Eyebrow': 'Step 2 of 2',
  'wizard.tickersTitle': 'Pick your tickers',
  'wizard.tickersDescription': 'Choose stocks to follow. You can always change these.',
  'wizard.alertsTitle': 'Alert preferences',
  'wizard.alertsDescription': 'When should we notify you?',
  'alerts.priceMoves': 'Big price moves (>3%)',
  'alerts.highImpact': 'High-impact news',
  'alerts.dailyDigest': 'Daily digest (9am)',

  // Currency switcher
  'currency.label': 'Currency',
  'currency.usd': 'US dollar',
  'currency.eur': 'Euro',
  'currency.nativeFallback': 'Shown in the listing currency — no exchange rate available.',

  // Company metadata
  'company.listedOn': 'Listed on {exchange}.',
  'sector.fallback': 'Markets',
} as const;

export type TranslationKey = keyof typeof EN;

const ES: Record<TranslationKey, string> = {
  // Language switcher
  'lang.label': 'Idioma',
  'lang.en': 'Inglés',
  'lang.es': 'Español',

  // Top navigation
  'nav.dashboard': 'Panel',
  'nav.stockDetail': 'Detalle del valor',
  'nav.logout': 'Cerrar sesión',
  'nav.primaryAria': 'Principal',

  // Watchlist sidebar
  'watchlist.title': 'Seguimiento',
  'watchlist.manage': 'Gestionar',
  'watchlist.loading': 'Cargando tu lista de seguimiento…',
  'watchlist.empty': 'Todavía no hay empresas. Usa «Gestionar» para añadirlas.',

  // Dashboard
  'dashboard.title': 'Últimas noticias de tus empresas',
  'dashboard.newsLoading': 'Cargando las últimas noticias de tus empresas…',
  'dashboard.noRecentNews': 'Sin noticias recientes',
  'dashboard.noRecentNewsBody':
    'No hemos encontrado noticias recientes de {company}. Abre la empresa para ampliar el periodo.',
  'dashboard.viewMore': 'Ver más',
  'dashboard.noCompanies': 'Todavía no tienes empresas en seguimiento.',
  'dashboard.addCompanies': 'Añadir empresas',

  // News copy shared by the dashboard and the detail page
  'news.latestUpdate': 'Actualización reciente',
  'news.readFullArticle': 'Leer artículo completo',
  'news.summaryUnavailable': 'Todavía no hay resumen de IA para esta noticia.',
  'news.tagHeadline': 'titular',

  // Relative timestamps
  'time.latest': 'Reciente',
  'time.hoursAgo': 'hace {count} h',
  'time.daysAgo': 'hace {count} d',

  // Company detail — header
  'detail.showWatchlist': 'Mostrar seguimiento',
  'detail.hideWatchlist': 'Ocultar seguimiento',
  'detail.today': 'hoy',
  'detail.updatedAt': 'Actualizado a las {time}',
  'detail.companyNotFound': 'Empresa no encontrada',
  'detail.companyNotFoundBody': 'No hemos encontrado la empresa que has seleccionado.',

  // Company detail — stats
  'stat.open': 'Apertura',
  'stat.dayHigh': 'Máximo del día',
  'stat.dayLow': 'Mínimo del día',
  'stat.volume': 'Volumen',
  'stat.week52High': 'Máximo 52 sem.',
  'stat.week52Low': 'Mínimo 52 sem.',
  'stat.peRatio': 'Ratio PER',
  'stat.marketCap': 'Capitalización',

  // Company detail — chart
  'chart.loading': 'Cargando gráfico…',
  'chart.noData': 'No hay suficiente histórico de precios para dibujar el gráfico.',
  'chart.legendNote':
    'Los círculos marcan noticias en su fecha de publicación: el tamaño es la importancia según la IA y el color, el sentimiento.',
  'chart.positive': 'Positivo',
  'chart.negative': 'Negativo',
  'chart.neutral': 'Neutro',
  'chart.ariaLabel': 'Histórico de cotización de {company}',

  // Company detail — related news
  'detail.todaysRelatedNews': 'Noticias relacionadas de hoy',
  'detail.relatedNews': 'Noticias relacionadas',
  'detail.noRssToday': 'Hoy no se han encontrado artículos RSS.',
  'detail.noArticlesInRange': 'No se han encontrado artículos en este periodo.',

  // AI importance labels
  'importance.veryImportant': 'Muy importante',
  'importance.important': 'Importante',
  'importance.lowRelevance': 'Poco relevante',
  'importance.neutral': 'Importancia neutral',
  'importance.pending': 'Importancia pendiente',

  // Market data errors
  'market.timeout': 'La petición de mercado ha caducado o ha devuelto una respuesta no válida.',
  'market.unreachable':
    'El frontend no ha podido conectar con el backend. Comprueba que el servidor está en marcha y que el proxy está configurado.',
  'market.failedWithStatus': 'No se han podido cargar los datos de mercado ({status}).',
  'market.failed': 'No se han podido cargar los datos de mercado.',
  'market.payloadError': 'El backend ha respondido, pero no se ha podido procesar la respuesta.',
  'market.noTicker': 'No se ha indicado ningún ticker.',

  // Company selector modal
  'modal.title': 'Gestiona tus empresas',
  'modal.intro':
    'Elige qué empresas quieres seguir. Tu barra lateral y tu panel se actualizarán con esta selección.',
  'modal.searchPlaceholder': 'Busca cualquier empresa cotizada o ticker (p. ej. Iberdrola, AMZN)',
  'modal.searching': 'Buscando empresas cotizadas…',
  'modal.noResults': 'Ninguna empresa cotizada coincide con «{term}».',
  'modal.selectedCount': '{count} empresas seleccionadas',
  'modal.save': 'Guardar seguimiento',
  'modal.closeAria': 'Cerrar ventana',

  // Generic actions
  'action.cancel': 'Cancelar',
  'action.close': 'Cerrar',
  'action.back': 'Atrás',
  'action.previous': 'Anterior',
  'action.next': 'Siguiente',

  // Login — welcome
  'login.heroLine1': 'Las noticias que mueven',
  'login.heroLine2': 'tu cartera',
  'login.heroSubtitle':
    'Sigue las empresas que te importan y detecta los titulares que las mueven, todo en un único panel.',
  'login.getStarted': 'Empezar',

  // Login — auth form
  'login.logIn': 'Iniciar sesión',
  'login.register': 'Registrarse',
  'login.accountEyebrow': 'Cuenta',
  'login.logInTitle': 'Inicia sesión en tu cuenta',
  'login.registerTitle': 'Crea tu cuenta',
  'login.logInSubtitle':
    'Inicia sesión y después te ayudamos a elegir las empresas que quieres seguir.',
  'login.registerSubtitle': 'Crea tu cuenta y después personaliza las empresas que quieres seguir.',
  'login.fullName': 'Nombre completo',
  'login.fullNamePlaceholder': 'Tu nombre',
  'login.email': 'Email',
  'login.password': 'Contraseña',
  'login.confirmPassword': 'Confirma la contraseña',
  'login.pleaseWait': 'Un momento…',
  'login.continue': 'Continuar',
  'login.createAccount': 'Crear cuenta',
  'login.firstTime': '¿Primera vez aquí?',
  'login.alreadyHaveAccount': '¿Ya tienes cuenta?',

  // Login — auth errors
  'auth.missingCredentials': 'Introduce tu email y contraseña.',
  'auth.passwordMismatch': 'Las contraseñas no coinciden.',
  'auth.firebaseMisconfigured': 'Configuración de Firebase incompleta (firebase.config.ts).',
  'auth.invalidCredentials': 'Email o contraseña incorrectos.',
  'auth.emailInUse': 'Ya existe una cuenta con este email.',
  'auth.weakPassword': 'La contraseña debe tener al menos 6 caracteres.',
  'auth.invalidEmail': 'El email no es válido.',
  'auth.generic': 'No se pudo completar la operación. Inténtalo de nuevo.',

  // Onboarding wizard
  'wizard.eyebrow': 'Configuración',
  'wizard.tickersLabel': 'Valores',
  'wizard.alertsLabel': 'Avisos',
  'wizard.selectedCount': '{count} seleccionados',
  'wizard.enabledCount': '{count} activados',

  'wizard.step1Eyebrow': 'Paso 1 de 2',
  'wizard.step2Eyebrow': 'Paso 2 de 2',
  'wizard.tickersTitle': 'Elige tus valores',
  'wizard.tickersDescription':
    'Elige las acciones que quieres seguir. Podrás cambiarlas cuando quieras.',
  'wizard.alertsTitle': 'Preferencias de avisos',
  'wizard.alertsDescription': '¿Cuándo quieres que te avisemos?',
  'alerts.priceMoves': 'Movimientos fuertes de precio (>3 %)',
  'alerts.highImpact': 'Noticias de alto impacto',
  'alerts.dailyDigest': 'Resumen diario (9:00)',

  // Currency switcher
  'currency.label': 'Moneda',
  'currency.usd': 'Dólar estadounidense',
  'currency.eur': 'Euro',
  'currency.nativeFallback':
    'Mostrado en la moneda de cotización: no hay tipo de cambio disponible.',

  // Company metadata
  'company.listedOn': 'Cotiza en {exchange}.',
  'sector.fallback': 'Mercados',
};

export const TRANSLATIONS: Record<AppLanguage, Record<TranslationKey, string>> = {
  en: EN,
  es: ES,
};

/**
 * Display names for the sector values that reach the UI: the curated catalogue
 * uses Spanish labels, while the ticker search API returns Yahoo's English ones.
 * Keys are normalized (lowercase, unaccented); unknown sectors render as-is.
 */
const SECTOR_LABELS: Record<string, Record<AppLanguage, string>> = {
  banca: { en: 'Banking', es: 'Banca' },
  tecnologia: { en: 'Technology', es: 'Tecnología' },
  automocion: { en: 'Automotive', es: 'Automoción' },
  markets: { en: 'Markets', es: 'Mercados' },
  technology: { en: 'Technology', es: 'Tecnología' },
  'financial services': { en: 'Financial services', es: 'Servicios financieros' },
  'consumer cyclical': { en: 'Consumer cyclical', es: 'Consumo cíclico' },
  'consumer defensive': { en: 'Consumer defensive', es: 'Consumo defensivo' },
  healthcare: { en: 'Healthcare', es: 'Salud' },
  energy: { en: 'Energy', es: 'Energía' },
  industrials: { en: 'Industrials', es: 'Industria' },
  utilities: { en: 'Utilities', es: 'Servicios públicos' },
  'communication services': { en: 'Communication services', es: 'Comunicaciones' },
  'basic materials': { en: 'Basic materials', es: 'Materias primas' },
  'real estate': { en: 'Real estate', es: 'Inmobiliario' },
};

/** Editorial one-liners for the curated catalogue, per language. */
const COMPANY_SUMMARIES: Record<string, Record<AppLanguage, string>> = {
  BBVA: {
    en: 'BBVA is doubling down on its digital strategy while the market watches how interest rates feed through to its banking business.',
    es: 'BBVA refuerza su estrategia digital mientras el mercado sigue de cerca el impacto de los tipos de interés en su negocio bancario.',
  },
  NVDA: {
    en: 'NVIDIA stays focused on artificial intelligence and high-performance chips, with fresh growth expectations for the coming quarters.',
    es: 'NVIDIA mantiene el foco en inteligencia artificial y chips de alto rendimiento, con nuevas expectativas de crecimiento para los próximos trimestres.',
  },
  AAPL: {
    en: 'Apple is lining up a new product and services cycle while analysts weigh how its ecosystem and international sales evolve.',
    es: 'Apple prepara una nueva etapa de producto y servicios, mientras los analistas valoran la evolución de su ecosistema y ventas internacionales.',
  },
  MSFT: {
    en: 'Microsoft keeps expanding its bet on cloud and generative AI, with Azure carrying much of the market’s expectations.',
    es: 'Microsoft amplía su apuesta por la nube y la IA generativa con un fuerte peso de Azure en las previsiones del mercado.',
  },
  TSLA: {
    en: 'Tesla draws attention to production, autonomy and global competition at a decisive moment for the electric vehicle.',
    es: 'Tesla centra la atención en producción, autonomía y competencia global en un momento clave para el vehículo eléctrico.',
  },
  SAN: {
    en: 'Santander aims to consolidate earnings through greater operating efficiency and a portfolio diversified across markets.',
    es: 'Santander busca consolidar resultados con una mayor eficiencia operativa y una cartera diversificada en distintos mercados.',
  },
};

function normalizeKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/** Sector display name in `language`; unmapped sectors are returned unchanged. */
export function sectorLabel(sector: string | null | undefined, language: AppLanguage): string {
  const raw = sector?.trim();
  if (!raw) {
    return TRANSLATIONS[language]['sector.fallback'];
  }

  return SECTOR_LABELS[normalizeKey(raw)]?.[language] ?? raw;
}

/** Catalogue blurb in `language`, or undefined for companies without one. */
export function companySummary(symbol: string, language: AppLanguage): string | undefined {
  return COMPANY_SUMMARIES[symbol.trim().toUpperCase()]?.[language];
}
