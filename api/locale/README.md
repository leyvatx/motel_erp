# Traducciones del servidor

Los mensajes propios de la API están envueltos en `gettext_lazy` (`_("…")`), que
es la mitad del trabajo: marca *qué* se traduce. La otra mitad son los catálogos
`.po` con la traducción y los `.mo` compilados que Django lee en tiempo de
ejecución, y esos se generan con las herramientas GNU gettext.

**Mientras no exista `locale/en/LC_MESSAGES/django.mo`, estos mensajes salen en
español aunque el navegador pida inglés.** Lo que ya responde en los dos idiomas
sin hacer nada es lo que viene dentro de Django y DRF —validaciones de
contraseña, "This field is required."— porque esos catálogos vienen compilados
dentro de sus paquetes.

## Qué falta en esta máquina

`makemessages` y `compilemessages` necesitan los binarios `xgettext`, `msguniq`,
`msgmerge` y `msgfmt`. Aquí no están:

```
CommandError: Can't find msguniq. Make sure you have GNU gettext tools 0.19 or newer installed.
```

## Instalar las herramientas

**Windows** — con winget, que es lo que ya trae el sistema:

```bash
winget install -e --id GnuWin32.GetText
```

Después hay que agregar `C:\Program Files (x86)\GnuWin32\bin` al `PATH` y abrir
una terminal nueva. La alternativa sin instalar nada global es usar el
contenedor: `docker compose run --rm api` ya trae gettext en la imagen de
Debian.

**Linux (Debian/Ubuntu)**: `sudo apt-get install gettext`
**macOS**: `brew install gettext && brew link --force gettext`

## Generar y compilar

Desde `api/`, con el entorno virtual activo:

```bash
python manage.py makemessages -l en -l es --ignore=.venv --ignore=staticfiles
```

Eso escribe `locale/en/LC_MESSAGES/django.po` y su par en español con todas las
cadenas marcadas con `_()`. Se traducen a mano los `msgstr` vacíos del archivo
inglés —el español ya coincide con el original, así que puede quedarse vacío y
Django cae al texto fuente— y se compilan:

```bash
python manage.py compilemessages
```

A partir de ahí, `LocaleMiddleware` responde en el idioma que pide el navegador
por `Accept-Language`, que es lo que el frontend manda en cada petición.

## Al agregar mensajes nuevos

Envolver siempre con `_()` y usar interpolación con nombre, nunca f-strings:

```python
# Bien: el traductor puede mover el número dentro de la frase.
raise DomainError(_("La habitación %(numero)s ya está ocupada.") % {"numero": cuarto})

# Mal: la f-string se resuelve antes de que gettext la vea.
raise DomainError(f"La habitación {cuarto} ya está ocupada.")
```

Después de agregar, se vuelve a correr `makemessages` y `compilemessages`. El
`.po` conserva lo ya traducido y solo agrega lo nuevo.

## Qué quedó envuelto

112 mensajes literales de `DomainError`, `ValidationError` y familia en los doce
módulos de `apps/`, más las cuatro notificaciones que salen por WebSocket
(vencimiento de renta, stock mínimo y caducidad). Los mensajes que se arman con
f-strings dentro de servicios siguen sin envolver: se listan al correr
`makemessages`, y convertirlos a interpolación con nombre es el siguiente paso.
