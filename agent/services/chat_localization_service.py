from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from agent.models.app import App

TEXT_KEYS = ("chat_title", "message_placeholder", "initial_message")

_DEFAULT_TEXTS = {
    "chat_title": "Support Chat",
    "message_placeholder": "Message",
    "initial_message": "Hello! How can I help you today?",
}

_ALIASES = {
    "zh-hans": "zh-cn",
    "zh-hant": "zh-tw",
}


@dataclass(frozen=True)
class LocaleInfo:
    code: str
    language: str
    local_name: str


SUPPORTED_LOCALES: list[LocaleInfo] = [
    LocaleInfo("en", "English", "English"),
    LocaleInfo("ar", "Arabic", "العربية (Al-ʿarabiyyah)"),
    LocaleInfo("bg", "Bulgarian", "български (bǎlgarski)"),
    LocaleInfo("bn", "Bengali", "বাংলা (Bangla)"),
    LocaleInfo("bs", "Bosnian", "bosanski"),
    LocaleInfo("ca", "Catalan", "Català"),
    LocaleInfo("cs", "Czech", "Čeština"),
    LocaleInfo("da", "Danish", "Dansk"),
    LocaleInfo("de", "German", "Deutsch"),
    LocaleInfo("el", "Greek", "Ελληνικά (Elliniká)"),
    LocaleInfo("en-gb", "English (United Kingdom)", "English (United Kingdom)"),
    LocaleInfo("es", "Spanish", "Español"),
    LocaleInfo("es-ar", "Spanish (Argentina)", "Español (Argentina)"),
    LocaleInfo("et", "Estonian", "Eesti"),
    LocaleInfo("fa", "Persian", "فارسی (Fârsi)"),
    LocaleInfo("fi", "Finnish", "Suomi"),
    LocaleInfo("fr", "French", "Français"),
    LocaleInfo("hi", "Hindi", "हिन्दी (Hindī)"),
    LocaleInfo("he", "Hebrew", "עברית (Ivrit)"),
    LocaleInfo("hr", "Croatian", "Hrvatski"),
    LocaleInfo("hu", "Hungarian", "Magyar"),
    LocaleInfo("id", "Indonesian", "Bahasa Indonesia"),
    LocaleInfo("it", "Italian", "Italiano"),
    LocaleInfo("lv", "Latvian", "Latviešu"),
    LocaleInfo("ms", "Malay", "Bahasa Melayu"),
    LocaleInfo("no", "Norwegian", "Norsk"),
    LocaleInfo("ja", "Japanese", "日本語 (Nihongo)"),
    LocaleInfo("ko", "Korean", "한국어 (Hangugeo)"),
    LocaleInfo("nl", "Dutch", "Nederlands"),
    LocaleInfo("pl", "Polish", "Polski"),
    LocaleInfo("pt", "Portuguese", "Português"),
    LocaleInfo("pt-br", "Portuguese (Brazil)", "Português (Brasil)"),
    LocaleInfo("ro", "Romanian", "Română"),
    LocaleInfo("ru", "Russian", "Русский (Russkiy)"),
    LocaleInfo("sk", "Slovak", "Slovenčina"),
    LocaleInfo("sq", "Albanian", "Shqip"),
    LocaleInfo("sr", "Serbian", "Српски (Srpski)"),
    LocaleInfo("sv", "Swedish", "Svenska"),
    LocaleInfo("sw", "Swahili", "Kiswahili"),
    LocaleInfo("th", "Thai", "ไทย (Thai)"),
    LocaleInfo("tr", "Turkish", "Türkçe"),
    LocaleInfo("tl", "Tagalog", "Tagalog"),
    LocaleInfo("uk", "Ukrainian", "Українська (Ukraïns'ka)"),
    LocaleInfo("ur", "Urdu", "اُردُو (Urdu)"),
    LocaleInfo("vi", "Vietnamese", "Tiếng Việt"),
    LocaleInfo("zh", "Chinese", "中文 (Zhōngwén)"),
    LocaleInfo("zh-tw", "Chinese (Taiwan)", "繁體中文 (Fántǐ Zhōngwén)"),
    LocaleInfo("zh-cn", "Chinese (Mainland China)", "简体中文 (Jiǎntǐ Zhōngwén)"),
    LocaleInfo("lt", "Lithuanian", "Lietuviškai"),
]

SUPPORTED_LOCALE_CODES = {item.code for item in SUPPORTED_LOCALES}

_DEFAULT_TEXTS_BY_LOCALE: dict[str, dict[str, str]] = {
    "en": {"chat_title": "Support Chat", "message_placeholder": "Message", "initial_message": "Hello! How can I help you today?"},
    "en-gb": {"chat_title": "Support Chat", "message_placeholder": "Message", "initial_message": "Hello! How can I help you today?"},
    "ar": {"chat_title": "دردشة الدعم", "message_placeholder": "رسالة", "initial_message": "مرحبًا! كيف يمكنني مساعدتك اليوم؟"},
    "bg": {"chat_title": "Чат за поддръжка", "message_placeholder": "Съобщение", "initial_message": "Здравейте! Как мога да ви помогна днес?"},
    "bn": {"chat_title": "সাপোর্ট চ্যাট", "message_placeholder": "বার্তা", "initial_message": "হ্যালো! আজ আমি কীভাবে আপনাকে সাহায্য করতে পারি?"},
    "bs": {"chat_title": "Chat podrške", "message_placeholder": "Poruka", "initial_message": "Zdravo! Kako vam mogu pomoći danas?"},
    "ca": {"chat_title": "Xat de suport", "message_placeholder": "Missatge", "initial_message": "Hola! Com et puc ajudar avui?"},
    "cs": {"chat_title": "Chat podpory", "message_placeholder": "Zpráva", "initial_message": "Dobrý den! Jak vám dnes mohu pomoci?"},
    "da": {"chat_title": "Supportchat", "message_placeholder": "Besked", "initial_message": "Hej! Hvordan kan jeg hjælpe dig i dag?"},
    "de": {"chat_title": "Support-Chat", "message_placeholder": "Nachricht", "initial_message": "Hallo! Wie kann ich Ihnen heute helfen?"},
    "el": {"chat_title": "Συνομιλία υποστήριξης", "message_placeholder": "Μήνυμα", "initial_message": "Γεια σας! Πώς μπορώ να σας βοηθήσω σήμερα;"},
    "es": {"chat_title": "Chat de soporte", "message_placeholder": "Mensaje", "initial_message": "¡Hola! ¿Cómo puedo ayudarte hoy?"},
    "es-ar": {"chat_title": "Chat de soporte", "message_placeholder": "Mensaje", "initial_message": "¡Hola! ¿Cómo puedo ayudarte hoy?"},
    "et": {"chat_title": "Tugivestlus", "message_placeholder": "Sõnum", "initial_message": "Tere! Kuidas saan teid täna aidata?"},
    "fa": {"chat_title": "چت پشتیبانی", "message_placeholder": "پیام", "initial_message": "سلام! امروز چطور می‌توانم به شما کمک کنم؟"},
    "fi": {"chat_title": "Tukichat", "message_placeholder": "Viesti", "initial_message": "Hei! Miten voin auttaa sinua tänään?"},
    "fr": {"chat_title": "Chat d'assistance", "message_placeholder": "Message", "initial_message": "Bonjour ! Comment puis-je vous aider aujourd'hui ?"},
    "hi": {"chat_title": "सहायता चैट", "message_placeholder": "संदेश", "initial_message": "नमस्ते! मैं आज आपकी कैसे मदद कर सकता हूँ?"},
    "he": {"chat_title": "צ'אט תמיכה", "message_placeholder": "הודעה", "initial_message": "שלום! איך אפשר לעזור לך היום?"},
    "hr": {"chat_title": "Chat podrške", "message_placeholder": "Poruka", "initial_message": "Pozdrav! Kako vam mogu pomoći danas?"},
    "hu": {"chat_title": "Támogatási chat", "message_placeholder": "Üzenet", "initial_message": "Szia! Miben segíthetek ma?"},
    "id": {"chat_title": "Obrolan dukungan", "message_placeholder": "Pesan", "initial_message": "Halo! Bagaimana saya dapat membantu Anda hari ini?"},
    "it": {"chat_title": "Chat di supporto", "message_placeholder": "Messaggio", "initial_message": "Ciao! Come posso aiutarti oggi?"},
    "lv": {"chat_title": "Atbalsta čats", "message_placeholder": "Ziņojums", "initial_message": "Sveiki! Kā es varu jums palīdzēt šodien?"},
    "ms": {"chat_title": "Sembang sokongan", "message_placeholder": "Mesej", "initial_message": "Hai! Bagaimana saya boleh membantu anda hari ini?"},
    "no": {"chat_title": "Supportchat", "message_placeholder": "Melding", "initial_message": "Hei! Hvordan kan jeg hjelpe deg i dag?"},
    "ja": {"chat_title": "サポートチャット", "message_placeholder": "メッセージ", "initial_message": "こんにちは！本日はどのようにお手伝いできますか？"},
    "ko": {"chat_title": "지원 채팅", "message_placeholder": "메시지", "initial_message": "안녕하세요! 오늘 어떻게 도와드릴까요?"},
    "nl": {"chat_title": "Supportchat", "message_placeholder": "Bericht", "initial_message": "Hallo! Hoe kan ik je vandaag helpen?"},
    "pl": {"chat_title": "Czat wsparcia", "message_placeholder": "Wiadomość", "initial_message": "Cześć! Jak mogę Ci dziś pomóc?"},
    "pt": {"chat_title": "Chat de suporte", "message_placeholder": "Mensagem", "initial_message": "Olá! Como posso ajudar você hoje?"},
    "pt-br": {"chat_title": "Chat de suporte", "message_placeholder": "Mensagem", "initial_message": "Olá! Como posso ajudar você hoje?"},
    "ro": {"chat_title": "Chat de asistență", "message_placeholder": "Mesaj", "initial_message": "Salut! Cum te pot ajuta astăzi?"},
    "ru": {"chat_title": "Чат поддержки", "message_placeholder": "Сообщение", "initial_message": "Здравствуйте! Чем я могу помочь вам сегодня?"},
    "sk": {"chat_title": "Chat podpory", "message_placeholder": "Správa", "initial_message": "Dobrý deň! Ako vám môžem dnes pomôcť?"},
    "sq": {"chat_title": "Bisedë mbështetjeje", "message_placeholder": "Mesazh", "initial_message": "Përshëndetje! Si mund t'ju ndihmoj sot?"},
    "sr": {"chat_title": "Ћаскање подршке", "message_placeholder": "Порука", "initial_message": "Здраво! Како могу да вам помогнем данас?"},
    "sv": {"chat_title": "Supportchatt", "message_placeholder": "Meddelande", "initial_message": "Hej! Hur kan jag hjälpa dig idag?"},
    "sw": {"chat_title": "Gumzo la usaidizi", "message_placeholder": "Ujumbe", "initial_message": "Hujambo! Ninawezaje kukusaidia leo?"},
    "th": {"chat_title": "แชทช่วยเหลือ", "message_placeholder": "ข้อความ", "initial_message": "สวัสดี! วันนี้ฉันช่วยคุณได้อย่างไร?"},
    "tr": {"chat_title": "Destek sohbeti", "message_placeholder": "Mesaj", "initial_message": "Merhaba! Bugün size nasıl yardımcı olabilirim?"},
    "tl": {"chat_title": "Support chat", "message_placeholder": "Mensahe", "initial_message": "Kumusta! Paano kita matutulungan ngayon?"},
    "uk": {"chat_title": "Чат підтримки", "message_placeholder": "Повідомлення", "initial_message": "Вітаю! Чим я можу допомогти сьогодні?"},
    "ur": {"chat_title": "سپورٹ چیٹ", "message_placeholder": "پیغام", "initial_message": "ہیلو! آج میں آپ کی کیسے مدد کر سکتا ہوں؟"},
    "vi": {"chat_title": "Trò chuyện hỗ trợ", "message_placeholder": "Tin nhắn", "initial_message": "Xin chào! Tôi có thể giúp gì cho bạn hôm nay?"},
    "zh": {"chat_title": "支持聊天", "message_placeholder": "消息", "initial_message": "您好！今天我可以如何帮助您？"},
    "zh-tw": {"chat_title": "支援聊天", "message_placeholder": "訊息", "initial_message": "您好！今天我可以如何幫助您？"},
    "zh-cn": {"chat_title": "支持聊天", "message_placeholder": "消息", "initial_message": "您好！今天我可以如何帮助您？"},
    "lt": {"chat_title": "Pagalbos pokalbis", "message_placeholder": "Žinutė", "initial_message": "Sveiki! Kaip galiu jums padėti šiandien?"},
}


def normalize_locale(locale: str | None) -> str | None:
    if not locale:
        return None
    cleaned = locale.strip().lower().replace("_", "-")
    return cleaned or None


def _match_locale(locale: str | None) -> str | None:
    normalized = normalize_locale(locale)
    if not normalized:
        return None
    direct = _ALIASES.get(normalized, normalized)
    if direct in SUPPORTED_LOCALE_CODES:
        return direct
    base = direct.split("-", 1)[0]
    if base in SUPPORTED_LOCALE_CODES:
        return base
    return None


def resolve_locale(locale: str | None = None, preferred_locales: list[str] | None = None) -> str:
    if preferred_locales is None:
        preferred_locales = []

    matched = _match_locale(locale)
    if matched:
        return matched

    for preferred in preferred_locales:
        matched = _match_locale(preferred)
        if matched:
            return matched
    return "en"


def default_texts_for_locale(locale: str) -> dict[str, str]:
    resolved = resolve_locale(locale)
    return dict(_DEFAULT_TEXTS_BY_LOCALE.get(resolved, _DEFAULT_TEXTS))


def _sanitize_texts(value: Any) -> dict[str, str]:
    if hasattr(value, "model_dump"):
        value = value.model_dump()
    if not isinstance(value, dict):
        try:
            value = dict(value)
        except Exception:
            return {}
    out: dict[str, str] = {}
    for key in TEXT_KEYS:
        raw = value.get(key)
        if not isinstance(raw, str):
            continue
        cleaned = raw.strip()
        if cleaned:
            out[key] = cleaned
    return out


def app_localization_overrides(app: App) -> dict[str, dict[str, str]]:
    raw_value = getattr(app, "chat_localization_overrides", {})
    raw = raw_value if isinstance(raw_value, dict) else {}
    out: dict[str, dict[str, str]] = {}
    for locale, texts in raw.items():
        resolved = _match_locale(locale)
        if not resolved:
            continue
        cleaned = _sanitize_texts(texts)
        if cleaned:
            out[resolved] = cleaned
    return out


def effective_texts(app: App, locale: str) -> dict[str, str]:
    resolved = resolve_locale(locale)
    defaults = default_texts_for_locale(resolved)
    overrides = app_localization_overrides(app).get(resolved, {})
    merged = dict(defaults)
    merged.update(overrides)
    return merged


def build_catalog_response(app: App) -> list[dict[str, Any]]:
    overrides = app_localization_overrides(app)
    rows: list[dict[str, Any]] = []
    for locale in SUPPORTED_LOCALES:
        defaults = default_texts_for_locale(locale.code)
        merged = dict(defaults)
        locale_overrides = overrides.get(locale.code, {})
        merged.update(locale_overrides)
        rows.append(
            {
                "locale": {
                    "code": locale.code,
                    "language": locale.language,
                    "local_name": locale.local_name,
                },
                "defaults": defaults,
                "effective": merged,
                "overrides": locale_overrides or None,
            }
        )
    return rows


def sanitize_overrides_for_storage(overrides: dict[str, dict[str, str]]) -> dict[str, dict[str, str]]:
    stored: dict[str, dict[str, str]] = {}
    for locale, texts in overrides.items():
        resolved = _match_locale(locale)
        if not resolved:
            continue
        cleaned = _sanitize_texts(texts)
        if not cleaned:
            continue
        defaults = default_texts_for_locale(resolved)
        diff = {key: val for key, val in cleaned.items() if val != defaults[key]}
        if diff:
            stored[resolved] = diff
    return stored
