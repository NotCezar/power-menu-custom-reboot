#!/usr/bin/env bash
set -e

UUID="power-menu-custom-reboot@notcezar.github.io"
TARGET_DIR="${HOME}/.local/share/gnome-shell/extensions/${UUID}"

echo "Installing ${UUID}..."
mkdir -p "${TARGET_DIR}/schemas"

cp -f metadata.json extension.js prefs.js bootloader.js utils.js "${TARGET_DIR}/"
cp -f schemas/*.xml "${TARGET_DIR}/schemas/"

echo "Compiling schemas..."
glib-compile-schemas "${TARGET_DIR}/schemas"

echo "Enabling extension..."
gnome-extensions enable "${UUID}" 2>/dev/null || true

echo "Done! Please reload GNOME Shell (or log out & log in) to apply changes."
