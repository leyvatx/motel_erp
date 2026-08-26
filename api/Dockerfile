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
CMD ["sh", "-c", "exec uvicorn core.asgi:application \
     --host 0.0.0.0 --port ${PORT:-8000} \
     --workers ${WEB_CONCURRENCY:-4} --proxy-headers --forwarded-allow-ips '*'"]
