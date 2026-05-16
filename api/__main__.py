import subprocess
import sys

from .config import ENABLE_ACCESS_LOG, PORT

cmd = [sys.executable, "-m", "uvicorn", "api.main:app", "--reload", "--port", str(PORT)]
if not ENABLE_ACCESS_LOG:
    cmd.append("--no-access-log")

try:
    subprocess.run(cmd)
except KeyboardInterrupt:
    pass
