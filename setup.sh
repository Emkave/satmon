#!/usr/bin/env bash
# Satmon local setup script for macOS and Linux (Fedora, Debian, Ubuntu, Mint, Arch, Kali, ...).
# Run from the repo root:  ./setup.sh   (chmod +x setup.sh first if needed)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

# Color helpers (fall back to plain text if not a TTY).
if [ -t 1 ]; then
    C_CYAN=$'\033[36m'; C_GREEN=$'\033[32m'; C_YELLOW=$'\033[33m'; C_RED=$'\033[31m'; C_OFF=$'\033[0m'
else
    C_CYAN=""; C_GREEN=""; C_YELLOW=""; C_RED=""; C_OFF=""
fi
step() { printf '\n%s==> %s%s\n' "$C_CYAN"   "$1" "$C_OFF"; }
ok()   { printf '    %s%s%s\n'   "$C_GREEN"  "$1" "$C_OFF"; }
warn() { printf '    %s%s%s\n'   "$C_YELLOW" "$1" "$C_OFF"; }
err()  { printf '    %s%s%s\n'   "$C_RED"    "$1" "$C_OFF"; }

# Detect OS / distro so we can print a useful install hint if Node is missing.
detect_install_hint() {
    local uname_s
    uname_s="$(uname -s)"
    if [ "$uname_s" = "Darwin" ]; then
        echo "macOS:  brew install node     # or use nvm: https://github.com/nvm-sh/nvm"
        return
    fi
    if [ -r /etc/os-release ]; then
        # shellcheck disable=SC1091
        . /etc/os-release
        local id_all=" ${ID:-} ${ID_LIKE:-} "
        case "$id_all" in
            *" fedora "*|*" rhel "*|*" centos "*)
                echo "Fedora/RHEL:  sudo dnf install -y nodejs npm" ;;
            *" debian "*|*" ubuntu "*|*" linuxmint "*|*" kali "*)
                echo "Debian/Ubuntu/Mint/Kali:  sudo apt update && sudo apt install -y nodejs npm"
                echo "  (apt nodejs is often old — for Node 18+ use NodeSource:"
                echo "   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt install -y nodejs)" ;;
            *" arch "*|*" manjaro "*|*" endeavouros "*)
                echo "Arch/Manjaro:  sudo pacman -S --needed nodejs npm" ;;
            *)
                echo "Linux (${ID:-unknown}):  install Node.js 18+ via your package manager,"
                echo "  or use nvm: https://github.com/nvm-sh/nvm" ;;
        esac
    else
        echo "Install Node.js 18+ from https://nodejs.org/ or via nvm: https://github.com/nvm-sh/nvm"
    fi
}

# 1. Check Node + npm
step "Checking Node.js and npm"
if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
    err "Node.js or npm not found on PATH."
    echo ""
    echo "Install Node.js 18 LTS or newer, then re-run this script:"
    echo ""
    detect_install_hint | sed 's/^/  /'
    echo ""
    echo "After installing, open a new shell so PATH is refreshed."
    exit 1
fi
ok "node $(node --version)  npm $(npm --version)"

# 2. Install dependencies
step "Installing npm dependencies"
if [ -f package-lock.json ]; then
    npm ci
else
    npm install
fi
ok "Dependencies installed."

# 3. Copy Cesium runtime assets into public/cesium
#    Mirrors .github/workflows/deploy.yml so dev and prod resolve assets the same way.
step "Copying Cesium runtime assets to public/cesium"
CESIUM_SRC="$REPO_ROOT/node_modules/cesium/Build/Cesium"
CESIUM_DST="$REPO_ROOT/public/cesium"
if [ ! -d "$CESIUM_SRC" ]; then
    err "Expected $CESIUM_SRC to exist after npm install. Aborting."
    exit 1
fi
rm -rf "$CESIUM_DST"
mkdir -p "$CESIUM_DST"
for sub in Workers ThirdParty Assets Widgets; do
    cp -R "$CESIUM_SRC/$sub" "$CESIUM_DST/$sub"
done
ok "Cesium assets copied."

# 4. Bootstrap .env from .env.example if missing
step "Checking .env"
if [ -f .env ]; then
    ok ".env already exists — leaving it alone."
else
    if [ ! -f .env.example ]; then
        err ".env.example is missing — cannot bootstrap .env."
        exit 1
    fi
    cp .env.example .env
    warn ".env created from .env.example."
    warn "Open .env and fill in REACT_APP_CESIUM_TOKEN before running 'npm start'."
    warn "Generate a token at https://cesium.com/ion/tokens"
fi

step "Done"
echo "    Next steps:"
echo "      1. Fill in REACT_APP_CESIUM_TOKEN in .env (if you have not already)."
echo "      2. npm start"
