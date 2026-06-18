#!/usr/bin/env bash
set -euo pipefail

MSG="${1:-Release update}"

git checkout main
git merge --no-edit code
git push origin main