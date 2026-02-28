const TEXT_KEYS = ["chat_title", "message_placeholder", "initial_message"] as const;

type TextKey = (typeof TEXT_KEYS)[number];
type LocaleTexts = Record<TextKey, string>;

const ALIASES: Record<string, string> = {"zh-hans": "zh-cn", "zh-hant": "zh-tw"};

export const SUPPORTED_LOCALES = [
  {
    "code": "en",
    "language": "English",
    "local_name": "English"
  },
  {
    "code": "ar",
    "language": "Arabic",
    "local_name": "العربية (Al-ʿarabiyyah)"
  },
  {
    "code": "bg",
    "language": "Bulgarian",
    "local_name": "български (bǎlgarski)"
  },
  {
    "code": "bn",
    "language": "Bengali",
    "local_name": "বাংলা (Bangla)"
  },
  {
    "code": "bs",
    "language": "Bosnian",
    "local_name": "bosanski"
  },
  {
    "code": "ca",
    "language": "Catalan",
    "local_name": "Català"
  },
  {
    "code": "cs",
    "language": "Czech",
    "local_name": "Čeština"
  },
  {
    "code": "da",
    "language": "Danish",
    "local_name": "Dansk"
  },
  {
    "code": "de",
    "language": "German",
    "local_name": "Deutsch"
  },
  {
    "code": "el",
    "language": "Greek",
    "local_name": "Ελληνικά (Elliniká)"
  },
  {
    "code": "en-gb",
    "language": "English (United Kingdom)",
    "local_name": "English (United Kingdom)"
  },
  {
    "code": "es",
    "language": "Spanish",
    "local_name": "Español"
  },
  {
    "code": "es-ar",
    "language": "Spanish (Argentina)",
    "local_name": "Español (Argentina)"
  },
  {
    "code": "et",
    "language": "Estonian",
    "local_name": "Eesti"
  },
  {
    "code": "fa",
    "language": "Persian",
    "local_name": "فارسی (Fârsi)"
  },
  {
    "code": "fi",
    "language": "Finnish",
    "local_name": "Suomi"
  },
  {
    "code": "fr",
    "language": "French",
    "local_name": "Français"
  },
  {
    "code": "hi",
    "language": "Hindi",
    "local_name": "हिन्दी (Hindī)"
  },
  {
    "code": "he",
    "language": "Hebrew",
    "local_name": "עברית (Ivrit)"
  },
  {
    "code": "hr",
    "language": "Croatian",
    "local_name": "Hrvatski"
  },
  {
    "code": "hu",
    "language": "Hungarian",
    "local_name": "Magyar"
  },
  {
    "code": "id",
    "language": "Indonesian",
    "local_name": "Bahasa Indonesia"
  },
  {
    "code": "it",
    "language": "Italian",
    "local_name": "Italiano"
  },
  {
    "code": "lv",
    "language": "Latvian",
    "local_name": "Latviešu"
  },
  {
    "code": "ms",
    "language": "Malay",
    "local_name": "Bahasa Melayu"
  },
  {
    "code": "no",
    "language": "Norwegian",
    "local_name": "Norsk"
  },
  {
    "code": "ja",
    "language": "Japanese",
    "local_name": "日本語 (Nihongo)"
  },
  {
    "code": "ko",
    "language": "Korean",
    "local_name": "한국어 (Hangugeo)"
  },
  {
    "code": "nl",
    "language": "Dutch",
    "local_name": "Nederlands"
  },
  {
    "code": "pl",
    "language": "Polish",
    "local_name": "Polski"
  },
  {
    "code": "pt",
    "language": "Portuguese",
    "local_name": "Português"
  },
  {
    "code": "pt-br",
    "language": "Portuguese (Brazil)",
    "local_name": "Português (Brasil)"
  },
  {
    "code": "ro",
    "language": "Romanian",
    "local_name": "Română"
  },
  {
    "code": "ru",
    "language": "Russian",
    "local_name": "Русский (Russkiy)"
  },
  {
    "code": "sk",
    "language": "Slovak",
    "local_name": "Slovenčina"
  },
  {
    "code": "sq",
    "language": "Albanian",
    "local_name": "Shqip"
  },
  {
    "code": "sr",
    "language": "Serbian",
    "local_name": "Српски (Srpski)"
  },
  {
    "code": "sv",
    "language": "Swedish",
    "local_name": "Svenska"
  },
  {
    "code": "sw",
    "language": "Swahili",
    "local_name": "Kiswahili"
  },
  {
    "code": "th",
    "language": "Thai",
    "local_name": "ไทย (Thai)"
  },
  {
    "code": "tr",
    "language": "Turkish",
    "local_name": "Türkçe"
  },
  {
    "code": "tl",
    "language": "Tagalog",
    "local_name": "Tagalog"
  },
  {
    "code": "uk",
    "language": "Ukrainian",
    "local_name": "Українська (Ukraïns'ka)"
  },
  {
    "code": "ur",
    "language": "Urdu",
    "local_name": "اُردُو (Urdu)"
  },
  {
    "code": "vi",
    "language": "Vietnamese",
    "local_name": "Tiếng Việt"
  },
  {
    "code": "zh",
    "language": "Chinese",
    "local_name": "中文 (Zhōngwén)"
  },
  {
    "code": "zh-tw",
    "language": "Chinese (Taiwan)",
    "local_name": "繁體中文 (Fántǐ Zhōngwén)"
  },
  {
    "code": "zh-cn",
    "language": "Chinese (Mainland China)",
    "local_name": "简体中文 (Jiǎntǐ Zhōngwén)"
  },
  {
    "code": "lt",
    "language": "Lithuanian",
    "local_name": "Lietuviškai"
  }
] as const;

const SUPPORTED_LOCALE_CODES: Set<string> = new Set(SUPPORTED_LOCALES.map((item) => item.code));

const DEFAULT_TEXTS_BY_LOCALE: Record<string, LocaleTexts> = {
  "en": {
    "chat_title": "Support Chat",
    "message_placeholder": "Message",
    "initial_message": "Hello! How can I help you today?"
  },
  "en-gb": {
    "chat_title": "Support Chat",
    "message_placeholder": "Message",
    "initial_message": "Hello! How can I help you today?"
  },
  "ar": {
    "chat_title": "دردشة الدعم",
    "message_placeholder": "رسالة",
    "initial_message": "مرحبًا! كيف يمكنني مساعدتك اليوم؟"
  },
  "bg": {
    "chat_title": "Чат за поддръжка",
    "message_placeholder": "Съобщение",
    "initial_message": "Здравейте! Как мога да ви помогна днес?"
  },
  "bn": {
    "chat_title": "সাপোর্ট চ্যাট",
    "message_placeholder": "বার্তা",
    "initial_message": "হ্যালো! আজ আমি কীভাবে আপনাকে সাহায্য করতে পারি?"
  },
  "bs": {
    "chat_title": "Chat podrške",
    "message_placeholder": "Poruka",
    "initial_message": "Zdravo! Kako vam mogu pomoći danas?"
  },
  "ca": {
    "chat_title": "Xat de suport",
    "message_placeholder": "Missatge",
    "initial_message": "Hola! Com et puc ajudar avui?"
  },
  "cs": {
    "chat_title": "Chat podpory",
    "message_placeholder": "Zpráva",
    "initial_message": "Dobrý den! Jak vám dnes mohu pomoci?"
  },
  "da": {
    "chat_title": "Supportchat",
    "message_placeholder": "Besked",
    "initial_message": "Hej! Hvordan kan jeg hjælpe dig i dag?"
  },
  "de": {
    "chat_title": "Support-Chat",
    "message_placeholder": "Nachricht",
    "initial_message": "Hallo! Wie kann ich Ihnen heute helfen?"
  },
  "el": {
    "chat_title": "Συνομιλία υποστήριξης",
    "message_placeholder": "Μήνυμα",
    "initial_message": "Γεια σας! Πώς μπορώ να σας βοηθήσω σήμερα;"
  },
  "es": {
    "chat_title": "Chat de soporte",
    "message_placeholder": "Mensaje",
    "initial_message": "¡Hola! ¿Cómo puedo ayudarte hoy?"
  },
  "es-ar": {
    "chat_title": "Chat de soporte",
    "message_placeholder": "Mensaje",
    "initial_message": "¡Hola! ¿Cómo puedo ayudarte hoy?"
  },
  "et": {
    "chat_title": "Tugivestlus",
    "message_placeholder": "Sõnum",
    "initial_message": "Tere! Kuidas saan teid täna aidata?"
  },
  "fa": {
    "chat_title": "چت پشتیبانی",
    "message_placeholder": "پیام",
    "initial_message": "سلام! امروز چطور می‌توانم به شما کمک کنم؟"
  },
  "fi": {
    "chat_title": "Tukichat",
    "message_placeholder": "Viesti",
    "initial_message": "Hei! Miten voin auttaa sinua tänään?"
  },
  "fr": {
    "chat_title": "Chat d'assistance",
    "message_placeholder": "Message",
    "initial_message": "Bonjour ! Comment puis-je vous aider aujourd'hui ?"
  },
  "hi": {
    "chat_title": "सहायता चैट",
    "message_placeholder": "संदेश",
    "initial_message": "नमस्ते! मैं आज आपकी कैसे मदद कर सकता हूँ?"
  },
  "he": {
    "chat_title": "צ'אט תמיכה",
    "message_placeholder": "הודעה",
    "initial_message": "שלום! איך אפשר לעזור לך היום?"
  },
  "hr": {
    "chat_title": "Chat podrške",
    "message_placeholder": "Poruka",
    "initial_message": "Pozdrav! Kako vam mogu pomoći danas?"
  },
  "hu": {
    "chat_title": "Támogatási chat",
    "message_placeholder": "Üzenet",
    "initial_message": "Szia! Miben segíthetek ma?"
  },
  "id": {
    "chat_title": "Obrolan dukungan",
    "message_placeholder": "Pesan",
    "initial_message": "Halo! Bagaimana saya dapat membantu Anda hari ini?"
  },
  "it": {
    "chat_title": "Chat di supporto",
    "message_placeholder": "Messaggio",
    "initial_message": "Ciao! Come posso aiutarti oggi?"
  },
  "lv": {
    "chat_title": "Atbalsta čats",
    "message_placeholder": "Ziņojums",
    "initial_message": "Sveiki! Kā es varu jums palīdzēt šodien?"
  },
  "ms": {
    "chat_title": "Sembang sokongan",
    "message_placeholder": "Mesej",
    "initial_message": "Hai! Bagaimana saya boleh membantu anda hari ini?"
  },
  "no": {
    "chat_title": "Supportchat",
    "message_placeholder": "Melding",
    "initial_message": "Hei! Hvordan kan jeg hjelpe deg i dag?"
  },
  "ja": {
    "chat_title": "サポートチャット",
    "message_placeholder": "メッセージ",
    "initial_message": "こんにちは！本日はどのようにお手伝いできますか？"
  },
  "ko": {
    "chat_title": "지원 채팅",
    "message_placeholder": "메시지",
    "initial_message": "안녕하세요! 오늘 어떻게 도와드릴까요?"
  },
  "nl": {
    "chat_title": "Supportchat",
    "message_placeholder": "Bericht",
    "initial_message": "Hallo! Hoe kan ik je vandaag helpen?"
  },
  "pl": {
    "chat_title": "Czat wsparcia",
    "message_placeholder": "Wiadomość",
    "initial_message": "Cześć! Jak mogę Ci dziś pomóc?"
  },
  "pt": {
    "chat_title": "Chat de suporte",
    "message_placeholder": "Mensagem",
    "initial_message": "Olá! Como posso ajudar você hoje?"
  },
  "pt-br": {
    "chat_title": "Chat de suporte",
    "message_placeholder": "Mensagem",
    "initial_message": "Olá! Como posso ajudar você hoje?"
  },
  "ro": {
    "chat_title": "Chat de asistență",
    "message_placeholder": "Mesaj",
    "initial_message": "Salut! Cum te pot ajuta astăzi?"
  },
  "ru": {
    "chat_title": "Чат поддержки",
    "message_placeholder": "Сообщение",
    "initial_message": "Здравствуйте! Чем я могу помочь вам сегодня?"
  },
  "sk": {
    "chat_title": "Chat podpory",
    "message_placeholder": "Správa",
    "initial_message": "Dobrý deň! Ako vám môžem dnes pomôcť?"
  },
  "sq": {
    "chat_title": "Bisedë mbështetjeje",
    "message_placeholder": "Mesazh",
    "initial_message": "Përshëndetje! Si mund t'ju ndihmoj sot?"
  },
  "sr": {
    "chat_title": "Ћаскање подршке",
    "message_placeholder": "Порука",
    "initial_message": "Здраво! Како могу да вам помогнем данас?"
  },
  "sv": {
    "chat_title": "Supportchatt",
    "message_placeholder": "Meddelande",
    "initial_message": "Hej! Hur kan jag hjälpa dig idag?"
  },
  "sw": {
    "chat_title": "Gumzo la usaidizi",
    "message_placeholder": "Ujumbe",
    "initial_message": "Hujambo! Ninawezaje kukusaidia leo?"
  },
  "th": {
    "chat_title": "แชทช่วยเหลือ",
    "message_placeholder": "ข้อความ",
    "initial_message": "สวัสดี! วันนี้ฉันช่วยคุณได้อย่างไร?"
  },
  "tr": {
    "chat_title": "Destek sohbeti",
    "message_placeholder": "Mesaj",
    "initial_message": "Merhaba! Bugün size nasıl yardımcı olabilirim?"
  },
  "tl": {
    "chat_title": "Support chat",
    "message_placeholder": "Mensahe",
    "initial_message": "Kumusta! Paano kita matutulungan ngayon?"
  },
  "uk": {
    "chat_title": "Чат підтримки",
    "message_placeholder": "Повідомлення",
    "initial_message": "Вітаю! Чим я можу допомогти сьогодні?"
  },
  "ur": {
    "chat_title": "سپورٹ چیٹ",
    "message_placeholder": "پیغام",
    "initial_message": "ہیلو! آج میں آپ کی کیسے مدد کر سکتا ہوں؟"
  },
  "vi": {
    "chat_title": "Trò chuyện hỗ trợ",
    "message_placeholder": "Tin nhắn",
    "initial_message": "Xin chào! Tôi có thể giúp gì cho bạn hôm nay?"
  },
  "zh": {
    "chat_title": "支持聊天",
    "message_placeholder": "消息",
    "initial_message": "您好！今天我可以如何帮助您？"
  },
  "zh-tw": {
    "chat_title": "支援聊天",
    "message_placeholder": "訊息",
    "initial_message": "您好！今天我可以如何幫助您？"
  },
  "zh-cn": {
    "chat_title": "支持聊天",
    "message_placeholder": "消息",
    "initial_message": "您好！今天我可以如何帮助您？"
  },
  "lt": {
    "chat_title": "Pagalbos pokalbis",
    "message_placeholder": "Žinutė",
    "initial_message": "Sveiki! Kaip galiu jums padėti šiandien?"
  }
};

function normalizeLocale(locale: string | null | undefined): string | null {
  if (!locale) return null;
  const cleaned = locale.trim().toLowerCase().replace(/_/g, "-");
  return cleaned || null;
}

function matchLocale(locale: string | null | undefined): string | null {
  const normalized = normalizeLocale(locale);
  if (!normalized) return null;
  const direct = ALIASES[normalized] ?? normalized;
  if (SUPPORTED_LOCALE_CODES.has(direct)) return direct;
  const base = direct.split("-", 1)[0];
  if (SUPPORTED_LOCALE_CODES.has(base)) return base;
  return null;
}

export function resolveLocale(locale?: string | null, preferredLocales: string[] = []): string {
  const matched = matchLocale(locale);
  if (matched) return matched;
  for (const preferred of preferredLocales) {
    const preferredMatch = matchLocale(preferred);
    if (preferredMatch) return preferredMatch;
  }
  return "en";
}

export function defaultTextsForLocale(locale: string): LocaleTexts {
  const resolved = resolveLocale(locale);
  return { ...DEFAULT_TEXTS_BY_LOCALE[resolved] };
}

function sanitizeTexts(value: unknown): Partial<LocaleTexts> {
  if (!value || typeof value !== "object") return {};
  const record = value as Record<string, unknown>;
  const out: Partial<LocaleTexts> = {};
  for (const key of TEXT_KEYS) {
    const raw = record[key];
    if (typeof raw !== "string") continue;
    const cleaned = raw.trim();
    if (cleaned) out[key] = cleaned;
  }
  return out;
}

export function appLocalizationOverrides(app: { chatLocalizationOverrides: unknown }): Record<string, Partial<LocaleTexts>> {
  const raw = app.chatLocalizationOverrides;
  if (!raw || typeof raw !== "object") return {};
  const overrides = raw as Record<string, unknown>;
  const out: Record<string, Partial<LocaleTexts>> = {};
  for (const [locale, texts] of Object.entries(overrides)) {
    const resolved = matchLocale(locale);
    if (!resolved) continue;
    const cleaned = sanitizeTexts(texts);
    if (Object.keys(cleaned).length > 0) out[resolved] = cleaned;
  }
  return out;
}

export function buildCatalogResponse(app: { chatLocalizationOverrides: unknown }) {
  const overrides = appLocalizationOverrides(app);
  return SUPPORTED_LOCALES.map((locale) => {
    const defaults = defaultTextsForLocale(locale.code);
    const localeOverrides = overrides[locale.code] ?? {};
    const effective = { ...defaults, ...localeOverrides } as LocaleTexts;
    return {
      locale,
      defaults,
      effective,
      overrides: Object.keys(localeOverrides).length > 0 ? localeOverrides : null,
    };
  });
}

export function sanitizeOverridesForStorage(overrides: unknown): Record<string, Partial<LocaleTexts>> {
  if (!overrides || typeof overrides !== "object") return {};
  const payload = overrides as Record<string, unknown>;
  const stored: Record<string, Partial<LocaleTexts>> = {};
  for (const [locale, texts] of Object.entries(payload)) {
    const resolved = matchLocale(locale);
    if (!resolved) continue;
    const cleaned = sanitizeTexts(texts);
    if (Object.keys(cleaned).length === 0) continue;
    const defaults = defaultTextsForLocale(resolved);
    const diff: Partial<LocaleTexts> = {};
    for (const key of TEXT_KEYS) {
      const value = cleaned[key];
      if (typeof value === "string" && value !== defaults[key]) {
        diff[key] = value;
      }
    }
    if (Object.keys(diff).length > 0) stored[resolved] = diff;
  }
  return stored;
}
