# Installing mihomo + metacubexd on OpenWrt

Complete walk-through from a fresh OpenWrt 25.12+ router to a running mihomo with the metacubexd web dashboard. [Русская версия](INSTALL.ru.md).

The short version: install two APKs, create `/etc/mihomo/config.yaml`, enable the service, open the dashboard.

## Quick install (script)

A one-liner does everything below automatically — detects the architecture, downloads the latest release, installs both packages, creates a starter config with a random secret, enables and starts the service:

```sh
curl -sL https://raw.githubusercontent.com/sers88/mihomo-openwrt/main/install.sh | sh
```

| Option | Effect |
|---|---|
| `--feed` | install via the signed APK repository (see next section) instead of direct downloads |
| `--dnsmasq` | also forward the router's DNS through mihomo (step 5 below) |
| `--no-service` | install/update packages only, no config, no service changes |

The script is idempotent: re-running it updates to the latest release. Existing configs are never modified. If you prefer not to pipe scripts from the internet, [read it first](https://github.com/sers88/mihomo-openwrt/blob/main/install.sh) and follow the manual steps below instead.

## APK repository (signed feed)

Instead of downloading APKs by hand you can register the project feed once and use `apk` natively — packages are verified against a committed signing key (no `--allow-untrusted`) and updated with a regular `apk upgrade`:

```sh
wget -O /etc/apk/keys/mihomo-openwrt.pem https://sers88.github.io/mihomo-openwrt/keys/mihomo-openwrt.pem
echo "https://sers88.github.io/mihomo-openwrt/packages/$(. /etc/openwrt_release && echo $DISTRIB_ARCH)/packages.adb" > /etc/apk/repositories.d/mihomo-openwrt.list
apk update && apk add mihomo mihomo-metacubexd
```

`sh install.sh --feed` does the same and continues with config/service setup. Later updates: `apk update && apk upgrade mihomo mihomo-metacubexd`. Skip to step 3 (config) after installing this way.

## 0. Determine your architecture

SSH into the router and run:

```sh
. /etc/openwrt_release; echo "$DISTRIB_ARCH"
```

| Output | APK files to download |
|---|---|
| `aarch64_generic` | `mihomo-<version>-r1_aarch64_generic.apk` |
| `x86_64` | `mihomo-<version>-r1_x86_64.apk` |

For `mihomo-metacubexd-<version>-r1_<arch>.apk` the arch does not matter — the package is arch-independent (`all`); either file installs identically.

> [!NOTE]
> Other architectures (arm_cortex-a7, mipsel, ...) are not built by this project.

## 1. Download and transfer

Download the three files from the [releases page](https://github.com/sers88/mihomo-openwrt/releases) to your computer, then copy them to the router:

```sh
scp mihomo-*.apk mihomo-metacubexd-*.apk root@<router-ip>:/tmp/
```

## 2. Install

On the router:

```sh
cd /tmp
apk add mihomo-*-r1_*.apk --allow-untrusted
apk add mihomo-metacubexd-*-r1_*.apk --allow-untrusted
```

`--allow-untrusted` is required because the packages are signed with a CI key that is not in the router's default keychain.

The `mihomo` package automatically pulls in the kernel modules it needs (`kmod-tun`, `kmod-inet-diag`, `kmod-netlink-diag`). After installation you have:

| Path | What it is |
|---|---|
| `/usr/bin/mihomo` | the proxy core |
| `/etc/mihomo/example.yaml` | full annotated config example (from upstream) |
| `/etc/config/mihomo` | UCI service config |
| `/etc/init.d/mihomo` | procd init script |
| `/usr/share/mihomo/ui/` | metacubexd dashboard files |

Note there is **no** `/etc/mihomo/config.yaml` yet — the service won't start without it, and it is also **disabled by default**. Both are handled below.

## 3. Create the mihomo config

Create `/etc/mihomo/config.yaml`. Below is a working skeleton: TUN mode with `auto-redirect`, DNS hijacking, the external controller for the dashboard, and one placeholder proxy — **replace it with your own server or a subscription** (see the comments).

```yaml
# /etc/mihomo/config.yaml
external-controller: 0.0.0.0:9090
secret: "change-me"          # dashboard login secret — change it!
external-ui: ui              # resolves to <workdir>/ui = /usr/share/mihomo/ui

tun:
  enable: true
  stack: mixed
  dns-hijack:
    - any:53
  auto-route: true
  auto-redirect: true        # transparently redirect LAN TCP traffic
  auto-detect-interface: true

dns:
  enable: true
  enhanced-mode: fake-ip
  nameserver:
    - https://dns.cloudflare.com/dns-query
    - 1.1.1.1

proxies:
  # REPLACE with your own server(s) — see https://wiki.metacubex.one/en/config/proxies/
  # or use proxy-providers for a subscription:
  # https://wiki.metacubex.one/en/config/proxy-providers/
  - name: "my-proxy"
    type: ss
    server: 203.0.113.1
    port: 8388
    cipher: aes-256-gcm
    password: "secret"

proxy-groups:
  - name: PROXY
    type: select
    proxies:
      - my-proxy
      - DIRECT

rules:
  - GEOIP,LAN,DIRECT
  - GEOIP,CN,DIRECT
  - MATCH,PROXY
```

A complete annotated example is installed at `/etc/mihomo/example.yaml`; full documentation lives at <https://wiki.metacubex.one/en/config/>.

## 4. Enable and start the service

The UCI default is `enabled 0` — the init script does nothing until you flip it:

```sh
uci set mihomo.main.enabled='1'
uci commit mihomo
/etc/init.d/mihomo enable
/etc/init.d/mihomo start
```

Related UCI options in `/etc/config/mihomo` you may need to adjust:

| Option | Default | Notes |
|---|---|---|
| `conffile` | `/etc/mihomo/config.yaml` | path to the yaml config |
| `workdir` | `/usr/share/mihomo` | mihomo working dir; `external-ui: ui` resolves relative to it |
| `user` | `root` | **keep `root` for TUN mode** (needs /dev/net/tun and CAP_NET_ADMIN) |
| `ifaces` | `wan wan_6` | restart triggers; rename if your WAN interface is named differently (e.g. PPPoE) |

## 5. Optional: route router DNS through mihomo

For domain-based rules to work for all LAN clients, forward dnsmasq to mihomo's DNS listener:

```sh
uci -q delete dhcp.@dnsmasq[0].server
uci add_list dhcp.@dnsmasq[0].server='127.0.0.1#1053'
uci set dhcp.@dnsmasq[0].noresolv='1'
uci commit dhcp
/etc/init.d/dnsmasq restart
```

The `dns-hijack: any:53` in the TUN config already captures DNS queries from LAN clients sent to arbitrary servers; the dnsmasq forwarding above additionally covers queries issued by the router itself.

## 6. Verify

```sh
mihomo -v                          # binary version
logread -e mihomo                  # service log (stdout/stderr via logd)
```

Open `http://<router-ip>:9090/ui` in a browser and log in with the `secret` from the config. Check that traffic flows via the dashboard's *Connections* page, or:

```sh
curl -s http://127.0.0.1:9090/traffic -H "Authorization: Bearer change-me" | head -c 200
```

## 7. Update / uninstall

New release comes out (the project auto-rebuilds every 6 hours) — download the new APKs and install them over the old ones:

```sh
apk add mihomo-<new-version>-r1_<arch>.apk --allow-untrusted
```

If you installed via the APK repository (or `install.sh --feed`), updating is just:

```sh
apk update && apk upgrade mihomo mihomo-metacubexd
```

Your configs survive upgrades: `/etc/mihomo/config.yaml` and `/etc/config/mihomo` are registered as conffiles. The service restarts automatically only on interface triggers — restart it manually after an upgrade:

```sh
/etc/init.d/mihomo restart
```

Remove everything:

```sh
apk del mihomo-metacubexd mihomo
rm -rf /etc/mihomo /usr/share/mihomo   # optional: leftover configs/UI
```

## 8. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Service does not start, nothing in logs | `mihomo.main.enabled` is still `0` — step 4 |
| `logread -e mihomo` shows a config error | syntax/path problem in `/etc/mihomo/config.yaml`; test with `mihomo -t -f /etc/mihomo/config.yaml` |
| Starts, dies, starts again | respawn loop — check `logread` for the actual error (bad proxy config, unreadable file) |
| No internet after enabling TUN | WAN interface name differs from `wan`/`wan_6` — adjust `ifaces` in `/etc/config/mihomo`; also check the proxy itself works |
| Worked, broke after reboot | most likely the service started before WAN was up; the `ifaces` trigger restarts it once WAN appears — give it a few seconds, check `logread` |
| Dashboard returns 404 at `/ui` | metacubexd package not installed, or `external-ui` not set in the config |
| Dashboard unreachable at all | `external-controller` missing/`127.0.0.1` only, firewall blocking port 9090 from WAN (by default it's reachable from LAN only) |
| Domain rules don't match | router's own DNS bypasses mihomo — apply step 5 |
| `apk add` refuses the file | forgot `--allow-untrusted`, or wrong arch file |
