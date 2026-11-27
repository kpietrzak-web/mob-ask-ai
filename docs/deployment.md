# Deployment — mob-ask-ai

## Środowiska

| | Produkcja | Dev |
|---|---|---|
| **Serwer** | `ubuntu@146.59.115.24` | `ubuntu@146.59.115.24` |
| **Katalog** | `/var/www/mob-ask-ai` | `/var/www/mob-ask-ai-dev` |
| **Branch git** | `production` | `main` |
| **Port wewnętrzny** | 3000 | 3002 |
| **URL publiczny** | `https://elegance-invoicing.pl/ask-ai/` | `https://elegance-invoicing.pl/ask-ai-dev/` |
| **PM2 name** | `mob-ask-ai` | `mob-ask-ai-dev` |

Portal mock (OAuth): `/var/www/portal-mock`, port 3001, `https://elegance-invoicing.pl/portal/`.

## Uruchamianie procesów

Oba środowiska zarządzane przez **PM2** (`/usr/bin/tsx index.ts`), konfiguracja zapisana w `~/.pm2/dump.pm2` (`pm2 save`) — automatyczny restart po restarcie serwera.

```bash
# status
pm2 list

# restart produkcji
pm2 restart mob-ask-ai

# restart dev
pm2 restart mob-ask-ai-dev

# logi
pm2 logs mob-ask-ai --lines 50
pm2 logs mob-ask-ai-dev --lines 50
```

## Nginx

Plik konfiguracyjny: `/etc/nginx/sites-enabled/elegance-invoicing.pl`

| Location | Proxy do |
|---|---|
| `/ask-ai/` | `http://127.0.0.1:3000/` |
| `/ask-ai-dev/` | `http://127.0.0.1:3002/` |
| `/portal/` | `http://127.0.0.1:3001/` |

```bash
sudo nginx -t            # sprawdź konfigurację
sudo systemctl reload nginx
```

## .env

Plik `.env` **nie jest w repo**. Każde środowisko ma własny `.env` w swoim katalogu:
- `/var/www/mob-ask-ai/.env` — produkcja (PORT=3000 domyślnie, brak wpisanego)
- `/var/www/mob-ask-ai-dev/.env` — dev (PORT=3002)

Zmienne: `OPENAI_API_KEY`, `APP_KEY`, `SENTRY_DSN`, `PORT` (opcjonalne — domyślnie 3000).

## Wdrożenie produkcji

```bash
ssh ubuntu@146.59.115.24
cd /var/www/mob-ask-ai
git fetch origin
git checkout production
git pull origin production
npm install --omit=dev
pm2 restart mob-ask-ai
```

## Wdrożenie dev

```bash
ssh ubuntu@146.59.115.24
cd /var/www/mob-ask-ai-dev
git fetch origin
git pull origin main
npm install --omit=dev
pm2 restart mob-ask-ai-dev
```

## Backup

Backup katalogu produkcyjnego z 2026-11-27: `/var/www/mob-ask-ai.bak.20261127_074200`

## Aplikacja mobilna — połączenie z czatem AI

Logika wyboru URL (`src/devTools/askAi/useChat.ts`):

1. Jeśli `portal.aiServerUrl` jest ustawiony (z konfiguracji providera) → używa tej wartości
2. Jeśli `isDevelop() && ustawienia overrideują host/port` → używa niestandardowego URL
3. Domyślnie: `isDevelop()` → `https://elegance-invoicing.pl/ask-ai-dev`, prod → `https://elegance-invoicing.pl/ask-ai`

Ikona ustawień (trybik) w czacie widoczna **tylko gdy `isDevelop() === true`**. W buildzie produkcyjnym ustawienia są ignorowane.

Domyślne porty: dev = 3002, prod = 3000 (eksponowane przez nginx pod ścieżką, nie bezpośrednio).
