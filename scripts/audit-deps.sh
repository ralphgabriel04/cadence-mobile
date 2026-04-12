#!/bin/bash
# scripts/audit-deps.sh
# Usage: ./scripts/audit-deps.sh [--ci]
# Runs a complete security audit of dependencies

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=========================================="
echo " Cadence Security Audit"
echo "=========================================="

AUDIT_FAILED=false
LINT_FAILED=false
ENV_LEAKED=false

# 1. pnpm audit
echo -e "\n${YELLOW}[1/3] Running pnpm audit...${NC}"
if pnpm audit --audit-level=high; then
  echo -e "${GREEN}No high/critical vulnerabilities found${NC}"
else
  echo -e "${RED}Vulnerabilities detected - review above${NC}"
  AUDIT_FAILED=true
fi

# 2. ESLint security
echo -e "\n${YELLOW}[2/3] Running ESLint security rules...${NC}"
if pnpm lint:security; then
  echo -e "${GREEN}No security lint issues${NC}"
else
  echo -e "${RED}Security lint issues detected${NC}"
  LINT_FAILED=true
fi

# 3. Check for .env files committed
echo -e "\n${YELLOW}[3/3] Checking for leaked secrets...${NC}"
if git ls-files | grep -E '\.env$|\.env\.local$|\.env\.production$' | grep -v '\.example'; then
  echo -e "${RED}CRITICAL: .env files detected in git!${NC}"
  ENV_LEAKED=true
else
  echo -e "${GREEN}No .env files in git${NC}"
fi

# Summary
echo -e "\n=========================================="
echo " Audit Summary"
echo "=========================================="

if [[ "${AUDIT_FAILED}" == "true" || "${LINT_FAILED}" == "true" || "${ENV_LEAKED}" == "true" ]]; then
  echo -e "${RED}Security audit FAILED - fix issues above${NC}"
  if [[ "${1:-}" == "--ci" ]]; then
    exit 1
  fi
else
  echo -e "${GREEN}Security audit PASSED${NC}"
fi
