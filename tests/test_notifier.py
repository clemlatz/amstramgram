from unittest.mock import MagicMock, patch

from api.notifier import send_telegram_alert


def test_no_op_when_not_configured():
    with patch("api.notifier.TELEGRAM_BOT_TOKEN", None), \
         patch("api.notifier.TELEGRAM_CHAT_ID", None), \
         patch("urllib.request.urlopen") as mock_urlopen:
        send_telegram_alert("test message")
        mock_urlopen.assert_not_called()


def test_sends_message_when_configured():
    mock_cm = MagicMock()
    mock_cm.__enter__ = MagicMock(return_value=mock_cm)
    mock_cm.__exit__ = MagicMock(return_value=False)

    with patch("api.notifier.TELEGRAM_BOT_TOKEN", "test-token"), \
         patch("api.notifier.TELEGRAM_CHAT_ID", "12345"), \
         patch("urllib.request.urlopen", return_value=mock_cm) as mock_urlopen:
        send_telegram_alert("Scheduler stopped")

        mock_urlopen.assert_called_once()
        call_args = mock_urlopen.call_args
        url = call_args.args[0]
        data = call_args.kwargs["data"]
        assert "test-token" in url
        assert b"chat_id=12345" in data
        assert b"Scheduler+stopped" in data or b"Scheduler%20stopped" in data


def test_swallows_network_error():
    with patch("api.notifier.TELEGRAM_BOT_TOKEN", "test-token"), \
         patch("api.notifier.TELEGRAM_CHAT_ID", "12345"), \
         patch("urllib.request.urlopen", side_effect=OSError("network error")):
        send_telegram_alert("test message")  # must not raise
