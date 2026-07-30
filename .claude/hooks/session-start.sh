#!/bin/bash
set -euo pipefail

# Only reprovision in Claude Code on the web (fresh container each session).
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# Ponytail plugin (lazy-code-style guidance)
if ! claude plugin list 2>/dev/null | grep -q 'ponytail@ponytail'; then
  claude plugin marketplace add DietrichGebert/ponytail
  claude plugin install ponytail@ponytail
fi

# Graphify CLI (codebase knowledge graph)
if ! command -v graphify >/dev/null 2>&1; then
  if command -v uv >/dev/null 2>&1; then
    uv tool install graphifyy
  else
    pip install --user graphifyy
  fi
fi
