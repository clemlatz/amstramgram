import logging
import urllib.error
import urllib.parse
import urllib.request

from .config import TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID

logger = logging.getLogger(__name__)


def send_telegram_alert(text: str) -> None:
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        return
    if not text.strip():
        return
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    data = urllib.parse.urlencode({"chat_id": TELEGRAM_CHAT_ID, "text": text}).encode()
    try:
        with urllib.request.urlopen(url, data=data, timeout=10):
            pass
    except urllib.error.HTTPError as exc:
        logger.warning("Telegram alert failed: HTTP %d — %s", exc.code, exc.read().decode())
    except Exception as exc:
        logger.warning("Telegram alert failed: %s", exc)
