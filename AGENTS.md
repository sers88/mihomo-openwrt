# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project overview

This repo builds three OpenWrt APK packages from upstream sources:

* `net/mihomo` — the mihomo (Clash Meta) proxy core, compiled from source with the Go toolchain inside the OpenWrt SDK
* `net/mihomo-metacubexd` — the metacubexd web dashboard (prebuilt static files), installed to `/usr/share/mihomo/ui`, `PKGARCH:=all`, `DEPENDS:=+mihomo`
* `net/luci-app-mihomo` — a minimal LuCI app (client-side JS view + menu/acl JSON, no rpcd backend of its own), `PKGARCH:=all`, `DEPENDS:=+luci-base +mihomo`; plain package Makefile, deliberately not using luci.mk since this is not the luci feed

`.github/workflows/build.yml` is the single CI pipeline: matrix build for `aarch64_generic` and `x86_64`, triggered by schedule (every 6h), PRs to `main`, and manual dispatch. It resolves the latest upstream releases, substitutes versions/hashes into the Makefiles, builds all three APKs, publishes them to a GitHub release, prunes old releases down to 2, and publishes a signed APK feed to GitHub Pages (`feed` job) that is verified end-to-end in an OpenWrt container (`feed-test` job).

`install.sh` at the repo root is the on-device installer/updater: it detects the arch, downloads the latest release, installs both APKs, seeds a starter config if missing, and enables the service. Re-running it updates to the latest release.

## Critical invariants — do not break these

1. **Placeholders, not hardcoded versions.** Both Makefiles carry `PKG_VERSION:=stable` and `PKG_HASH:=skip` as placeholders. The CI pipeline `sed`-substitutes them at build time. Never hardcode a version or hash in committed files — the sed patterns in `build.yml` match the literal strings `PKG_VERSION:=stable` and `PKG_HASH:=skip`.

2. **Tabs in Makefile recipes.** OpenWrt package Makefiles use hard tabs for recipe indentation, not spaces. A space-indented recipe silently breaks the build. When editing `net/*/Makefile`, verify tabs are preserved.

3. **Flat metacubexd archive.** The `compressed-dist.tgz` upstream asset is flat (no top-level directory). `Build/Prepare` unpacks it into `$(PKG_BUILD_DIR)/dist`, and the install recipe copies `$(PKG_BUILD_DIR)/dist/.` into `$(1)`. Do not copy from `$(PKG_BUILD_DIR)` itself — the install target lives inside the build dir and `cp` would fail with "cannot copy a directory into itself" (this broke CI once already).

4. **SDK target mapping.** In `build.yml`, `aarch64_generic` builds against the `rockchip/armv8` SDK, `x86_64` against `x86/64`. Both use OpenWrt 25.12.2.

5. **Conditional CI steps.** Steps after `Check if build already exists` are gated on `env.SKIP_BUILD != 'true'`. When adding build steps, preserve this condition or they will fail on skip runs.

6. **Version resolution.** Upstream versions come from `/releases/latest` (GitHub API), not git tags. mihomo's latest *tag* and latest *release* can diverge; keep the releases-based logic and the null-guard.

7. **Release layout contract.** Assets are renamed to include the matrix arch suffix: `mihomo-<ver>-r1_<arch>.apk`, `mihomo-metacubexd-<ver>-r1_<arch>.apk`, `luci-app-mihomo-<ver>-r1_<arch>.apk` (the LuCI app is versioned after the mihomo TAG). The skip-check in CI greps for exactly these three patterns per arch; the release upload uses the single glob `sdk/bin/packages/*/*/*.apk` (only our own packages land there), while upload-artifact lists explicit globs — `mihomo*` does NOT match `luci-app-mihomo-*` (it matches by prefix). `test.sh` in each package dir asserts the on-target file layout (e.g. `/usr/share/mihomo/ui/index.html`) — update it when changing installed paths.

8. **install.sh mirrors the release layout.** The installer at the repo root resolves the latest release via the GitHub API and matches asset URLs with `/mihomo-[0-9]*-<arch>.apk` (leading digit distinguishes the core from `mihomo-metacubexd-*`) and only accepts URLs containing `/releases/download/` so release-body text cannot leak into the extraction. If asset naming changes, update install.sh together with the CI skip-check. The script runs on-device under BusyBox ash — keep it POSIX sh (no bashisms, no jq), and keep the starter config it embeds in sync with `docs/INSTALL.md`.

9. **APK feed signing.** The `feed` job publishes `packages/<arch>/{*.apk,packages.adb}` plus `keys/mihomo-openwrt.pem` to GitHub Pages and signs each `packages.adb` with the EC (prime256v1) key whose public half is committed at `keys/mihomo-openwrt.pem`; the private half lives only in the `APK_SIGNING_KEY` secret. The job fails closed: it derives the public key from the secret and `diff`s it against the committed file before signing. Feed and deploy never run on `pull_request` events. The repo line format is the **full index URL** (`.../packages/<arch>/packages.adb`) — apk-tools 3 resolves the index strictly from that line, not from a directory plus a conventional file name; do not switch to a bare directory URL. The pinned `apk.static` (apk-tools 3.0.7) and its sha256 must be updated together.

## Verification

* No local build is possible on Windows (OpenWrt SDK is Linux-only) — rely on CI for build validation.
* Before pushing Makefile changes: confirm recipe lines start with tabs.
* CI on PRs to `main` runs the full pipeline; a fast green run usually means the skip-path fired (both APKs already in the release). To force a real build, delete the current release and dispatch the workflow.
* Check PR status with `gh pr checks`; failed-step logs with `gh run view <id> --log-failed`.

## Environment notes

* Development machine is Windows; the shell tool executes PowerShell syntax (pwsh), not bash. `rg` is not installed — use `Select-String`.
* `git push` from this machine is slow — allow timeouts of 300000+ ms.
* On forks, scheduled workflows are disabled by default and must be enabled from the Actions tab.
* GitHub CLI (`gh`) is authenticated for `sers88/mihomo-openwrt`.

## Conventions

* Conventional commits: `feat(package):`, `fix(ci):`, `ci(build):`, `docs:`.
* Branches: short-lived feature branches (`feat/...`, `docs/...`, `fix/...`) merged to `main` via PR.
* Never merge or push to `main` without explicit user instruction.
