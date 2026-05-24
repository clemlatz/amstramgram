import collections
import logging
from datetime import datetime
from pathlib import Path
from threading import Lock

_MAX_ENTRIES = 500
_DISPLAY_ENTRIES = 100
_buffer: collections.deque[str] = collections.deque(maxlen=_MAX_ENTRIES)
_lock = Lock()
_log_path: Path | None = None


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
                if _log_path is not None:
                    try:
                        with _log_path.open("a", encoding="utf-8") as f:
                            f.write(entry + "\n")
                    except OSError:
                        pass
        except Exception:
            self.handleError(record)


def init_log_buffer(log_path: Path) -> None:
    global _log_path
    with _lock:
        _log_path = log_path
        if not log_path.exists():
            return
        try:
            lines = log_path.read_text(encoding="utf-8").splitlines()
            for line in lines[-_MAX_ENTRIES:]:
                if line.strip():
                    _buffer.append(line)
        except OSError:
            pass


def get_logs() -> list[str]:
    with _lock:
        return list(reversed(_buffer))[:_DISPLAY_ENTRIES]
