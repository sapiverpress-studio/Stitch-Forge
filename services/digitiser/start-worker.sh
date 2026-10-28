#!/bin/sh
set -eu
# Do not log credentials or artwork. Fail before binding if credentials are absent.
python -c 'import os; assert len(os.environ.get("STITCH_FORGE_WORKER_TOKEN", "")) >= 32, "Worker token must contain at least 32 characters"'
mkdir -p "$HOME"
export STITCH_FORGE_INKSTITCH_PATH="$(cat /opt/inkstitch/engine-path)"
exec xvfb-run -a -s '-screen 0 1280x800x24 -nolisten tcp' \
  gunicorn --bind "0.0.0.0:${PORT:-8080}" --workers 1 --worker-class gthread \
  --threads 2 --timeout 60 --graceful-timeout 5 --keep-alive 2 \
  --limit-request-line 2048 --limit-request-fields 16 --limit-request-field_size 4096 \
  --worker-tmp-dir /tmp --error-logfile - worker_wsgi:application
