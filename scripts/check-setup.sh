#!/usr/bin/env bash
# Gelistirme ortamini kontrol eder; hicbir seyi kurmaz veya degistirmez.
# Kullanim: bash scripts/check-setup.sh
set -u

failures=0
warnings=0

result() {
  local status=$1 message=$2
  case $status in
    OK)   printf '\033[32m[OK  ]\033[0m %s\n' "$message" ;;
    WARN) printf '\033[33m[WARN]\033[0m %s\n' "$message"; warnings=$((warnings + 1)) ;;
    FAIL) printf '\033[31m[FAIL]\033[0m %s\n' "$message"; failures=$((failures + 1)) ;;
  esac
}

# $1=komut $2=minimum surum (bos olabilir) $3=zorunlu mu (1/0)
check_tool() {
  local name=$1 min=$2 required=$3
  local missing_status=WARN
  [ "$required" = 1 ] && missing_status=FAIL
  if ! command -v "$name" >/dev/null 2>&1; then
    result "$missing_status" "$name bulunamadi. docs/ONBOARDING.md bolum 1'e bak."
    return
  fi
  local found
  found=$("$name" --version 2>&1 | grep -oE '[0-9]+\.[0-9]+(\.[0-9]+)?' | head -1)
  # Windows'taki Microsoft Store python3 kisayolu gibi sahte komutlar surum dondurmez
  if [ -z "$found" ]; then
    result "$missing_status" "$name bulundu ama surumu okunamadi (gercek kurulum mu?)"
    return
  fi
  if [ -z "$min" ]; then
    result OK "$name $found"
    return
  fi
  # sort -V ile surum karsilastirmasi: en kucuk olan min ise yeterli
  if [ "$(printf '%s\n%s\n' "$min" "$found" | sort -V | head -1)" = "$min" ]; then
    result OK "$name $found (en az $min)"
  else
    result "$missing_status" "$name $found (en az $min gerekli)"
  fi
}

printf '\nCampusFlow AI - ortam kontrolu\n\n'

check_tool git 2.40 1
check_tool docker "" 1
check_tool node 20.0 0
check_tool python3 3.12 0
check_tool uv "" 0

if command -v docker >/dev/null 2>&1; then
  if docker info >/dev/null 2>&1; then result OK "Docker daemon calisiyor"
  else result FAIL "Docker daemon calismiyor: Docker Desktop'i baslat"; fi
  if docker compose version >/dev/null 2>&1; then result OK "docker compose v2 mevcut"
  else result FAIL "docker compose v2 bulunamadi"; fi
fi

if [ -n "$(git config user.name)" ] && [ -n "$(git config user.email)" ]; then
  result OK "git kimligi: $(git config user.name) <$(git config user.email)>"
else
  result FAIL "git user.name / user.email ayarli degil (ONBOARDING bolum 2)"
fi

repo_root=$(cd "$(dirname "$0")/.." && pwd)
case $repo_root in
  *OneDrive*|*Dropbox*|*"Google Drive"*) result WARN "Repo senkronize klasorde: $repo_root" ;;
  *) result OK "Repo konumu: $repo_root" ;;
esac

# .gitattributes LF kullanir; autocrlf=true gereksiz diff uretir
if [ "$(git config core.autocrlf)" = "true" ]; then
  result WARN "core.autocrlf=true: 'git config --global core.autocrlf false' onerilir"
else
  result OK "core.autocrlf: $(git config core.autocrlf || echo ayarsiz)"
fi

if [ -f "$repo_root/.env" ]; then result OK ".env mevcut"
elif [ -f "$repo_root/.env.example" ]; then result WARN ".env yok: 'cp .env.example .env' calistir"
else result OK ".env.example henuz yok (FAZ 1'de eklenecek)"; fi

printf '\nSonuc: %s hata, %s uyari\n\n' "$failures" "$warnings"
exit "$failures"
