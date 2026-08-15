import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import { BootloaderManager } from './bootloader.js';
import { getOSIcon, logError } from './utils.js';

export default class PowerMenuCustomRebootPreferences extends ExtensionPreferences {
    async fillPreferencesWindow(window) {
        const settings = this.getSettings('org.gnome.shell.extensions.power-menu-custom-reboot');

        const page = new Adw.PreferencesPage({
            title: 'Power Menu Reboot',
            icon_name: 'system-reboot-symbolic',
        });
        window.add(page);

        // General Group
        const generalGroup = new Adw.PreferencesGroup({
            title: 'General Options',
            description: 'Configure how reboot targets appear in your GNOME Power Menu.',
        });
        page.add(generalGroup);

        // Backend Selection
        const backendRow = new Adw.ComboRow({
            title: 'Bootloader Backend',
            subtitle: 'Method used to discover and set next boot target',
            model: Gtk.StringList.new([
                'Auto-detect Best',
                'GRUB / GRUB2',
                'EFI Boot Manager (efibootmgr)',
                'systemd-boot'
            ]),
        });

        const backends = ['auto', 'grub', 'efibootmgr', 'systemd-boot'];
        const currentBackend = settings.get_string('bootloader-backend');
        const selectedIndex = backends.indexOf(currentBackend);
        if (selectedIndex >= 0) {
            backendRow.set_selected(selectedIndex);
        }

        backendRow.connect('notify::selected', () => {
            const idx = backendRow.get_selected();
            if (idx >= 0 && idx < backends.length) {
                settings.set_string('bootloader-backend', backends[idx]);
                BootloaderManager.invalidateCache();
                this._refreshDetectedEntriesGroup(window, entriesGroup, settings);
            }
        });
        generalGroup.add(backendRow);

        // Display Mode Selection
        const modeRow = new Adw.ComboRow({
            title: 'Power Menu Layout',
            subtitle: 'How OS targets are presented in the Quick Settings Power Menu',
            model: Gtk.StringList.new([
                'Submenu ("Reboot Into…")',
                'Inline Action Items'
            ]),
        });

        const modes = ['submenu', 'inline'];
        const currentMode = settings.get_string('display-mode');
        const modeIdx = modes.indexOf(currentMode);
        if (modeIdx >= 0) {
            modeRow.set_selected(modeIdx);
        }

        modeRow.connect('notify::selected', () => {
            const idx = modeRow.get_selected();
            if (idx >= 0 && idx < modes.length) {
                settings.set_string('display-mode', modes[idx]);
            }
        });
        generalGroup.add(modeRow);

        // Confirm Reboot Switch
        const confirmRow = new Adw.SwitchRow({
            title: 'Confirm Reboot',
            subtitle: 'Prompt confirmation dialog before triggering system restart',
        });
        confirmRow.set_active(settings.get_boolean('confirm-reboot'));
        confirmRow.connect('notify::active', () => {
            settings.set_boolean('confirm-reboot', confirmRow.get_active());
        });
        generalGroup.add(confirmRow);

        // OS Entries & Customization Group
        const entriesGroup = new Adw.PreferencesGroup({
            title: 'Detected OS Entries & Customization',
            description: 'Rename options, choose custom icon files (.svg, .png), or toggle entries on/off.',
        });
        page.add(entriesGroup);

        await this._refreshDetectedEntriesGroup(window, entriesGroup, settings);
    }

    async _refreshDetectedEntriesGroup(window, entriesGroup, settings) {
        let child = entriesGroup.get_first_child();
        while (child) {
            const next = child.get_next_sibling();
            entriesGroup.remove(child);
            child = next;
        }

        let rawEntries = [];
        try {
            rawEntries = await BootloaderManager.getBootEntries(settings);
        } catch (e) {
            logError('Failed to get entries for prefs', e);
        }

        if (rawEntries.length === 0) {
            const emptyRow = new Adw.ActionRow({
                title: 'No other OS entries detected',
                subtitle: 'Ensure your bootloader (GRUB / efibootmgr) has other OS targets configured',
            });
            entriesGroup.add(emptyRow);
            return;
        }

        let titleOverrides = {};
        try {
            titleOverrides = JSON.parse(settings.get_string('title-overrides') || '{}');
        } catch (e) {}

        let iconOverrides = {};
        try {
            iconOverrides = JSON.parse(settings.get_string('icon-overrides') || '{}');
        } catch (e) {}

        let hiddenList = [];
        try {
            hiddenList = JSON.parse(settings.get_string('hidden-entries') || '[]');
        } catch (e) {}

        for (const entry of rawEntries) {
            const isHidden = hiddenList.includes(entry.id) || hiddenList.includes(entry.title);
            const customTitle = titleOverrides[entry.id] || titleOverrides[entry.title] || '';
            const customIconPath = iconOverrides[entry.id] || iconOverrides[entry.title] || '';
            const currentDisplayTitle = customTitle || entry.title;

            const expanderRow = new Adw.ExpanderRow({
                title: currentDisplayTitle,
                subtitle: isHidden ? 'Disabled (Hidden from Power Menu)' : `ID: ${entry.id} (${entry.backend})`,
                expanded: false,
            });

            // Icon preview
            const previewIcon = new Gtk.Image({
                valign: Gtk.Align.CENTER,
                pixel_size: 24,
            });
            this._updateImagePreview(previewIcon, customIconPath, entry.title);
            expanderRow.add_prefix(previewIcon);

            // Enable / Disable switch in suffix
            const toggleSwitch = new Gtk.Switch({
                valign: Gtk.Align.CENTER,
                active: !isHidden,
            });
            toggleSwitch.connect('notify::active', () => {
                const active = toggleSwitch.get_active();
                let currentHidden = [];
                try {
                    currentHidden = JSON.parse(settings.get_string('hidden-entries') || '[]');
                } catch (e) {}

                if (active) {
                    currentHidden = currentHidden.filter(id => id !== entry.id && id !== entry.title);
                } else {
                    if (!currentHidden.includes(entry.id)) currentHidden.push(entry.id);
                    if (!currentHidden.includes(entry.title)) currentHidden.push(entry.title);
                }
                settings.set_string('hidden-entries', JSON.stringify(currentHidden));
                BootloaderManager.invalidateCache();

                expanderRow.set_subtitle(active ? `ID: ${entry.id} (${entry.backend})` : 'Disabled (Hidden from Power Menu)');
            });
            expanderRow.add_suffix(toggleSwitch);

            // Subrow 1: Rename Entry Row
            const renameRow = new Adw.EntryRow({
                title: 'Display Name',
                text: customTitle,
            });
            if (!customTitle) {
                renameRow.set_text('');
            }
            renameRow.connect('notify::text', () => {
                const newText = renameRow.get_text().trim();
                if (newText && newText !== entry.title) {
                    titleOverrides[entry.id] = newText;
                    titleOverrides[entry.title] = newText;
                    expanderRow.set_title(newText);
                } else {
                    delete titleOverrides[entry.id];
                    delete titleOverrides[entry.title];
                    expanderRow.set_title(entry.title);
                }
                settings.set_string('title-overrides', JSON.stringify(titleOverrides));
                BootloaderManager.invalidateCache();
            });
            expanderRow.add_row(renameRow);

            // Subrow 2: Custom Icon Row
            const iconRow = new Adw.ActionRow({
                title: 'Custom Icon File',
                subtitle: customIconPath ? customIconPath : 'Using default system icon',
            });

            const browseBtn = new Gtk.Button({
                label: 'Choose Icon File…',
                valign: Gtk.Align.CENTER,
            });
            browseBtn.connect('clicked', () => {
                this._chooseIconFile(window, entry, iconRow, previewIcon, settings, iconOverrides);
            });
            iconRow.add_suffix(browseBtn);

            const resetIconBtn = new Gtk.Button({
                label: 'Reset Icon',
                valign: Gtk.Align.CENTER,
                sensitive: Boolean(customIconPath),
            });
            resetIconBtn.connect('clicked', () => {
                delete iconOverrides[entry.id];
                delete iconOverrides[entry.title];
                settings.set_string('icon-overrides', JSON.stringify(iconOverrides));
                BootloaderManager.invalidateCache();
                iconRow.set_subtitle('Using default system icon');
                this._updateImagePreview(previewIcon, '', entry.title);
                resetIconBtn.set_sensitive(false);
            });
            iconRow.add_suffix(resetIconBtn);

            expanderRow.add_row(iconRow);
            entriesGroup.add(expanderRow);
        }
    }

    _updateImagePreview(gtkImage, customPath, title) {
        try {
            if (customPath && (customPath.startsWith('/') || customPath.startsWith('file://'))) {
                const clean = customPath.replace('file://', '');
                const file = Gio.File.new_for_path(clean);
                if (file.query_exists(null)) {
                    gtkImage.set_from_gicon(new Gio.FileIcon({ file }));
                    return;
                }
            }
            const fallbackIcon = getOSIcon(title);
            gtkImage.set_from_icon_name(fallbackIcon);
        } catch (e) {
            gtkImage.set_from_icon_name('drive-harddisk-symbolic');
        }
    }

    _chooseIconFile(window, entry, iconRow, previewImage, settings, overrides) {
        if (Gtk.FileDialog) {
            const dialog = new Gtk.FileDialog({
                title: `Select Custom Icon for ${entry.title}`,
            });
            const filter = new Gtk.FileFilter();
            filter.set_name('Image Files (*.svg, *.png, *.ico, *.jpg)');
            filter.add_mime_type('image/svg+xml');
            filter.add_mime_type('image/png');
            filter.add_mime_type('image/x-icon');
            filter.add_pattern('*.svg');
            filter.add_pattern('*.png');
            filter.add_pattern('*.ico');
            filter.add_pattern('*.jpg');
            const filters = Gio.ListStore.new(Gtk.FileFilter);
            filters.append(filter);
            dialog.set_filters(filters);

            dialog.open(window, null, (dlg, res) => {
                try {
                    const file = dlg.open_finish(res);
                    if (file) {
                        const path = file.get_path();
                        overrides[entry.id] = path;
                        overrides[entry.title] = path;
                        settings.set_string('icon-overrides', JSON.stringify(overrides));
                        BootloaderManager.invalidateCache();
                        iconRow.set_subtitle(path);
                        this._updateImagePreview(previewImage, path, entry.title);
                    }
                } catch (e) {
                    // dismissed
                }
            });
        } else {
            const dialog = new Gtk.FileChooserNative({
                title: `Select Custom Icon for ${entry.title}`,
                transient_for: window,
                action: Gtk.FileChooserAction.OPEN,
                accept_label: 'Select',
                cancel_label: 'Cancel',
            });
            dialog.connect('response', (dlg, responseId) => {
                if (responseId === Gtk.ResponseType.ACCEPT) {
                    const file = dialog.get_file();
                    if (file) {
                        const path = file.get_path();
                        overrides[entry.id] = path;
                        overrides[entry.title] = path;
                        settings.set_string('icon-overrides', JSON.stringify(overrides));
                        BootloaderManager.invalidateCache();
                        iconRow.set_subtitle(path);
                        this._updateImagePreview(previewImage, path, entry.title);
                    }
                }
                dialog.destroy();
            });
            dialog.show();
        }
    }
}
