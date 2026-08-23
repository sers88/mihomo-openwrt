# Mihomo for OpenWrt

Native [mihomo](https://github.com/MetaCubeX/mihomo) (formerly Clash Meta) builds packaged as APKs for OpenWrt — no shell-script wrappers, no ipk. Ships with the [metacubexd](https://github.com/MetaCubeX/metacubexd) web dashboard as a separate package. Both are rebuilt automatically whenever upstream publishes a new release.

## Packages

| Package | Description | Size (approx.) |
|---|---|---|
| `mihomo` | The proxy core (Go binary, TUN support) | ~17 MB |
| `mihomo-metacubexd` | Web dashboard, installed to `/usr/share/mihomo/ui`, arch-independent (`all`) | ~2.5 MB |

Builds are published for two architectures:

* `aarch64_generic` (ARM64 routers)
* `x86_64`

## Prerequisites

* OpenWrt **25.12.2 or newer** — packages use the `apk` package manager only (no `ipk` support)
* Basic familiarity with the OpenWrt terminal
* Basic knowledge of [mihomo configuration](https://wiki.metacubex.one/en/config/)

## Download & Install

Quick install (downloads the latest release, installs both packages, creates a starter config with a random secret, enables and starts the service):

```sh
curl -sL https://raw.githubusercontent.com/sers88/mihomo-openwrt/main/install.sh | sh
```

Options: `--dnsmasq` additionally forwards the router's DNS through mihomo, `--no-service` installs packages only. Re-running the script updates to the latest release; existing configs are never touched. Prefer reviewing before piping? [Read the script](install.sh) and run it from a checkout.

Manual installation:

Grab the latest APKs from the [releases page](https://github.com/sers88/mihomo-openwrt/releases). Release names track the mihomo version (e.g. `v1.19.30`); don't worry about the release date — it always contains the latest upstream versions.

Upload the APKs to your router and install:

```sh
apk add mihomo-<version>-r1_<arch>.apk --allow-untrusted
apk add mihomo-metacubexd-<version>-r1_<arch>.apk --allow-untrusted
```

For a complete walk-through (architecture detection, config skeleton, enabling the service, DNS setup, troubleshooting), see the [installation guide](docs/INSTALL.md) ([русская версия](docs/INSTALL.ru.md)).

> [!TIP]
> Replace `<version>` and `<arch>` with the actual file names you downloaded (e.g. `mihomo-1.19.30-r1_aarch64_generic.apk`). The `mihomo` package pulls in the required kernel modules (`kmod-tun`, `kmod-inet-diag`, `kmod-netlink-diag`) automatically; the metacubexd package depends on `mihomo` and is arch-independent — either arch file works on any router.

## Web Dashboard (metacubexd)

After installing `mihomo-metacubexd`, enable the external controller in `/etc/mihomo/config.yaml`:

```yaml
external-controller: 0.0.0.0:9090
secret: "change-me"
external-ui: ui
```

Restart mihomo (`/etc/init.d/mihomo restart`) and open `http://<router-ip>:9090/ui` in your browser. Log in with the `secret` from the config above.

## Configuration

The recommended setup uses the `auto-redirect` feature:

```yaml
tun:
  enable: true
  stack: mixed
  dns-hijack:
    - "any:53"
  auto-route: true
  auto-redirect: true # Key configuration
  auto-detect-interface: true
```

The service is managed via UCI (`/etc/config/mihomo`) with the mihomo config at `/etc/mihomo/config.yaml`; an example config is installed to `/etc/mihomo/example.yaml`.

For background on how the packaging works, see [this gist](https://gist.github.com/douglarek/99fb8d7f30fac2a6d2e9a32a47296e30).

## Releases & CI

[![CI](https://github.com/sers88/mihomo-openwrt/actions/workflows/build.yml/badge.svg)](https://github.com/sers88/mihomo-openwrt/actions/workflows/build.yml)

The [build workflow](.github/workflows/build.yml) runs on a 6-hour schedule, on PRs to `main`, and on manual dispatch:

* Resolves the **latest** mihomo and metacubexd releases from upstream and builds against those versions
* Verifies the metacubexd tarball against the sha256 digest published upstream (no unpinned downloads)
* Skips work if the current release already contains both APKs for the matrix arch
* Publishes both APKs per arch to a release tagged after the mihomo version; the 2 latest releases are kept, older ones are deleted

> [!NOTE]
> On forks, GitHub disables scheduled workflows by default — enable them from the *Actions* tab after forking.

## Local build

To build outside CI, use the official OpenWrt 25.12.2 SDK for your target (`rockchip/armv8` for `aarch64_generic`, `x86/64` for `x86_64`):

```sh
# inside an extracted SDK
cp -a net package/
# substitute real versions before building
sed -i 's/PKG_VERSION:=stable/PKG_VERSION:=<mihomo version>/' package/net/mihomo/Makefile
sed -i -e 's/PKG_VERSION:=stable/PKG_VERSION:=<metacubexd version>/' \
       -e 's/PKG_HASH:=skip/PKG_HASH:=<sha256 of compressed-dist.tgz>/' package/net/mihomo-metacubexd/Makefile
make package/net/mihomo/{download,compile} V=s
make package/net/mihomo-metacubexd/{download,compile} V=s
```

## Credits

* [douglarek/mihomo-openwrt](https://github.com/douglarek/mihomo-openwrt) — the original packaging this repo builds upon
* [MetaCubeX/mihomo](https://github.com/MetaCubeX/mihomo) — the proxy core
* [MetaCubeX/metacubexd](https://github.com/MetaCubeX/metacubexd) — the web dashboard
