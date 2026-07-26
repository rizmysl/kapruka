# 🖥️ Kapruka VPS Server Operations Guide

> **Server:** `root@178.104.188.37`  
> **Project Path:** `/var/www/ayla-ai`  
> **Database:** SQLite at `/var/www/ayla-ai/database/database.sqlite`  
> **Docker Compose Version:** v1 (use `docker-compose` with hyphen, NOT `docker compose`)

---

## 📌 Table of Contents

1. [Connecting to the VPS](#1-connecting-to-the-vps)
2. [Checking Docker Containers](#2-checking-docker-containers)
3. [Viewing Application Logs](#3-viewing-application-logs)
4. [Querying Chat Database Logs](#4-querying-chat-database-logs)
5. [Updating the Gemini Model](#5-updating-the-gemini-model)
6. [Deploying Code Changes](#6-deploying-code-changes)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. Connecting to the VPS

```bash
ssh root@178.104.188.37
```

---

## 2. Checking Docker Containers

### See all running containers
```bash
docker ps
```

### Expected containers for this project:
| Container Name       | Role                        | Internal Port |
|----------------------|-----------------------------|---------------|
| `kapruka-backend`    | Laravel PHP backend (API)   | 9000          |
| `kapruka-nginx`      | Nginx web server            | 80 → 8002     |
| `kapruka-ayla-front`  | React frontend              | 80 → 8081     |
| `kapruka-ayla-bridge` | Node.js MCP bridge          | 5001 → 3001   |

### Restart all containers
```bash
cd /var/www/ayla-ai
docker-compose down
docker-compose up -d
```

---

## 3. Viewing Application Logs

### 3.1 Laravel Application Logs (errors, warnings, debug info)

**View last 100 lines:**
```bash
tail -n 10 /var/www/ayla-ai/storage/logs/laravel.log
```

**Follow logs in real-time (live stream):**
```bash
tail -f /var/www/ayla-ai/storage/logs/laravel.log
```
> Press `Ctrl + C` to stop.

### 3.2 Docker Container Console Logs

**PHP Backend:**
```bash
docker logs --tail 100 kapruka-backend
```

**Nginx:**
```bash
docker logs --tail 100 kapruka-nginx
```

**Node.js Bridge:**
```bash
docker logs --tail 100 kapruka-ayla-bridge
```

**React Frontend:**
```bash
docker logs --tail 100 kapruka-ayla-front
```

**Follow any container log in real-time:**
```bash
docker logs --tail 50 -f kapruka-backend
```
> Press `Ctrl + C` to stop.

---

## 4. Querying Chat Database Logs

The chat logs (what users typed, what Ayla responded, which tool was called) are stored in the `concierge_logs` SQLite table.

> ⚠️ **IMPORTANT:** You must first enter the container shell. Running PHP/SQLite commands through `docker-compose exec` from the host **does not work** due to shell escaping issues.

### Step 1: Enter the container shell
```bash
docker exec -it kapruka-backend sh
```

You will see a `#` prompt — you are now inside the container.

### Step 2: Run your queries

#### Get total record count
```bash
php -r "\$db = new PDO('sqlite:/var/www/database/database.sqlite'); echo \$db->query('SELECT COUNT(*) FROM concierge_logs')->fetchColumn().PHP_EOL;"
```

#### View last 10 chat logs (user messages + timestamps)
```bash
php -r "\$db = new PDO('sqlite:/var/www/database/database.sqlite'); foreach(\$db->query('SELECT id, user_message, created_at FROM concierge_logs ORDER BY id DESC LIMIT 10') as \$r) echo \$r['id'].' | '.\$r['user_message'].' | '.\$r['created_at'].PHP_EOL;"
```

#### View last 100 chat logs
```bash
php -r "\$db = new PDO('sqlite:/var/www/database/database.sqlite'); foreach(\$db->query('SELECT id, user_message, created_at FROM concierge_logs ORDER BY id DESC LIMIT 100') as \$r) echo \$r['id'].' | '.\$r['user_message'].' | '.\$r['created_at'].PHP_EOL;"
```

#### View last 10 records WITH AI responses
```bash
php -r "\$db = new PDO('sqlite:/var/www/database/database.sqlite'); foreach(\$db->query('SELECT id, user_message, ai_response, created_at FROM concierge_logs ORDER BY id DESC LIMIT 10') as \$r) echo \$r['id'].' | '.\$r['user_message'].' | '.\$r['ai_response'].' | '.\$r['created_at'].PHP_EOL;"
```

#### View last 10 records WITH tool called and search query
```bash
php -r "\$db = new PDO('sqlite:/var/www/database/database.sqlite'); foreach(\$db->query('SELECT id, user_message, tool_called, search_query, created_at FROM concierge_logs ORDER BY id DESC LIMIT 10') as \$r) echo \$r['id'].' | '.\$r['user_message'].' | '.\$r['tool_called'].' | '.\$r['search_query'].' | '.\$r['created_at'].PHP_EOL;"
```

#### Search for a specific user message (e.g. containing "cake")
```bash
php -r "\$db = new PDO('sqlite:/var/www/database/database.sqlite'); foreach(\$db->query(\"SELECT id, user_message, created_at FROM concierge_logs WHERE user_message LIKE '%cake%' ORDER BY id DESC LIMIT 20\") as \$r) echo \$r['id'].' | '.\$r['user_message'].' | '.\$r['created_at'].PHP_EOL;"
```

#### List all available tables in the database
```bash
php -r "\$db = new PDO('sqlite:/var/www/database/database.sqlite'); foreach(\$db->query('SELECT name FROM sqlite_master WHERE type=\"table\"') as \$row) echo \$row['name'].PHP_EOL;"
```

### Step 3: Exit the container
```bash
exit
```

### Database Table Schema: `concierge_logs`

| Column         | Type     | Description                                    |
|----------------|----------|------------------------------------------------|
| `id`           | INTEGER  | Auto-increment primary key                     |
| `session_id`   | VARCHAR  | Browser session ID (nullable)                  |
| `user_message` | TEXT     | What the user typed                            |
| `tool_called`  | VARCHAR  | Which MCP tool was invoked (nullable)          |
| `search_query` | VARCHAR  | The search keyword sent to Kapruka API (nullable) |
| `ai_response`  | TEXT     | Ayla's text response to the user (nullable)    |
| `created_at`   | DATETIME | When the interaction happened                  |
| `updated_at`   | DATETIME | Last update timestamp                          |

---

## 5. Updating the Gemini Model

If the Gemini API returns a `404` error saying the model is no longer available, you need to update the model name.

### Step 1: Edit the `.env` file on the VPS
```bash
nano /var/www/ayla-ai/.env
```

Find and update the `GEMINI_MODEL` line:
```ini
GEMINI_MODEL=gemini-3.5-flash
```
> Save with `Ctrl + O`, then exit with `Ctrl + X`.

### Step 2: Clear and rebuild Laravel config cache
```bash
cd /var/www/ayla-ai
docker-compose exec -T kapruka-backend php artisan config:clear
docker-compose exec -T kapruka-backend php artisan config:cache
```

---

## 6. Deploying Code Changes

From your **local machine** (not the VPS), run:
```bash
cd /Users/rizmy/Documents/Projects/Kapruka/kapruka
./deploy.sh
```

This script will:
1. Sync code to the VPS via `rsync`
2. Rebuild Docker containers
3. Install PHP dependencies
4. Run database migrations
5. Clear and rebuild Laravel caches

---

## 7. Troubleshooting

### "docker: unknown command: docker compose"
Use `docker-compose` (with hyphen). This VPS has Docker Compose **v1**.

### "unknown shorthand flag: '-n' in -n"
Don't pass flags like `-n 100` directly through `docker-compose exec`. Instead:
- Use `docker logs --tail 100 <container>` for container logs
- Use `tail -n 100 <file>` directly on the host for file logs

### Chat logs showing empty (0 records)
- **Mock Mode:** If the frontend has Mock Mode enabled, the backend returns fake data without saving to the database.
- **API Errors:** If the Gemini API key is invalid or the model is deprecated, the error response path may not log to the database.
- Check the Laravel log for errors: `tail -n 50 /var/www/ayla-ai/storage/logs/laravel.log`

### Container not starting
```bash
cd /var/www/ayla-ai
docker-compose logs kapruka-backend
docker-compose down
docker-compose up -d --build
```
