# SPDX-License-Identifier: Apache-2.0
#
# Copyright (C) 2026 sers88

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-mihomo
PKG_VERSION:=stable
PKG_RELEASE:=1

PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=sers88 <sers88@users.noreply.github.com>

PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)

include $(INCLUDE_DIR)/package.mk

define Package/luci-app-mihomo
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=3. Applications
  TITLE:=LuCI support for Mihomo
  URL:=https://github.com/sers88/mihomo-openwrt
  DEPENDS:=+luci-base +mihomo
  PKGARCH:=all
endef

define Package/luci-app-mihomo/description
  Minimal LuCI application for the mihomo proxy core: service status and
  control (start/stop/restart, autostart), a quick link to the metacubexd
  dashboard, and a log viewer. Heavy configuration is done via the
  metacubexd dashboard or /etc/mihomo/config.yaml directly.
endef

define Build/Prepare
	mkdir -p $(PKG_BUILD_DIR)
endef

define Build/Compile
endef

define Package/luci-app-mihomo/install
	$(INSTALL_DIR) $(1)/usr/share/luci/menu.d
	$(INSTALL_DATA) $(CURDIR)/files/usr/share/luci/menu.d/luci-app-mihomo.json $(1)/usr/share/luci/menu.d/
	$(INSTALL_DIR) $(1)/usr/share/luci/acl.d
	$(INSTALL_DATA) $(CURDIR)/files/usr/share/luci/acl.d/luci-app-mihomo.json $(1)/usr/share/luci/acl.d/
	$(INSTALL_DIR) $(1)/www/luci-static/resources/view
	$(INSTALL_DATA) $(CURDIR)/files/www/luci-static/resources/view/mihomo.js $(1)/www/luci-static/resources/view/
endef

$(eval $(call BuildPackage,luci-app-mihomo))
