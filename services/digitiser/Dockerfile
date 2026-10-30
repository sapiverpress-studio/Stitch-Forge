# Build from repository root; Linux amd64 only. No image is published by CI.
FROM ubuntu:24.04
ENV DEBIAN_FRONTEND=noninteractive PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-venv ca-certificates inkscape libnsl2 libwayland-server0 xvfb xauth \
    && rm -rf /var/lib/apt/lists/*
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:${PATH}"
WORKDIR /app
COPY services/digitiser/requirements-worker.txt /app/
RUN pip install --no-cache-dir -r requirements-worker.txt
COPY services/digitiser/requirements-artwork-trial.txt /app/
RUN pip install --no-cache-dir -r requirements-artwork-trial.txt
COPY services/digitiser/ /app/
RUN python install_engine.py /opt/inkstitch && chmod -R a+rX /opt/inkstitch \
    && useradd --uid 10001 --no-create-home worker
USER 10001:10001
ENV HOME=/tmp/home QT_QPA_PLATFORM=xcb PORT=8080
EXPOSE 8080
ENTRYPOINT ["/bin/sh", "/app/start-worker.sh"]
