# Security Policy - Cadence

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

- **Email**: security@cadence.app (or contact the repository owner directly)
- **Do NOT** create a public GitHub issue for security vulnerabilities
- We will acknowledge receipt within 48 hours
- We will provide a detailed response within 7 days

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.x.x   | :white_check_mark: (development) |

## Security Measures

### Dependencies

- **Dependabot** monitors npm and GitHub Actions dependencies weekly
- `pnpm audit` runs on every PR and weekly via scheduled workflow
- High/critical vulnerabilities are flagged immediately
- Dependency updates are grouped (Expo ecosystem, dev deps, minor/patch)

### Code

- **ESLint security plugin** (`eslint-plugin-security`) enforces secure coding patterns
- TypeScript strict mode prevents common type-related vulnerabilities
- No `eval()`, no `new Function()`, no unsafe regex patterns
- No child process execution in client code
- All security-critical rules are set to `error` (blocking)

### Data

- **Supabase RLS** (Row Level Security) on ALL tables
- AES-256 encryption at rest (Supabase default)
- TLS 1.3 encryption in transit
- No sensitive data in URLs or query strings
- Soft delete only (no physical deletion)
- Secure storage for tokens (expo-secure-store)

### Secrets

- **TruffleHog** scans for accidentally committed secrets
- `.env` files in `.gitignore`
- All secrets stored in GitHub Secrets / Supabase Vault
- No secrets in code, comments, or commit messages

### Authentication

- Supabase Auth with email/password
- JWT tokens with automatic refresh
- Secure token storage using expo-secure-store
- Password reset via email with time-limited tokens

## Compliance

Cadence handles health-related data and is designed to comply with:

- **PIPEDA** (Personal Information Protection and Electronic Documents Act - Federal Canada)
- **Loi 25** (Quebec privacy law - Privacy officer designated)
- **GDPR-ready** (for future EU expansion)

## Security Checklist for Contributors

Before submitting a PR, ensure:

- [ ] No secrets, API keys, or credentials in code
- [ ] No `eval()` or `new Function()` usage
- [ ] No unsafe regex patterns (ReDoS vulnerable)
- [ ] No direct SQL queries (use Supabase client with RLS)
- [ ] Input validation on all user inputs
- [ ] Error messages don't expose sensitive info
- [ ] `pnpm lint:security` passes without errors

## Severity Levels by Sprint

The security enforcement evolves with the project:

| Sprint | `pnpm audit` Level | ESLint Security | Blocking on PR? |
|--------|-------------------|-----------------|-----------------|
| 2 (current) | `--audit-level=high` | Critical = error | No (warning) |
| 3-4 | `--audit-level=high` | All = warn minimum | Warning visible |
| 5+ | `--audit-level=moderate` | Critical = error | Yes (blocking) |
| Beta (Sprint 9+) | `--audit-level=low` | All = error | Strictly blocking |

## Running Security Audits Locally

```bash
# Full security audit
./scripts/audit-deps.sh

# Just pnpm audit
pnpm audit

# Just security lint
pnpm lint:security

# Fix automatically fixable audit issues
pnpm audit:fix
```

## Contact

For security concerns, contact:
- Repository owner: @ralphgabriel04
- Email: [Contact via GitHub]

---

*Last updated: Sprint 2 - v0.1.0-alpha.2*
