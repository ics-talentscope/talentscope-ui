#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
NGINX_DIR="$HERE/../nginx"
QWEN_DIR="$HERE/../../../python-ai/qwen"

install -d -m 755 /var/lib/talentscope-monitor /usr/local/lib/talentscope-monitor
install -m 755 "$HERE/collect.py" /usr/local/lib/talentscope-monitor/collect.py

changed=0
install_unit() {
  if ! cmp -s "$1" "/etc/systemd/system/$(basename "$1")"; then
    install -m 644 "$1" "/etc/systemd/system/$(basename "$1")"
    changed=1
  fi
}
for unit in talentscope-monitor.service talentscope-monitor.timer talentscope-docker-prune.service talentscope-docker-prune.timer; do
  install_unit "$HERE/$unit"
done
[[ -f "$QWEN_DIR/qwen.service" ]] && install_unit "$QWEN_DIR/qwen.service"

install -m 644 "$HERE/99-talentscope.conf" /etc/sysctl.d/99-talentscope.conf
sysctl --system >/dev/null

if [[ ! -f /etc/docker/daemon.json ]]; then
  install -m 644 "$HERE/docker-daemon.json" /etc/docker/daemon.json
  echo "docker: daemon.json installed; restart docker in a maintenance window to apply log rotation"
fi

if command -v nginx >/dev/null 2>&1 && [[ -d /etc/nginx/conf.d ]]; then
  install -m 644 "$NGINX_DIR/ratelimit-zones.conf" /etc/nginx/conf.d/talentscope-ratelimit.conf
  if nginx -t >/dev/null 2>&1; then
    systemctl reload nginx
  else
    rm -f /etc/nginx/conf.d/talentscope-ratelimit.conf
    echo "nginx: zones file rejected by nginx -t and removed; existing config untouched"
  fi
fi

if [[ $changed == 1 ]]; then systemctl daemon-reload; fi
systemctl enable --now talentscope-monitor.timer talentscope-docker-prune.timer >/dev/null
systemctl start talentscope-monitor.service
echo "vm-monitor: snapshot written $(stat -c %y /var/lib/talentscope-monitor/snapshot.json)"
