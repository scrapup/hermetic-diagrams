#!/usr/bin/env bash
#
# update.sh — reinstall the locally-developed hermetic-diagrams plugin from this source folder.
#
# Claude Code loads a plugin from a cache snapshot taken at install time; editing files here does
# not propagate on its own. This script uninstalls and reinstalls via the `claude` CLI, which
# re-copies the source into the cache. Mirrors the scrapforge update.sh pattern.
#
# Usage:  ./update.sh
# After running: execute /reload-plugins inside Claude Code (or restart the session).

set -euo pipefail

PLUGIN="hermetic-diagrams"
MARKETPLACE="local"
REF="${PLUGIN}@${MARKETPLACE}"

if ! command -v claude >/dev/null 2>&1; then
  echo "ERROR: the 'claude' CLI was not found on PATH." >&2
  exit 1
fi

VERSION="$(grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' \
  "$(dirname "$0")/.claude-plugin/plugin.json" 2>/dev/null \
  | head -1 | sed 's/.*"\([^"]*\)"$/\1/')"

echo "==> Reinstalling ${REF} (version ${VERSION:-?}) from local source..."

# Uninstall (ignore errors if it is not installed yet).
claude plugin uninstall "${REF}" -y || true

# Reinstall -> re-copies the source into the cache. Do NOT swallow errors here.
claude plugin install "${REF}"

echo
echo "==> Done. Cache snapshot refreshed."
echo "    To apply in the active Claude Code session, run:  /reload-plugins"
echo "    (or restart the session)."
