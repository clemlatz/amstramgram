import collections
import logging
from datetime import datetime
from threading import Lock

_MAX_ENTRIES = 500
_buffer: collections.deque[str] = collections.deque(maxlen=_MAX_ENTRIES)
_lock = Lock()


class AppLogHandler(logging.Handler):
    def emit(self, record: logging.LogRecord) -> None:
        try:
            ts = datetime.now().strftime("%d/%m %H:%M")
            msg = record.getMessage()
            if record.levelno >= logging.ERROR:
                entry = f"{ts} - [ERROR] {msg}"
            elif record.levelno >= logging.WARNING:
                entry = f"{ts} - [WARN] {msg}"
            else:
                entry = f"{ts} - {msg}"
            with _lock:
                _buffer.append(entry)
        except Exception:
            self.handleError(record)


def get_logs() -> list[str]:
    with _lock:
        return list(reversed(_buffer))
