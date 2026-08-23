# SPDX-License-Identifier: GPL-2.0-only
#
# Copyright (C) 2026 sers88

include $(TOPDIR)/rules.mk

PKG_NAME:=mihomo-metacubexd
PKG_VERSION:=stable
PKG_RELEASE:=1

PKG_SOURCE:=compressed-dist.tgz
PKG_SOURCE_URL:=https://github.com/MetaCubeX/metacubexd/releases/download/v$(PKG_VERSION)
PKG_HASH:=skip

PKG_LICENSE:=MIT
PKG_MAINTAINER:=sers88 <sers88@users.noreply.github.com>

PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)

include $(INCLUDE_DIR)/package.mk

define Package/mihomo-metacubexd
  SECTION:=net
  CATEGORY:=Network
  SUBMENU:=Web Servers/Proxies
  TITLE:=MetaCubeXD dashboard for Mihomo
  URL:=https://github.com/MetaCubeX/metacubexd
  DEPENDS:=+mihomo
  PKGARCH:=all
endef

define Package/mihomo-metacubexd/description
  MetaCubeXD is a web dashboard for the mihomo proxy core. It is served
  by mihomo's external-controller on the external-ui path and allows
  managing proxies, rules, connections and DNS via the REST API.
endef

define Build/Prepare
	mkdir -p $(PKG_BUILD_DIR)/dist
	$(TAR) -C $(PKG_BUILD_DIR)/dist -xzf $(DL_DIR)/$(PKG_SOURCE)
endef

define Build/Compile
endef

define Package/mihomo-metacubexd/install
	$(INSTALL_DIR) $(1)/usr/share/mihomo/ui
	$(CP) $(PKG_BUILD_DIR)/dist/. $(1)/usr/share/mihomo/ui/
endef

$(eval $(call BuildPackage,mihomo-metacubexd))
