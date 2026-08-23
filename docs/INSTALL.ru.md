# Установка mihomo + metacubexd на OpenWrt

Полное руководство: от «чистого» роутера с OpenWrt 25.12+ до работающего mihomo с веб-панелью metacubexd. [English version](INSTALL.md).

Если коротко: поставить два APK, создать `/etc/mihomo/config.yaml`, включить сервис, открыть панель.

## Быстрая установка (скрипт)

Однострочник делает всё описанное ниже автоматически — определяет архитектуру, скачивает последний релиз, ставит оба пакета, создаёт стартовый конфиг со случайным secret, включает и запускает сервис:

```sh
curl -sL https://raw.githubusercontent.com/sers88/mihomo-openwrt/main/install.sh | sh
```

| Опция | Действие |
|---|---|
| `--feed` | ставить из подписанного APK-репозитория (следующая секция) вместо прямого скачивания |
| `--dnsmasq` | дополнительно направить DNS роутера через mihomo (шаг 5 ниже) |
| `--no-service` | только установить/обновить пакеты, без конфига и сервиса |

Скрипт идемпотентный: повторный запуск = обновление до последнего релиза. Существующие конфиги не изменяются. Не хотите исполнять скрипт из интернета — [прочитайте его](https://github.com/sers88/mihomo-openwrt/blob/main/install.sh) и пройдите ручные шаги ниже.

## APK-репозиторий (подписанный фид)

Вместо ручного скачивания APK можно один раз подключить фид проекта и пользоваться `apk` как обычно: пакеты проверяются по ключу подписи, закоммиченному в репозитории (без `--allow-untrusted`), а обновления ставятся обычным `apk upgrade`:

```sh
wget -O /etc/apk/keys/mihomo-openwrt.pem https://sers88.github.io/mihomo-openwrt/keys/mihomo-openwrt.pem
echo "https://sers88.github.io/mihomo-openwrt/packages/$(. /etc/openwrt_release && echo $DISTRIB_ARCH)/packages.adb" > /etc/apk/repositories.d/mihomo-openwrt.list
apk update && apk add mihomo mihomo-metacubexd
```

`sh install.sh --feed` делает то же самое и продолжает настройку конфига/сервиса. Дальнейшие обновления: `apk update && apk upgrade mihomo mihomo-metacubexd`. После такой установки переходите сразу к шагу 3 (конфиг).

## 0. Определите архитектуру

Зайдите на роутер по SSH и выполните:

```sh
. /etc/openwrt_release; echo "$DISTRIB_ARCH"
```

| Вывод | Какие APK скачивать |
|---|---|
| `aarch64_generic` | `mihomo-<version>-r1_aarch64_generic.apk` |
| `x86_64` | `mihomo-<version>-r1_x86_64.apk` |

Для `mihomo-metacubexd-<version>-r1_<arch>.apk` архитектура не важна — пакет арх-независимый (`all`), оба файла идентичны.

> [!NOTE]
> Прочие архитектуры (arm_cortex-a7, mipsel, ...) этим проектом не собираются.

## 1. Скачайте и перенесите файлы

Скачайте три файла со [страницы релизов](https://github.com/sers88/mihomo-openwrt/releases) на компьютер и скопируйте на роутер:

```sh
scp mihomo-*.apk mihomo-metacubexd-*.apk root@<ip-роутера>:/tmp/
```

## 2. Установка

На роутере:

```sh
cd /tmp
apk add mihomo-*-r1_*.apk --allow-untrusted
apk add mihomo-metacubexd-*-r1_*.apk --allow-untrusted
```

`--allow-untrusted` обязателен: пакеты подписаны CI-ключом, которого нет в стандартном keychain роутера.

Пакет `mihomo` автоматически подтянет нужные модули ядра (`kmod-tun`, `kmod-inet-diag`, `kmod-netlink-diag`). После установки вы имеете:

| Путь | Что это |
|---|---|
| `/usr/bin/mihomo` | прокси-ядро |
| `/etc/mihomo/example.yaml` | полный прокомментированный пример конфига (из апстрима) |
| `/etc/config/mihomo` | UCI-конфиг сервиса |
| `/etc/init.d/mihomo` | procd init-скрипт |
| `/usr/share/mihomo/ui/` | файлы дашборда metacubexd |

Обратите внимание: файла `/etc/mihomo/config.yaml` **ещё нет** — без него сервис не стартует, и к тому же он **по умолчанию выключен**. Оба момента закрываем ниже.

## 3. Создайте конфиг mihomo

Создайте `/etc/mihomo/config.yaml`. Ниже — рабочий каркас: TUN-режим с `auto-redirect`, перехват DNS, external controller для дашборда и один proxy-заглушка — **замените его своим сервером или подпиской** (см. комментарии).

```yaml
# /etc/mihomo/config.yaml
external-controller: 0.0.0.0:9090
secret: "change-me"          # секрет для входа в панель — смените!
external-ui: ui              # резолвится в <workdir>/ui = /usr/share/mihomo/ui

tun:
  enable: true
  stack: mixed
  dns-hijack:
    - any:53
  auto-route: true
  auto-redirect: true        # прозрачно перехватывает TCP-трафик LAN
  auto-detect-interface: true

dns:
  enable: true
  enhanced-mode: fake-ip
  nameserver:
    - https://dns.cloudflare.com/dns-query
    - 1.1.1.1

proxies:
  # ЗАМЕНИТЕ на свой сервер(ы) — https://wiki.metacubex.one/en/config/proxies/
  # или используйте proxy-providers для подписки:
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

Полный прокомментированный пример устанавливается в `/etc/mihomo/example.yaml`; полная документация — <https://wiki.metacubex.one/en/config/>.

## 4. Включите и запустите сервис

По умолчанию в UCI стоит `enabled 0` — init-скрипт ничего не делает, пока флаг не переключён:

```sh
uci set mihomo.main.enabled='1'
uci commit mihomo
/etc/init.d/mihomo enable
/etc/init.d/mihomo start
```

Опции UCI в `/etc/config/mihomo`, которые может понадобиться поправить:

| Опция | По умолчанию | Примечание |
|---|---|---|
| `conffile` | `/etc/mihomo/config.yaml` | путь к yaml-конфигу |
| `workdir` | `/usr/share/mihomo` | рабочий каталог mihomo; `external-ui: ui` резолвится относительно него |
| `user` | `root` | **для TUN-режима оставьте `root`** (нужны /dev/net/tun и CAP_NET_ADMIN) |
| `ifaces` | `wan wan_6` | триггеры рестарта; переименуйте, если ваш WAN называется иначе (напр. PPPoE) |

## 5. Опционально: DNS роутера через mihomo

Чтобы доменные правила работали для всех клиентов LAN, направьте dnsmasq на DNS-листенер mihomo:

```sh
uci -q delete dhcp.@dnsmasq[0].server
uci add_list dhcp.@dnsmasq[0].server='127.0.0.1#1053'
uci set dhcp.@dnsmasq[0].noresolv='1'
uci commit dhcp
/etc/init.d/dnsmasq restart
```

`dns-hijack: any:53` в TUN-конфиге уже перехватывает DNS-запросы клиентов LAN на любые серверы; форвардинг dnsmasq выше дополнительно закрывает запросы самого роутера.

## 6. Проверка

```sh
mihomo -v                          # версия бинарника
logread -e mihomo                  # лог сервиса (stdout/stderr через logd)
```

Откройте `http://<ip-роутера>:9090/ui` в браузере и войдите с `secret` из конфига. Проверить, что трафик идёт, можно на странице *Connections* панели, либо:

```sh
curl -s http://127.0.0.1:9090/traffic -H "Authorization: Bearer change-me" | head -c 200
```

## 7. Обновление / удаление

Вышел новый релиз (проект пересобирается каждые 6 часов) — скачайте новые APK и поставьте поверх старых:

```sh
apk add mihomo-<новая-версия>-r1_<arch>.apk --allow-untrusted
```

Если вы ставили из APK-репозитория (или `install.sh --feed`), обновление — это просто:

```sh
apk update && apk upgrade mihomo mihomo-metacubexd
```

Конфиги переживают обновление: `/etc/mihomo/config.yaml` и `/etc/config/mihomo` зарегистрированы как conffiles. После обновления сервис сам не перезапустится (только по интерфейсным триггерам) — перезапустите вручную:

```sh
/etc/init.d/mihomo restart
```

Полное удаление:

```sh
apk del mihomo-metacubexd mihomo
rm -rf /etc/mihomo /usr/share/mihomo   # опционально: остатки конфигов/UI
```

## 8. Диагностика

| Симптом | Причина / решение |
|---|---|
| Сервис не стартует, в логах пусто | `mihomo.main.enabled` всё ещё `0` — шаг 4 |
| `logread -e mihomo` показывает ошибку конфига | синтаксис/пути в `/etc/mihomo/config.yaml`; проверьте: `mihomo -t -f /etc/mihomo/config.yaml` |
| Стартует, умирает, снова стартует | respawn-цикл — смотрите `logread` на настоящую ошибку (кривой proxy, нечитаемый файл) |
| Нет интернета после включения TUN | имя WAN-интерфейса отличается от `wan`/`wan_6` — поправьте `ifaces` в `/etc/config/mihomo`; заодно проверьте сам прокси |
| Работало, отвалилось после ребута | вероятнее всего сервис стартовал до поднятия WAN; триггер `ifaces` перезапустит его, когда WAN появится — подождите пару секунд, смотрите `logread` |
| Дашборд отдаёт 404 на `/ui` | не установлен пакет metacubexd или в конфиге нет `external-ui` |
| Дашборд вообще недоступен | нет `external-controller` / слушает только `127.0.0.1`, файрвол блокирует порт 9090 (по умолчанию доступ только из LAN) |
| Доменные правила не срабатывают | DNS самого роутера минует mihomo — примените шаг 5 |
| `apk add` отвергает файл | забыли `--allow-untrusted`, либо файл не той архитектуры |
