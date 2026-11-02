#!/usr/bin/env bash
# ============================================================================
# deploy-ssl.sh — Extract PFX → PEM and configure Nginx for TalentScope
# ============================================================================
# Usage:
#   sudo bash deploy-ssl.sh /path/to/infi2026_6.pfx
#
# This script:
#   1. Extracts the private key, server cert, and CA chain from the PFX
#   2. Builds a fullchain.pem (server cert + intermediates)
#   3. Installs certs and Nginx config
#   4. Tests and reloads Nginx
# ============================================================================
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PFX_FILE="${1:-}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
NGINX_DIR="$SCRIPT_DIR"

if [[ -z "$PFX_FILE" ]]; then
    echo -e "${RED}Usage: sudo bash deploy-ssl.sh /path/to/infi2026_6.pfx${NC}"
    exit 1
fi

if [[ ! -f "$PFX_FILE" ]]; then
    echo -e "${RED}Error: PFX file not found: $PFX_FILE${NC}"
    exit 1
fi

if [[ $EUID -ne 0 ]]; then
    echo -e "${RED}Error: This script must be run as root (sudo)${NC}"
    exit 1
fi

# ── Step 1: Ask for PFX password ─────────────────────────────────────────────
echo -e "${YELLOW}Enter the PFX password:${NC}"
read -rs PFX_PASS
echo ""

TMPDIR=$(mktemp -d)
trap "rm -rf $TMPDIR" EXIT

# ── Step 2: Extract components from PFX ──────────────────────────────────────
echo -e "${YELLOW}[1/6] Extracting private key...${NC}"
openssl pkcs12 -in "$PFX_FILE" -nocerts -nodes -passin "pass:$PFX_PASS" \
    -out "$TMPDIR/server.key" 2>/dev/null
if [[ ! -s "$TMPDIR/server.key" ]]; then
    echo -e "${RED}Error: Failed to extract private key. Wrong password?${NC}"
    exit 1
fi

echo -e "${YELLOW}[2/6] Extracting server certificate...${NC}"
openssl pkcs12 -in "$PFX_FILE" -clcerts -nokeys -passin "pass:$PFX_PASS" \
    -out "$TMPDIR/server.crt" 2>/dev/null

echo -e "${YELLOW}[3/6] Extracting CA chain (intermediate + root)...${NC}"
openssl pkcs12 -in "$PFX_FILE" -cacerts -nokeys -chain -passin "pass:$PFX_PASS" \
    -out "$TMPDIR/ca-chain.crt" 2>/dev/null || true

# ── Step 3: Build fullchain.pem ──────────────────────────────────────────────
echo -e "${YELLOW}[4/6] Building fullchain.pem...${NC}"

# fullchain = server cert + intermediate CAs (order matters for TLS)
cat "$TMPDIR/server.crt" > "$TMPDIR/fullchain.pem"
if [[ -s "$TMPDIR/ca-chain.crt" ]]; then
    cat "$TMPDIR/ca-chain.crt" >> "$TMPDIR/fullchain.pem"
    echo -e "${GREEN}  ✓ Intermediate CA certificates included in chain${NC}"
else
    echo -e "${YELLOW}  ⚠ No intermediate CA certs found in PFX — this may cause ERR_CERT_AUTHORITY_INVALID!${NC}"
    echo -e "${YELLOW}    If the error persists, you need to manually append the intermediate CA cert.${NC}"
fi

# Show cert details
echo ""
echo -e "${GREEN}Certificate details:${NC}"
openssl x509 -in "$TMPDIR/server.crt" -noout -subject -issuer -dates -ext subjectAltName 2>/dev/null || \
    openssl x509 -in "$TMPDIR/server.crt" -noout -subject -issuer -dates
echo ""

# Verify the key matches the cert
CERT_MD5=$(openssl x509 -noout -modulus -in "$TMPDIR/server.crt" | openssl md5)
KEY_MD5=$(openssl rsa -noout -modulus -in "$TMPDIR/server.key" 2>/dev/null | openssl md5)
if [[ "$CERT_MD5" != "$KEY_MD5" ]]; then
    echo -e "${RED}Error: Private key does NOT match the certificate!${NC}"
    exit 1
fi
echo -e "${GREEN}  ✓ Private key matches certificate${NC}"

# Check if cert covers the domain
CERT_SUBJECT=$(openssl x509 -in "$TMPDIR/server.crt" -noout -subject 2>/dev/null)
CERT_SAN=$(openssl x509 -in "$TMPDIR/server.crt" -noout -ext subjectAltName 2>/dev/null || echo "")
if echo "$CERT_SUBJECT $CERT_SAN" | grep -qi "talentscope\|infinite\.com\|\*\.infinite"; then
    echo -e "${GREEN}  ✓ Certificate covers the domain${NC}"
else
    echo -e "${YELLOW}  ⚠ Certificate may not cover talentscope.infinite.com — check the subject/SAN above${NC}"
fi

# Check expiry
EXPIRY=$(openssl x509 -in "$TMPDIR/server.crt" -noout -enddate | cut -d= -f2)
EXPIRY_EPOCH=$(date -d "$EXPIRY" +%s 2>/dev/null || echo 0)
NOW_EPOCH=$(date +%s)
if [[ $EXPIRY_EPOCH -lt $NOW_EPOCH ]]; then
    echo -e "${RED}  ✗ Certificate has EXPIRED on $EXPIRY${NC}"
    echo -e "${RED}    You need a new certificate. This one won't fix the issue.${NC}"
    exit 1
else
    DAYS_LEFT=$(( (EXPIRY_EPOCH - NOW_EPOCH) / 86400 ))
    echo -e "${GREEN}  ✓ Certificate valid for $DAYS_LEFT more days (expires: $EXPIRY)${NC}"
fi

# ── Step 4: Install certificates ─────────────────────────────────────────────
echo ""
echo -e "${YELLOW}[5/6] Installing certificates...${NC}"

install -m 644 "$TMPDIR/fullchain.pem" /etc/ssl/certs/talentscope.fullchain.pem
install -m 600 "$TMPDIR/server.key"    /etc/ssl/private/talentscope.key
chown root:root /etc/ssl/certs/talentscope.fullchain.pem
chown root:root /etc/ssl/private/talentscope.key

echo -e "${GREEN}  ✓ Cert → /etc/ssl/certs/talentscope.fullchain.pem${NC}"
echo -e "${GREEN}  ✓ Key  → /etc/ssl/private/talentscope.key${NC}"

# ── Step 5: Install Nginx config ─────────────────────────────────────────────
echo -e "${YELLOW}[6/6] Configuring Nginx...${NC}"

# Install location snippets
install -d /etc/nginx/snippets
install -m 644 "$NGINX_DIR/locations.conf" /etc/nginx/snippets/talentscope-locations.conf

# Install rate-limit zones into conf.d (http-level)
install -m 644 "$NGINX_DIR/ratelimit-zones.conf" /etc/nginx/conf.d/talentscope-ratelimit.conf

# Install site config
install -m 644 "$NGINX_DIR/talentscope.conf" /etc/nginx/sites-available/talentscope
ln -sf /etc/nginx/sites-available/talentscope /etc/nginx/sites-enabled/talentscope

# Remove default site if it conflicts
if [[ -L /etc/nginx/sites-enabled/default ]]; then
    rm -f /etc/nginx/sites-enabled/default
    echo -e "${GREEN}  ✓ Removed default Nginx site${NC}"
fi

# Test Nginx config
echo ""
if nginx -t 2>&1; then
    echo ""
    systemctl reload nginx
    echo -e "${GREEN}══════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  ✓ SSL certificate installed and Nginx reloaded!${NC}"
    echo -e "${GREEN}  ✓ https://talentscope.infinite.com should now work${NC}"
    echo -e "${GREEN}══════════════════════════════════════════════════════════════${NC}"
else
    echo ""
    echo -e "${RED}Nginx config test failed! Check the errors above.${NC}"
    echo -e "${RED}Nginx was NOT reloaded — existing site still works.${NC}"
    exit 1
fi

