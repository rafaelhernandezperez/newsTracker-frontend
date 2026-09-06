/** English keys define TranslationKey; all languages must supply the same keys. */

export type AppLanguage = 'en' | 'es';

export const LOCALES: Record<AppLanguage, string> = {
  en: 'en-GB',
  es: 'es-ES',
};

const EN = {
  'lang.label': 'Language',
  'lang.en': 'English',
  'lang.es': 'Spanish',

  'nav.dashboard': 'Dashboard',
  'nav.settings': 'Settings',
  'nav.logout': 'Log out',

  'watchlist.title': 'Watchlist',
  'watchlist.manage': 'Manage',
  'watchlist.loading': 'Loading your watchlist…',
  'watchlist.empty': 'No companies yet. Use “Manage” to add some.',

  'dashboard.title': 'Latest company news',
  'dashboard.newsLoading': 'Loading the latest news for your companies…',
  'dashboard.noRecentNews': 'No recent news found',
  'dashboard.noRecentNewsBody':
    'We haven’t found recent coverage for {company}. Open the company for a wider range.',
  'dashboard.viewMore': 'View more',
  'dashboard.noCompanies': 'No companies in your watchlist yet.',
  'dashboard.addCompanies': 'Add companies',

  'news.latestUpdate': 'Latest update',
  'news.readFullArticle': 'Read full article',
  'news.summaryUnavailable': 'No AI summary is available for this story yet.',

  'time.latest': 'Latest',
  'time.hoursAgo': '{count}h ago',
  'time.daysAgo': '{count}d ago',

  'detail.showWatchlist': 'Show watchlist',
  'detail.hideWatchlist': 'Hide watchlist',
  'detail.today': 'today',
  'detail.updatedAt': 'Updated {time}',
  'detail.companyNotFound': 'Company not found',
  'detail.companyNotFoundBody': 'We couldn’t find the company you selected.',

  'stat.open': 'Open',
  'stat.dayHigh': 'Day high',
  'stat.dayLow': 'Day low',
  'stat.volume': 'Volume',
  'stat.week52High': '52w high',
  'stat.week52Low': '52w low',
  'stat.peRatio': 'P/E ratio',
  'stat.marketCap': 'Mkt cap',

  'chart.loading': 'Loading chart…',
  'chart.noData': 'Not enough price history to draw the chart.',
  'chart.legendNote':
    'Circles mark news on its publish date — size = AI importance, color = sentiment.',
  'chart.positive': 'Positive',
  'chart.negative': 'Negative',
  'chart.neutral': 'Neutral',
  'chart.ariaLabel': 'Price history for {company}',

  'detail.todaysRelatedNews': 'Today’s additional news',
  'detail.relatedNews': 'Additional news',
  'detail.noRssToday': 'No additional RSS articles found today.',
  'detail.noArticlesInRange': 'No additional articles found for this range.',

  'importance.veryImportant': 'Very important',
  'importance.important': 'Important',
  'importance.lowRelevance': 'Low relevance',
  'importance.neutral': 'Neutral importance',
  'importance.pending': 'Importance pending',

  'market.timeout': 'The market request timed out or returned an invalid response.',
  'market.unreachable':
    'The frontend could not reach the backend. Check that the server is running and the proxy is configured.',
  'market.failedWithStatus': 'Market data could not be loaded ({status}).',
  'market.failed': 'Market data could not be loaded.',
  'market.payloadError': 'The backend responded, but the payload could not be processed.',
  'market.noTicker': 'No ticker was provided.',

  'modal.title': 'Manage your companies',
  'modal.searchPlaceholder': 'Search any listed company or ticker (e.g. Iberdrola, AMZN)',
  'modal.searching': 'Searching listed companies…',
  'modal.noResults': 'No listed companies match “{term}”.',
  'modal.selectedCount': '{count} companies selected',
  'modal.save': 'Save watchlist',
  'modal.closeAria': 'Close modal',

  'settings.eyebrow': 'Settings',
  'settings.title': 'Account settings',
  'settings.intro':
    'Choose which alerts you receive, control delivery on this browser, or manage your session.',
  'settings.alertsTitle': 'Alert preferences',
  'settings.alertsDescription': 'Choose the events that should generate a notification.',
  'settings.deliveryTitle': 'Browser notifications',
  'settings.deliveryEnabled': 'Delivery is active on this browser.',
  'settings.deliveryDisabled': 'Delivery is not active on this browser.',
  'settings.deliveryDisabling': 'Removing this browser from your notification devices…',
  'settings.enableDelivery': 'Enable on this browser',
  'settings.disableDelivery': 'Disable on this browser',
  'settings.deliveryEnabling': 'Enabling…',
  'settings.deliveryDisablingAction': 'Disabling…',
  'settings.testDescription':
    '“Send test push” uses a real recent story and verifies backend → Firebase → this browser.',
  'settings.sendTest': 'Send test push',
  'settings.previewAlert': 'Screenshot preview',
  'settings.testSending': 'Sending the test through Firebase…',
  'settings.testReceived':
    'Verified: this browser received the Firebase push and created a persistent notification.',
  'settings.testSent':
    'Firebase accepted the test, but this open page did not confirm receipt within eight seconds.',
  'settings.testNoDevice': 'No registered device was found. Enable browser notifications first.',
  'settings.testNoNews':
    'No stored company story is available yet. Let the news tracker run, then try again.',
  'settings.testFailed': 'The end-to-end test failed. Check the API connection and try again.',
  'settings.previewShown':
    'On-screen simulation ready to capture. It is a visual preview, not proof of Firebase delivery.',
  'settings.previewLabel': 'Local simulation · not delivery proof',
  'settings.previewNow': 'Now',
  'settings.previewTitle': 'NVDA: Strong outlook lifts shares',
  'settings.previewBody':
    'NVIDIA rises after stronger-than-expected guidance. Open NewsTracker to review the impact.',
  'settings.accountTitle': 'Account',
  'settings.signedInAs': 'Signed in as {email}',
  'settings.save': 'Save settings',
  'settings.saveFailed': 'Your settings could not be saved. Check your connection and try again.',
  'settings.closeAria': 'Close settings',

  'action.cancel': 'Cancel',
  'action.close': 'Close',
  'action.back': 'Back',
  'action.next': 'Next',

  'login.heroLine1': 'The news moving',
  'login.heroLine2': 'your portfolio',
  'login.getStarted': 'Get started',

  'login.logIn': 'Log in',
  'login.register': 'Register',
  'login.accountEyebrow': 'Account',
  'login.fullName': 'Full name',
  'login.email': 'Email',
  'login.password': 'Password',
  'login.confirmPassword': 'Confirm password',
  'login.pleaseWait': 'Please wait…',
  'login.continue': 'Continue',
  'login.createAccount': 'Create account',
  'login.firstTime': 'First time here?',
  'login.alreadyHaveAccount': 'Already have an account?',

  'auth.missingCredentials': 'Enter your email and password.',
  'auth.passwordMismatch': 'The passwords do not match.',
  'auth.firebaseMisconfigured': 'Incomplete Firebase configuration (firebase.config.ts).',
  'auth.invalidCredentials': 'Incorrect email or password.',
  'auth.emailInUse': 'An account with this email already exists.',
  'auth.weakPassword': 'The password must be at least 6 characters long.',
  'auth.invalidEmail': 'The email address is not valid.',
  'auth.generic': 'The operation could not be completed. Please try again.',

  'wizard.eyebrow': 'Setup',
  'wizard.tickersLabel': 'Tickers',
  'wizard.alertsLabel': 'Alerts',
  'wizard.selectedCount': '{count} selected',
  'wizard.enabledCount': '{count} enabled',
  'wizard.tickersDescription': 'Choose stocks to follow. You can always change these.',
  'wizard.alertsDescription': 'When should we notify you?',
  'alerts.priceMoves': 'Big price moves (>3%)',
  'alerts.highImpact': 'High-impact news',
  'alerts.dailyDigest': 'Daily digest (9am)',
  'alerts.browserTitle': 'Browser delivery',
  'alerts.browserDescription': 'Your browser will ask for permission when you finish setup.',
  'alerts.browserEnabling': 'Waiting for browser permission and registering this device…',
  'alerts.browserEnabled': 'Notifications are enabled on this device.',
  'alerts.browserDenied':
    'Notifications are blocked. Allow them in this site’s browser settings, then try again.',
  'alerts.browserDismissed': 'The permission prompt was dismissed. Try again when you are ready.',
  'alerts.browserUnsupported': 'This browser or browsing mode does not support web notifications.',
  'alerts.browserFailed':
    'Permission was granted, but this device could not be registered. Check your connection and try again.',
  'alerts.enableAndFinish': 'Enable notifications & finish',
  'alerts.continueWithout': 'Continue without browser notifications',

  'currency.label': 'Currency',
  'currency.usd': 'US dollar',
  'currency.eur': 'Euro',
  'currency.nativeFallback': 'Shown in the listing currency — no exchange rate available.',
  'sector.fallback': 'Markets',
} as const;

export type TranslationKey = keyof typeof EN;

const ES: Record<TranslationKey, string> = {
  'lang.label': 'Idioma',
  'lang.en': 'Inglés',
  'lang.es': 'Español',

  'nav.dashboard': 'Panel',
  'nav.settings': 'Ajustes',
  'nav.logout': 'Cerrar sesión',

  'watchlist.title': 'Seguimiento',
  'watchlist.manage': 'Gestionar',
  'watchlist.loading': 'Cargando tu lista de seguimiento…',
  'watchlist.empty': 'Todavía no hay empresas. Usa «Gestionar» para añadirlas.',

  'dashboard.title': 'Últimas noticias de tus empresas',
  'dashboard.newsLoading': 'Cargando las últimas noticias de tus empresas…',
  'dashboard.noRecentNews': 'Sin noticias recientes',
  'dashboard.noRecentNewsBody':
    'No hemos encontrado noticias recientes de {company}. Abre la empresa para ampliar el periodo.',
  'dashboard.viewMore': 'Ver más',
  'dashboard.noCompanies': 'Todavía no tienes empresas en seguimiento.',
  'dashboard.addCompanies': 'Añadir empresas',

  'news.latestUpdate': 'Actualización reciente',
  'news.readFullArticle': 'Leer artículo completo',
  'news.summaryUnavailable': 'Todavía no hay resumen de IA para esta noticia.',

  'time.latest': 'Reciente',
  'time.hoursAgo': 'hace {count} h',
  'time.daysAgo': 'hace {count} d',

  'detail.showWatchlist': 'Mostrar seguimiento',
  'detail.hideWatchlist': 'Ocultar seguimiento',
  'detail.today': 'hoy',
  'detail.updatedAt': 'Actualizado a las {time}',
  'detail.companyNotFound': 'Empresa no encontrada',
  'detail.companyNotFoundBody': 'No hemos encontrado la empresa que has seleccionado.',

  'stat.open': 'Apertura',
  'stat.dayHigh': 'Máximo del día',
  'stat.dayLow': 'Mínimo del día',
  'stat.volume': 'Volumen',
  'stat.week52High': 'Máximo 52 sem.',
  'stat.week52Low': 'Mínimo 52 sem.',
  'stat.peRatio': 'Ratio PER',
  'stat.marketCap': 'Capitalización',

  'chart.loading': 'Cargando gráfico…',
  'chart.noData': 'No hay suficiente histórico de precios para dibujar el gráfico.',
  'chart.legendNote':
    'Los círculos marcan noticias en su fecha de publicación: el tamaño es la importancia según la IA y el color, el sentimiento.',
  'chart.positive': 'Positivo',
  'chart.negative': 'Negativo',
  'chart.neutral': 'Neutro',
  'chart.ariaLabel': 'Histórico de cotización de {company}',

  'detail.todaysRelatedNews': 'Noticias adicionales de hoy',
  'detail.relatedNews': 'Noticias adicionales',
  'detail.noRssToday': 'Hoy no se han encontrado artículos RSS adicionales.',
  'detail.noArticlesInRange': 'No se han encontrado artículos adicionales en este periodo.',

  'importance.veryImportant': 'Muy importante',
  'importance.important': 'Importante',
  'importance.lowRelevance': 'Poco relevante',
  'importance.neutral': 'Importancia neutral',
  'importance.pending': 'Importancia pendiente',

  'market.timeout': 'La petición de mercado ha caducado o ha devuelto una respuesta no válida.',
  'market.unreachable':
    'El frontend no ha podido conectar con el backend. Comprueba que el servidor está en marcha y que el proxy está configurado.',
  'market.failedWithStatus': 'No se han podido cargar los datos de mercado ({status}).',
  'market.failed': 'No se han podido cargar los datos de mercado.',
  'market.payloadError': 'El backend ha respondido, pero no se ha podido procesar la respuesta.',
  'market.noTicker': 'No se ha indicado ningún ticker.',

  'modal.title': 'Gestiona tus empresas',
  'modal.searchPlaceholder': 'Busca cualquier empresa cotizada o ticker (p. ej. Iberdrola, AMZN)',
  'modal.searching': 'Buscando empresas cotizadas…',
  'modal.noResults': 'Ninguna empresa cotizada coincide con «{term}».',
  'modal.selectedCount': '{count} empresas seleccionadas',
  'modal.save': 'Guardar seguimiento',
  'modal.closeAria': 'Cerrar ventana',

  'settings.eyebrow': 'Ajustes',
  'settings.title': 'Ajustes de la cuenta',
  'settings.intro':
    'Elige qué avisos quieres recibir, controla la entrega en este navegador o gestiona tu sesión.',
  'settings.alertsTitle': 'Preferencias de avisos',
  'settings.alertsDescription': 'Elige los eventos que deben generar una notificación.',
  'settings.deliveryTitle': 'Notificaciones del navegador',
  'settings.deliveryEnabled': 'La entrega está activa en este navegador.',
  'settings.deliveryDisabled': 'La entrega no está activa en este navegador.',
  'settings.deliveryDisabling': 'Eliminando este navegador de tus dispositivos de avisos…',
  'settings.enableDelivery': 'Activar en este navegador',
  'settings.disableDelivery': 'Desactivar en este navegador',
  'settings.deliveryEnabling': 'Activando…',
  'settings.deliveryDisablingAction': 'Desactivando…',
  'settings.testDescription':
    '«Enviar push de prueba» usa una noticia real reciente y comprueba servidor → Firebase → este navegador.',
  'settings.sendTest': 'Enviar push de prueba',
  'settings.previewAlert': 'Vista para captura',
  'settings.testSending': 'Enviando la prueba mediante Firebase…',
  'settings.testReceived':
    'Verificado: este navegador recibió el push de Firebase y creó una notificación persistente.',
  'settings.testSent':
    'Firebase aceptó la prueba, pero esta página abierta no confirmó la recepción en ocho segundos.',
  'settings.testNoDevice':
    'No se encontró ningún dispositivo registrado. Activa primero las notificaciones del navegador.',
  'settings.testNoNews':
    'Aún no hay noticias de empresas guardadas. Espera a que se ejecute el rastreador y vuelve a intentarlo.',
  'settings.testFailed':
    'La prueba de extremo a extremo falló. Comprueba la conexión con la API y vuelve a intentarlo.',
  'settings.previewShown':
    'La simulación en pantalla está lista para capturar. Es una muestra visual, no una prueba de entrega de Firebase.',
  'settings.previewLabel': 'Simulación local · no prueba la entrega',
  'settings.previewNow': 'Ahora',
  'settings.previewTitle': 'NVDA: Las buenas previsiones impulsan la acción',
  'settings.previewBody':
    'NVIDIA sube tras publicar previsiones mejores de lo esperado. Abre NewsTracker para revisar el impacto.',
  'settings.accountTitle': 'Cuenta',
  'settings.signedInAs': 'Sesión iniciada como {email}',
  'settings.save': 'Guardar ajustes',
  'settings.saveFailed':
    'No se pudieron guardar los ajustes. Comprueba la conexión y vuelve a intentarlo.',
  'settings.closeAria': 'Cerrar ajustes',

  'action.cancel': 'Cancelar',
  'action.close': 'Cerrar',
  'action.back': 'Atrás',
  'action.next': 'Siguiente',

  'login.heroLine1': 'Las noticias que mueven',
  'login.heroLine2': 'tu cartera',
  'login.getStarted': 'Empezar',

  'login.logIn': 'Iniciar sesión',
  'login.register': 'Registrarse',
  'login.accountEyebrow': 'Cuenta',
  'login.fullName': 'Nombre completo',
  'login.email': 'Email',
  'login.password': 'Contraseña',
  'login.confirmPassword': 'Confirma la contraseña',
  'login.pleaseWait': 'Un momento…',
  'login.continue': 'Continuar',
  'login.createAccount': 'Crear cuenta',
  'login.firstTime': '¿Primera vez aquí?',
  'login.alreadyHaveAccount': '¿Ya tienes cuenta?',

  'auth.missingCredentials': 'Introduce tu email y contraseña.',
  'auth.passwordMismatch': 'Las contraseñas no coinciden.',
  'auth.firebaseMisconfigured': 'Configuración de Firebase incompleta (firebase.config.ts).',
  'auth.invalidCredentials': 'Email o contraseña incorrectos.',
  'auth.emailInUse': 'Ya existe una cuenta con este email.',
  'auth.weakPassword': 'La contraseña debe tener al menos 6 caracteres.',
  'auth.invalidEmail': 'El email no es válido.',
  'auth.generic': 'No se pudo completar la operación. Inténtalo de nuevo.',

  'wizard.eyebrow': 'Configuración',
  'wizard.tickersLabel': 'Valores',
  'wizard.alertsLabel': 'Avisos',
  'wizard.selectedCount': '{count} seleccionados',
  'wizard.enabledCount': '{count} activados',
  'wizard.tickersDescription':
    'Elige las acciones que quieres seguir. Podrás cambiarlas cuando quieras.',
  'wizard.alertsDescription': '¿Cuándo quieres que te avisemos?',
  'alerts.priceMoves': 'Movimientos fuertes de precio (>3 %)',
  'alerts.highImpact': 'Noticias de alto impacto',
  'alerts.dailyDigest': 'Resumen diario (9:00)',
  'alerts.browserTitle': 'Avisos del navegador',
  'alerts.browserDescription': 'Tu navegador te pedirá permiso cuando termines la configuración.',
  'alerts.browserEnabling': 'Esperando el permiso del navegador y registrando este dispositivo…',
  'alerts.browserEnabled': 'Las notificaciones están activadas en este dispositivo.',
  'alerts.browserDenied':
    'Las notificaciones están bloqueadas. Permítelas en los ajustes del sitio del navegador y vuelve a intentarlo.',
  'alerts.browserDismissed':
    'Has cerrado la solicitud de permiso. Vuelve a intentarlo cuando quieras.',
  'alerts.browserUnsupported': 'Este navegador o modo de navegación no admite notificaciones web.',
  'alerts.browserFailed':
    'El permiso se concedió, pero no se pudo registrar el dispositivo. Comprueba la conexión y vuelve a intentarlo.',
  'alerts.enableAndFinish': 'Activar avisos y terminar',
  'alerts.continueWithout': 'Continuar sin avisos del navegador',

  'currency.label': 'Moneda',
  'currency.usd': 'Dólar estadounidense',
  'currency.eur': 'Euro',
  'currency.nativeFallback':
    'Mostrado en la moneda de cotización: no hay tipo de cambio disponible.',
  'sector.fallback': 'Mercados',
};

export const TRANSLATIONS: Record<AppLanguage, Record<TranslationKey, string>> = {
  en: EN,
  es: ES,
};

/** Normalize sector names from the curated catalogue and search API before translating. */
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

function normalizeKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function sectorLabel(sector: string | null | undefined, language: AppLanguage): string {
  const raw = sector?.trim();
  if (!raw) {
    return TRANSLATIONS[language]['sector.fallback'];
  }

  return SECTOR_LABELS[normalizeKey(raw)]?.[language] ?? raw;
}
