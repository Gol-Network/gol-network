#!/usr/bin/env bash
set -euo pipefail

repo_dir="${GOL_REPO_DIR:-/opt/gol-network}"
test "${EUID:-$(id -u)}" = '0' || { echo 'run as root' >&2; exit 1; }
test -x "$repo_dir/deploy/poll-production-release.sh" || {
  echo 'release poller is missing from the production checkout' >&2
  exit 1
}

install -m 0755 "$repo_dir/deploy/poll-production-release.sh" \
  /usr/local/sbin/gol-production-release
install -m 0644 "$repo_dir/deploy/systemd/gol-production-release.service" \
  /etc/systemd/system/gol-production-release.service
install -m 0644 "$repo_dir/deploy/systemd/gol-production-release.timer" \
  /etc/systemd/system/gol-production-release.timer
systemctl daemon-reload
systemctl enable --now gol-production-release.timer
systemctl start gol-production-release.service
