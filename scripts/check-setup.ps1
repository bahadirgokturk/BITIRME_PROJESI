# Gelistirme ortamini kontrol eder; hicbir seyi kurmaz veya degistirmez.
# Kullanim: powershell -ExecutionPolicy Bypass -File scripts\check-setup.ps1

$script:failures = 0
$script:warnings = 0

function Write-Result([string]$status, [string]$message) {
    $colors = @{ OK = "Green"; WARN = "Yellow"; FAIL = "Red" }
    Write-Host ("[{0,-4}] {1}" -f $status, $message) -ForegroundColor $colors[$status]
    if ($status -eq "FAIL") { $script:failures++ }
    if ($status -eq "WARN") { $script:warnings++ }
}

# Programin varligini ve (varsa) minimum surumunu kontrol et.
# $required=$false olanlar eksikse sadece uyari verir.
function Test-Tool([string]$name, [string]$versionArgs, [version]$minVersion, [bool]$required) {
    $command = Get-Command $name -ErrorAction SilentlyContinue
    $missingStatus = if ($required) { "FAIL" } else { "WARN" }
    if (-not $command) {
        Write-Result $missingStatus "$name bulunamadi. docs/ONBOARDING.md bolum 1'e bak."
        return
    }
    $output = (& $name $versionArgs.Split(" ") 2>&1 | Out-String).Trim()
    $match = [regex]::Match($output, "\d+\.\d+(\.\d+)?")
    if (-not $minVersion -or -not $match.Success) {
        Write-Result "OK" "$name -> $output"
        return
    }
    $found = [version]$match.Value
    $status = if ($found -ge $minVersion) { "OK" } else { $missingStatus }
    Write-Result $status "$name $found (en az $minVersion gerekli)"
}

Write-Host "`nCampusFlow AI - ortam kontrolu`n"

Test-Tool "git"    "--version" ([version]"2.40") $true
Test-Tool "docker" "--version" $null             $true
Test-Tool "node"   "--version" ([version]"20.0") $false
Test-Tool "python" "--version" ([version]"3.12") $false
Test-Tool "uv"     "--version" $null             $false

# Docker daemon calisiyor mu ve compose v2 var mi
if (Get-Command docker -ErrorAction SilentlyContinue) {
    docker info *> $null
    if ($LASTEXITCODE -eq 0) { Write-Result "OK" "Docker daemon calisiyor" }
    else { Write-Result "FAIL" "Docker daemon calismiyor: Docker Desktop'i baslat" }
    docker compose version *> $null
    if ($LASTEXITCODE -eq 0) { Write-Result "OK" "docker compose v2 mevcut" }
    else { Write-Result "FAIL" "docker compose v2 bulunamadi" }
}

# Git kimligi commit'lerde gorunur
$gitName = git config user.name
$gitEmail = git config user.email
if ($gitName -and $gitEmail) { Write-Result "OK" "git kimligi: $gitName <$gitEmail>" }
else { Write-Result "FAIL" "git user.name / user.email ayarli degil (ONBOARDING bolum 2)" }

# OneDrive/Dropbox senkronizasyonu build'i yavaslatir ve dosya kilitler
$repoRoot = (Resolve-Path "$PSScriptRoot\..").Path
if ($repoRoot -match "OneDrive|Dropbox|Google Drive") {
    Write-Result "WARN" "Repo senkronize klasorde: $repoRoot -> C:\dev\campusflow altina klonla"
}
else { Write-Result "OK" "Repo konumu: $repoRoot" }

# .gitattributes LF kullanir; autocrlf=true gereksiz diff uretir
$autocrlf = git config core.autocrlf
if ($autocrlf -eq "true") { Write-Result "WARN" "core.autocrlf=true: 'git config --global core.autocrlf false' onerilir" }
else { Write-Result "OK" "core.autocrlf: $(if ($autocrlf) { $autocrlf } else { 'ayarsiz' })" }

$envFile = Join-Path $repoRoot ".env"
$envExample = Join-Path $repoRoot ".env.example"
if (Test-Path $envFile) { Write-Result "OK" ".env mevcut" }
elseif (Test-Path $envExample) { Write-Result "WARN" ".env yok: 'copy .env.example .env' calistir" }
else { Write-Result "OK" ".env.example henuz yok (FAZ 1'de eklenecek)" }

Write-Host "`nSonuc: $script:failures hata, $script:warnings uyari`n"
exit $script:failures
