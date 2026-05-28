# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.0.0   | ✅ Yes    |

## Reporting a Vulnerability

If you discover a security vulnerability in CFMS, please report it privately rather than opening a public issue.

**Email:** vladarchitect@github

**Response timeline:**
- Initial acknowledgment: within 48 hours
- Triage and severity assessment: within 5 business days
- Fix timeline: depends on severity (critical: 48 hours; high: 1 week; medium/low: next release)

## Scope

CFMS is a read-only ServiceNow scoped application. The primary security concerns are:

1. **Unauthorized data access** — CFMS only reads from global tables (`sc_cat_item`, `item_option_new`, `sc_cat_item_guide`) using standard GlideRecord ACL enforcement. No custom ACL bypass.
2. **Report data exposure** — HTML/CSV reports may contain catalog item names and variable metadata. Ensure reports are stored and transmitted securely.
3. **Injection vectors** — Report rendering uses `_escapeHtml()` and `_escapeCsv()` to prevent XSS and CSV injection. Report any gaps in escaping logic.

## Out of Scope

- ServiceNow platform vulnerabilities (report to ServiceNow Support)
- Issues in forked repositories or modified source
- Social engineering or phishing attacks

## Acknowledgments

We appreciate responsible disclosure. With permission, we will acknowledge your contribution in release notes.
