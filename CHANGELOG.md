## [2.0.0](https://github.com/magarcia/cross-keychain/compare/v1.1.0...v2.0.0) (2026-11-08)

### ⚠ BREAKING CHANGES

- Minimum Node.js version is now >=20.12.0.
  Node.js 18 reached End of Life on March 27, 2025.

* Update engines field from >=18 to >=20.12.0
* Update CI matrix: remove Node 18, add Node 24
* Move coverage reporting to Node 22 (Active LTS)
* Bump CI standalone jobs from Node 20 to Node 22
* Update dependency-check workflow to Node 22

- chore: update all dependencies to latest versions

Update 22 dependencies including 6 major version bumps:

- eslint 9 → 10 (added name properties to flat config)
- @inquirer/prompts 7 → 8
- @rollup/plugin-commonjs 28 → 29
- @types/node 24 → 25
- eslint-plugin-jsdoc 61 → 62
- globals 16 → 17

Remove @typescript-eslint/eslint-plugin and @typescript-eslint/parser
from devDependencies (provided by typescript-eslint umbrella package).

Clean up knip.json: remove stale ignore and ignoreDependencies entries.

2 known vulnerabilities remain in bundled deps of npm@11.12.1 via
@semantic-release/npm (brace-expansion moderate, picomatch high).
These are dev-only and unfixable until upstream releases updates.

### 🚀 Features

- drop Node.js 18 support, update dependencies, and add supply chain protections ([#17](https://github.com/magarcia/cross-keychain/issues/17)) ([38d1f8f](https://github.com/magarcia/cross-keychain/commit/38d1f8fec281e18a6838706906835cbb0965b1ba)), closes [#13](https://github.com/magarcia/cross-keychain/issues/13) [#16](https://github.com/magarcia/cross-keychain/issues/16)

### 🐛 Bug Fixes

- **release:** pin changelog preset to 9.3.1 for writer 8 ([bf6507b](https://github.com/magarcia/cross-keychain/commit/bf6507b5a57f14fa0f9e400f0a35593cbf45ee40))
- resolve 11 security vulnerabilities via npm audit fix ([#15](https://github.com/magarcia/cross-keychain/issues/15)) ([d5c6108](https://github.com/magarcia/cross-keychain/commit/d5c610880f2e026477bd033d8fe495a79f01feac))

### 🔧 Miscellaneous Chores

- **release:** 2.0.0 [skip ci] ([b3adb40](https://github.com/magarcia/cross-keychain/commit/b3adb40d85a7806ee86f378f8660a38b41f7019c))
- **release:** drop premature 2.0.0 changelog section ([1d7c3de](https://github.com/magarcia/cross-keychain/commit/1d7c3de7385cb7a1e78b73f836a48229a3df49ae))
- **deps:** update all dependencies to latest versions ([#21](https://github.com/magarcia/cross-keychain/issues/21)) ([636db8d](https://github.com/magarcia/cross-keychain/commit/636db8dda87e860af3a453238b9db33333a604e4))
- **deps:** update devDependencies including 4 major version bumps ([#12](https://github.com/magarcia/cross-keychain/issues/12)) ([814c832](https://github.com/magarcia/cross-keychain/commit/814c832dc15f429d769b905cee64d7f5df6580c6)), closes [#7](https://github.com/magarcia/cross-keychain/issues/7) [#8](https://github.com/magarcia/cross-keychain/issues/8)
- update remaining outdated dependencies ([#6](https://github.com/magarcia/cross-keychain/issues/6)) ([f4b5212](https://github.com/magarcia/cross-keychain/commit/f4b52129fcfbec440deead41c5042de7185295af)), closes [#5](https://github.com/magarcia/cross-keychain/issues/5)

## 1.1.0 (2025-10-07)

- chore(deps): update outdated dependencies to latest versions (#4) ([7abfb10](https://github.com/magarcia/cross-keychain/commit/7abfb10)), closes [#4](https://github.com/magarcia/cross-keychain/issues/4)
- feat: add native Windows and Linux backends with automatic fallback ([a32202b](https://github.com/magarcia/cross-keychain/commit/a32202b))

## <small>1.0.1 (2025-09-30)</small>

- fix: add public access to npm publish config ([015bfc1](https://github.com/magarcia/cross-keychain/commit/015bfc1))

## 1.0.0 (2025-09-30)

- fix: add required permissions to release workflow ([2ae3a4c](https://github.com/magarcia/cross-keychain/commit/2ae3a4c))
- fix: remove unused CREDMAN_BOOTSTRAP export ([f2db720](https://github.com/magarcia/cross-keychain/commit/f2db720))
- feat: add interactive CLI prompts with inquirer integration ([696149b](https://github.com/magarcia/cross-keychain/commit/696149b))
- feat: initial cross-keychain implementation with professional setup ([fa4ae9b](https://github.com/magarcia/cross-keychain/commit/fa4ae9b))
- chore: update outdated dependencies to latest versions (#2) ([025666c](https://github.com/magarcia/cross-keychain/commit/025666c)), closes [#2](https://github.com/magarcia/cross-keychain/issues/2)

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
