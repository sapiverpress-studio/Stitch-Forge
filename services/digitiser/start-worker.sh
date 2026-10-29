#!/bin/sh
set -eu
# Do not log credentials or artwork. Fail before binding if credentials are absent.
python -c 'import os; assert len(os.environ.get("STITCH_FORGE_WORKER_TOKEN", "")) >= 32, "Worker token must contain at least 32 characters"'
mkdir -p "$HOME"
export STITCH_FORGE_INKSTITCH_PATH="$(cat /opt/inkstitch/engine-path)"
# Dedicated container only: local Unix display, no TCP, no external X clients.
# Avoid xvfb-run's signal/retry startup path; bounded readiness and visible errors.
export DISPLAY=:99
Xvfb "$DISPLAY" -screen 0 1280x800x24 -nolisten tcp -ac &
display_pid=$!
trap 'kill "$display_pid" 2>/dev/null || true' EXIT INT TERM
python - "$display_pid" <<'PY'
import os, sys, time, socket
for _ in range(100):
    os.kill(int(sys.argv[1]), 0)
    try:
        with socket.socket(socket.AF_UNIX) as sock:
            sock.connect('/tmp/.X11-unix/X99')
        break
    except OSError:
        time.sleep(.1)
else:
    raise SystemExit('Headless display did not become ready within 10 seconds')
PY
exec gunicorn --bind "0.0.0.0:${PORT:-8080}" --workers 1 --worker-class gthread \
  --threads 2 --timeout 60 --graceful-timeout 5 --keep-alive 2 \
  --limit-request-line 2048 --limit-request-fields 16 --limit-request-field_size 4096 \
  --worker-tmp-dir /tmp --error-logfile - worker_wsgi:application
