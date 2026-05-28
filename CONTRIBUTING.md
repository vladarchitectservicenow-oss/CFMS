# Contributing to CFMS

Thank you for your interest in contributing to the ServiceNow Catalog Field Mapping Scanner.

## Development Setup

```bash
git clone https://github.com/vladarchitectservicenow-oss/CFMS.git
cd CFMS
node tests/test_cfms_scanner.js  # Verify test harness works
```

No additional dependencies required — the test harness is self-contained.

## Pull Request Process

1. Fork the repository and create a feature branch from `main`.
2. Add or update tests in `tests/test_cfms_scanner.js`.
3. Ensure all tests pass: `node tests/test_cfms_scanner.js`
4. If adding new source files, include the copyright header:
   ```
   Copyright (c) 2026 Vladimir Kapustin
   SPDX-License-Identifier: AGPL-3.0-only
   ```
5. Update documentation if adding new features or changing behavior.
6. Verify no build artifacts are staged: `git diff --cached --stat`
7. Submit a pull request with a clear description of the change and motivation.

## Code Style

- ServiceNow JavaScript (ES5 compatible with `Class.create()` pattern)
- 4-space indentation
- JSDoc comments for all public methods
- Descriptive variable names — no single-letter variables except loop counters
- Server-side only — no Client Scripts, UI Policies, or AngularJS dependencies

## Testing Guidelines

- **Unit tests** in `tests/test_cfms_scanner.js` using the MockGR runtime
- **Minimum:** All 5 core tests must pass before any commit
- **New features:** Add at least one test per new code path
- **Bug fixes:** Add a regression test that fails before the fix and passes after
- **PDI smoke tests** are deferred when the instance is hibernating — document this in the PR

## Commit Messages

Follow conventional commits:
- `feat:` for new features
- `fix:` for bug fixes
- `docs:` for documentation changes
- `test:` for test additions or fixes
- `refactor:` for code restructuring without behavior change

## License

By contributing, you agree that your contributions will be licensed under the AGPL-3.0-only License.
