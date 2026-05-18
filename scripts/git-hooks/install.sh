#!/usr/bin/env sh
# Install Quivo's standard git hooks into .git/hooks.
#
# Idempotent: re-running just overwrites the symlinks.

set -e

ROOT="$(git rev-parse --show-toplevel)"
HOOK_DIR="$ROOT/.git/hooks"
SRC_DIR="$ROOT/scripts/git-hooks"

if [ ! -d "$HOOK_DIR" ]; then
  echo "✗ $HOOK_DIR does not exist — is this a git checkout?" >&2
  exit 1
fi

for hook in pre-commit; do
  src="$SRC_DIR/$hook"
  if [ ! -f "$src" ]; then continue; fi
  dest="$HOOK_DIR/$hook"
  rm -f "$dest"
  cp "$src" "$dest"
  chmod +x "$dest"
  echo "✓ installed $hook"
done

echo "✓ Quivo git hooks installed."
