import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import { getDefault as getDefaultSystemActions } from 'resource:///org/gnome/shell/misc/systemActions.js';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';

import { BootloaderManager } from './bootloader.js';
import { createGIcon, getOSIcon, logError } from './utils.js';

export default class PowerMenuCustomReboot extends Extension {
    enable() {
        this._insertedItems = [];
        this._retryTimeoutId = 0;
        this._systemMenu = null;

        this._settings = this.getSettings('org.gnome.shell.extensions.power-menu-custom-reboot');
        this._settings.connectObject('changed', () => {
            this._updateMenu();
        }, this);

        this._tryAttachMenu();
    }

    disable() {
        if (this._retryTimeoutId) {
            GLib.Source.remove(this._retryTimeoutId);
            this._retryTimeoutId = 0;
        }

        if (this._settings) {
            this._settings.disconnectObject(this);
            this._settings = null;
        }

        if (this._systemMenu) {
            this._systemMenu.disconnectObject(this);
            this._systemMenu = null;
        }

        this._clearInsertedItems();
    }

    _tryAttachMenu() {
        const quickSettings = Main.panel.statusArea.quickSettings;
        const systemIndicator = quickSettings?._system;
        const systemItem = systemIndicator?._systemItem;
        const menu = systemItem?.menu;

        if (!menu) {
            this._retryTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
                this._retryTimeoutId = 0;
                this._tryAttachMenu();
                return GLib.SOURCE_REMOVE;
            });
            return;
        }

        this._systemMenu = menu;

        menu.connectObject('open-state-changed', (m, open) => {
            if (open) {
                this._updateMenu();
            }
        }, this);

        this._updateMenu();
    }

    async _updateMenu() {
        if (!this._systemMenu || !this._settings) return;

        this._clearInsertedItems();

        let entries = [];
        try {
            entries = await BootloaderManager.getBootEntries(this._settings);
        } catch (err) {
            logError('Failed to load boot entries', err);
            return;
        }

        // Post-await guard: check if extension was disabled while fetching entries
        if (!this._settings || !this._systemMenu) {
            return;
        }

        if (entries.length === 0) {
            return;
        }

        // Filter out hidden entries
        try {
            const hiddenJson = this._settings.get_string('hidden-entries');
            const hiddenList = JSON.parse(hiddenJson || '[]');
            entries = entries.filter(e => !hiddenList.includes(e.id) && !hiddenList.includes(e.title));
        } catch (e) {
            logError('Failed to parse hidden-entries', e);
        }

        const mode = this._settings.get_string('display-mode');

        if (mode === 'inline') {
            this._createInlineItems(entries);
        } else {
            this._createSubmenuItem(entries);
        }
    }

    _getTitleOverrides() {
        if (!this._settings) return {};
        try {
            const json = this._settings.get_string('title-overrides');
            return JSON.parse(json || '{}');
        } catch (e) {
            return {};
        }
    }

    _getIconOverrides() {
        if (!this._settings) return {};
        try {
            const json = this._settings.get_string('icon-overrides');
            return JSON.parse(json || '{}');
        } catch (e) {
            return {};
        }
    }

    _createSubmenuItem(entries) {
        const submenuItem = new PopupMenu.PopupSubMenuMenuItem(
            'Reboot Into…',
            true
        );
        submenuItem.icon.gicon = Gio.Icon.new_for_string('system-reboot-symbolic');

        const titleOverrides = this._getTitleOverrides();
        const iconOverrides = this._getIconOverrides();

        for (const entry of entries) {
            const displayTitle = titleOverrides[entry.id] || titleOverrides[entry.title] || entry.title;
            const overrideIcon = iconOverrides[entry.id] || iconOverrides[entry.title];
            const iconVal = overrideIcon || getOSIcon(entry.title);
            const gicon = createGIcon(iconVal);
            const item = new PopupMenu.PopupMenuItem(displayTitle);

            const icon = new St.Icon({
                gicon: gicon,
                fallback_icon_name: 'drive-harddisk-symbolic',
                style_class: 'popup-menu-icon',
            });
            item.insert_child_at_index(icon, 1);

            item.connect('activate', () => {
                this._onRebootTargetSelected(entry);
            });
            submenuItem.menu.addMenuItem(item);
        }

        // Separator & Preferences
        submenuItem.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        const prefsItem = new PopupMenu.PopupMenuItem('Reboot Settings…');
        const prefsIcon = new St.Icon({
            icon_name: 'emblem-system-symbolic',
            fallback_icon_name: 'preferences-system-symbolic',
            style_class: 'popup-menu-icon',
        });
        prefsItem.insert_child_at_index(prefsIcon, 1);
        prefsItem.connect('activate', () => {
            this.openPreferences();
        });
        submenuItem.menu.addMenuItem(prefsItem);

        this._insertIntoSystemMenu(submenuItem);
        this._insertedItems.push(submenuItem);
    }

    _createInlineItems(entries) {
        const titleOverrides = this._getTitleOverrides();
        const iconOverrides = this._getIconOverrides();

        for (const entry of entries) {
            const displayTitle = titleOverrides[entry.id] || titleOverrides[entry.title] || entry.title;
            const item = new PopupMenu.PopupMenuItem(`Reboot: ${displayTitle}`);
            const overrideIcon = iconOverrides[entry.id] || iconOverrides[entry.title];
            const iconVal = overrideIcon || getOSIcon(entry.title);
            const gicon = createGIcon(iconVal);

            const icon = new St.Icon({
                gicon: gicon,
                fallback_icon_name: 'drive-harddisk-symbolic',
                style_class: 'popup-menu-icon',
            });
            item.insert_child_at_index(icon, 1);

            item.connect('activate', () => {
                this._onRebootTargetSelected(entry);
            });

            this._insertIntoSystemMenu(item);
            this._insertedItems.push(item);
        }
    }

    _insertIntoSystemMenu(item) {
        if (!this._systemMenu) return;

        const items = this._systemMenu._getMenuItems();
        let targetIndex = -1;

        for (let i = 0; i < items.length; i++) {
            const label = items[i].label?.text || items[i]._label?.text || '';
            if (label.includes('Restart') || label.includes('Reboot') || label.includes('Reiniciar')) {
                targetIndex = i + 1;
                break;
            }
        }

        if (targetIndex >= 0) {
            this._systemMenu.addMenuItem(item, targetIndex);
        } else {
            let sepIndex = items.findIndex(it => it instanceof PopupMenu.PopupSeparatorMenuItem);
            if (sepIndex >= 0) {
                this._systemMenu.addMenuItem(item, sepIndex);
            } else {
                this._systemMenu.addMenuItem(item);
            }
        }
    }

    async _onRebootTargetSelected(entry) {
        Main.panel.closeQuickSettings();

        const success = await BootloaderManager.setBootTarget(entry);

        if (success) {
            try {
                getDefaultSystemActions().activateRestart();
            } catch (e) {
                logError('Failed to trigger activateRestart', e);
            }
        } else {
            Main.notify('Custom Reboot Failed', `Could not set boot target to "${entry.title}". Check root/polkit permissions.`);
        }
    }

    _clearInsertedItems() {
        for (const item of this._insertedItems) {
            try {
                item.destroy();
            } catch (e) {
                // ignore
            }
        }
        this._insertedItems = [];
    }
}
