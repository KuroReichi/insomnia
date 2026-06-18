#!/usr/bin/env bash
set -euo pipefail

BRANCH="code"
MSG="${1:-Update code}"

git checkout "$BRANCH"
git add .

if git diff --cached --quiet; then
	echo "Nothing to commit."
	exit 0
fi

git commit -m "$MSG"
git push origin "$BRANCH"