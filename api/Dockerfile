FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY --chmod=0755 entrypoint.sh /usr/local/bin/entrypoint.sh
COPY . .

# Los estáticos salen siempre iguales de las mismas fuentes, y ya vienen dentro
# de la imagen: hornearlos aquí quita ~3 min de cada arranque en Render free,
# donde 0.1 de CPU tiene que comprimir 469 archivos antes de atender la primera
# petición. La llave es de mentiras y no queda en la imagen: collectstatic no
# firma nada, solo necesita que settings.py se deje importar.
RUN DJANGO_SECRET_KEY=solo-para-el-build python manage.py collectstatic --noinput

RUN adduser --system --group --no-create-home app \
    && mkdir -p /app/staticfiles /app/media \
    && chown -R app:app /app

USER app

EXPOSE 8000

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
# Los tres límites existen porque bajo ASGI cada petición en vuelo cuesta un
# hilo propio y una conexión del pool. Sin techo, un pico de tráfico multiplica
# ambos hasta que el contenedor se queda sin memoria y lo mata el sistema: el
# servicio no se degrada, desaparece. Con techo, el excedente recibe un 503 y
# vuelve a intentar, que es un mal rato en vez de una caída.
#
# --timeout-graceful-shutdown es el que faltaba de verdad: sin él uvicorn espera
# indefinidamente a que terminen las peticiones en curso cuando llega el SIGTERM
# de un despliegue, y una sola petición atorada convierte un reinicio limpio en
# un SIGKILL medio minuto después.
#
# No se pone --limit-max-requests: con --workers 1 uvicorn corre sin supervisor,
# así que en vez de reciclar el proceso lo terminaría, y eso es exactamente la
# caída que este archivo trata de evitar.
CMD ["sh", "-c", "exec uvicorn core.asgi:application \
     --host 0.0.0.0 --port ${PORT:-8000} \
     --workers ${WEB_CONCURRENCY:-4} \
     --limit-concurrency ${WEB_LIMIT_CONCURRENCY:-32} \
     --timeout-keep-alive ${WEB_KEEP_ALIVE:-15} \
     --timeout-graceful-shutdown ${WEB_GRACEFUL_TIMEOUT:-30} \
     --proxy-headers --forwarded-allow-ips '*'"]
