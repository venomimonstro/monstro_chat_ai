#!/usr/bin/env bash
# Аудит подключения LLM-провайдеров на сервере
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/monstro_chat_ai}"
API_BASE="${API_BASE:-http://127.0.0.1:3000/api}"

log()  { echo -e "\033[1;32m[llm-audit]\033[0m $*"; }
warn() { echo -e "\033[1;33m[llm-audit]\033[0m $*"; }
fail() { echo -e "\033[1;31m[llm-audit]\033[0m $*" >&2; exit 1; }

log "=== Аудит LLM / API-ключей ==="

# 1. API health
if ! curl -sf "${API_BASE}/health" >/dev/null; then
  fail "API недоступен: ${API_BASE}/health"
fi
log "API health OK"

# 2. Публичный статус AI
status="$(curl -sf "${API_BASE}/ai/status" 2>/dev/null || echo '{}')"
echo "${status}" | python3 -m json.tool 2>/dev/null || echo "${status}"

llm_ok="$(echo "${status}" | python3 -c "import sys,json; d=json.load(sys.stdin); print('yes' if d.get('llmConnected') else 'no')" 2>/dev/null || echo no)"
if [[ "${llm_ok}" != "yes" ]]; then
  warn "Нет доступных LLM-провайдеров (llmConnected=false)"
  warn "Проверьте: админка → LLM-провайдеры, или .env OPENROUTER_API_KEY / OPENAI_API_KEY"
else
  log "llmConnected=true"
fi

# 3. Redis
redis_code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "${API_BASE}/health/redis" 2>/dev/null || echo 000)"
if [[ "${redis_code}" != "200" ]]; then
  warn "Redis недоступен (HTTP ${redis_code}) — ключи из админки не сохранятся"
else
  log "Redis OK — ключи админки работают"
fi

# 4. INTEGRATION_ENCRYPTION_KEY в .env
env_file="${INSTALL_DIR}/.env"
if [[ -f "${env_file}" ]]; then
  if grep -q '^INTEGRATION_ENCRYPTION_KEY=.\+' "${env_file}" 2>/dev/null; then
    log "INTEGRATION_ENCRYPTION_KEY задан в .env"
  else
    warn "INTEGRATION_ENCRYPTION_KEY не задан — ключи в Redis не расшифруются после рестарта"
    warn "Запустите: sudo bash scripts/apply-redflow-env.sh"
  fi
else
  warn ".env не найден в ${INSTALL_DIR}"
fi

# 5. Env-ключи (masked)
for var in OPENROUTER_API_KEY OPENAI_API_KEY DEEPSEEK_API_KEY ANTHROPIC_API_KEY; do
  val="$(grep -E "^${var}=" "${env_file}" 2>/dev/null | cut -d= -f2- | tr -d '"' || true)"
  if [[ -n "${val}" && "${val}" != *change* && "${#val}" -ge 8 ]]; then
    log "${var}: задан (${val:0:4}…${val: -4})"
  else
    warn "${var}: не задан в .env"
  fi
done

# 6. OpenRouter model
or_model="$(grep -E '^OPENROUTER_MODEL=' "${env_file}" 2>/dev/null | cut -d= -f2- | tr -d '"' || true)"
if [[ -n "${or_model}" ]]; then
  log "OPENROUTER_MODEL=${or_model}"
else
  warn "OPENROUTER_MODEL не задан — используется default из кода (google/gemini-2.0-flash-001)"
fi

# 7. Прямой тест OpenRouter (если ключ в env)
or_key="$(grep -E '^OPENROUTER_API_KEY=' "${env_file}" 2>/dev/null | cut -d= -f2- | tr -d '"' || true)"
if [[ -n "${or_key}" && "${#or_key}" -ge 8 ]]; then
  model="${or_model:-google/gemini-2.0-flash-001}"
  log "Тест OpenRouter (${model})..."
  http_code="$(curl -s -o /tmp/llm-audit-out.json -w '%{http_code}' --max-time 20 \
    -X POST 'https://openrouter.ai/api/v1/chat/completions' \
    -H "Authorization: Bearer ${or_key}" \
    -H 'Content-Type: application/json' \
    -H "HTTP-Referer: https://redflow.ru" \
    -H 'X-Title: RedFlow' \
    -d "{\"model\":\"${model}\",\"messages\":[{\"role\":\"user\",\"content\":\"Say OK\"}],\"max_tokens\":5}" || echo 000)"
  if [[ "${http_code}" == "200" ]]; then
    log "OpenRouter direct test OK (HTTP 200)"
  else
    warn "OpenRouter direct test HTTP ${http_code}"
    head -c 400 /tmp/llm-audit-out.json 2>/dev/null || true
    echo ""
  fi
fi

echo ""
log "Рекомендации:"
echo "  1. Админка → LLM-провайдеры → сохранить ключ → «Проверить»"
echo "  2. POST ${API_BASE}/admin/providers/audit (нужен admin JWT)"
echo "  3. Если ключ в админке, но не работает — пересохраните после apply-redflow-env.sh"
echo ""
