import Gio from 'gi://Gio';
import { execCommand, logError } from './utils.js';

/**
 * Helper to read file asynchronously using Gio.File.load_contents_async
 * @param {string} path 
 * @returns {Promise<string|null>}
 */
async function loadFileAsync(path) {
    const file = Gio.File.new_for_path(path);
    if (!file.query_exists(null)) return null;

    return new Promise((resolve) => {
        file.load_contents_async(null, (sourceFile, res) => {
            try {
                const [ok, bytes] = sourceFile.load_contents_finish(res);
                if (ok && bytes) {
                    resolve(new TextDecoder().decode(bytes));
                } else {
                    resolve(null);
                }
            } catch (e) {
                resolve(null);
            }
        });
    });
}

export class BootloaderManager {
    static _cachedEntries = null;
    static _lastFetchTime = 0;

    /**
     * Get running OS identifiers from /etc/os-release
     * @returns {Promise<string[]>}
     */
    static async getCurrentOsIdentifiers() {
        const ids = [];
        try {
            const text = await loadFileAsync('/etc/os-release');
            if (text) {
                for (const line of text.split('\n')) {
                    if (line.startsWith('ID=') || line.startsWith('NAME=')) {
                        const val = line.split('=')[1].replace(/"/g, '').trim().toLowerCase();
                        if (val && val !== 'linux' && val !== 'gnu/linux') {
                            ids.push(val);
                        }
                    }
                }
            }
        } catch (e) {
            logError('Reading /etc/os-release failed', e);
        }

        if (ids.length === 0) ids.push('fedora');
        return ids;
    }

    /**
     * Invalidate cache to force reload
     */
    static invalidateCache() {
        this._cachedEntries = null;
        this._lastFetchTime = 0;
    }

    /**
     * Get available boot targets according to chosen or auto-detected backend
     * @param {Gio.Settings} settings 
     * @returns {Promise<Array<{id: string, title: string, backend: string, icon?: string}>>}
     */
    static async getBootEntries(settings) {
        const now = Date.now();
        if (this._cachedEntries && (now - this._lastFetchTime < 30000)) {
            return this._cachedEntries;
        }

        const backend = settings.get_string('bootloader-backend');
        let entries = [];

        // Prioritize GRUB first on Linux since os-prober manages Windows & OS entries
        if (backend === 'grub' || backend === 'auto') {
            try {
                entries = await this.getGrubBootEntries();
                if (entries.length > 0 && backend === 'auto') {
                    const filtered = await this._filterCurrentOs(entries);
                    this._cachedEntries = filtered;
                    this._lastFetchTime = now;
                    return filtered;
                }
            } catch (e) {
                logError('grub detection failed', e);
            }
        }

        if (backend === 'efibootmgr' || (backend === 'auto' && entries.length === 0)) {
            try {
                entries = await this.getEfiBootEntries();
                if (entries.length > 0 && backend === 'auto') {
                    const filtered = await this._filterCurrentOs(entries);
                    this._cachedEntries = filtered;
                    this._lastFetchTime = now;
                    return filtered;
                }
            } catch (e) {
                logError('efibootmgr detection failed', e);
            }
        }

        if (backend === 'systemd-boot' || (backend === 'auto' && entries.length === 0)) {
            try {
                entries = await this.getSystemdBootEntries();
                if (entries.length > 0 && backend === 'auto') {
                    const filtered = await this._filterCurrentOs(entries);
                    this._cachedEntries = filtered;
                    this._lastFetchTime = now;
                    return filtered;
                }
            } catch (e) {
                logError('systemd-boot detection failed', e);
            }
        }

        const filtered = await this._filterCurrentOs(entries);
        this._cachedEntries = filtered;
        this._lastFetchTime = now;
        return filtered;
    }

    /**
     * Always hide the currently running OS and firmware setup entries
     */
    static async _filterCurrentOs(entries) {
        const currentOsIds = await this.getCurrentOsIdentifiers();

        return entries.filter(entry => {
            const titleLower = (entry.title || '').toLowerCase();
            if (titleLower.includes('uefi firmware') || titleLower.includes('firmware settings')) {
                return false;
            }
            const isCurrent = currentOsIds.some(id => id.length >= 3 && titleLower.includes(id));
            return !isCurrent;
        });
    }

    /**
     * Set the next boot target
     * @param {Object} entry 
     * @returns {Promise<boolean>}
     */
    static async setBootTarget(entry) {
        if (entry.backend === 'grub') {
            return await this.setGrubBootTarget(entry.id);
        } else if (entry.backend === 'efibootmgr') {
            return await this.setEfiBootTarget(entry.id);
        } else if (entry.backend === 'systemd-boot') {
            return await this.setSystemdBootTarget(entry.id);
        }
        return false;
    }

    // --- GRUB ---

    static async getGrubBootEntries() {
        const paths = [
            '/boot/grub2/grub.cfg',
            '/boot/grub/grub.cfg',
            '/etc/grub2.cfg',
            '/etc/grub2-efi.cfg'
        ];
        let content = '';

        for (const path of paths) {
            const fileContent = await loadFileAsync(path);
            if (fileContent) {
                content = fileContent;
                break;
            }
        }

        if (!content) return [];

        const entries = [];
        const entryRegex = /menuentry\s+['"]([^'"]+)['"](?:\s+--class\s+[^\s]+)*(?:[^{]*\$menuentry_id_option\s+['"]([^'"]+)['"])?/g;
        let match;

        while ((match = entryRegex.exec(content)) !== null) {
            const title = match[1];
            const entryId = match[2] || title;

            if (title && !entries.some(e => e.id === entryId || e.title === title)) {
                entries.push({
                    id: entryId,
                    title: title,
                    backend: 'grub',
                });
            }
        }
        return entries;
    }

    static async setGrubBootTarget(id) {
        const bin = (await this.binExists('/usr/bin/grub2-reboot')) ? '/usr/bin/grub2-reboot' : '/usr/bin/grub-reboot';
        const [status] = await execCommand(['/usr/bin/pkexec', bin, id]);
        return status === 0;
    }

    // --- EFIBOOTMGR ---

    static async getEfiBootEntries() {
        const [status, stdout] = await execCommand(['efibootmgr']);
        if (status !== 0) return [];

        const lines = stdout.split('\n');
        const entries = [];

        const blacklistedKeywords = [
            'setup', 'boot menu', 'diagnostic', 'diagnostics', 'asset information',
            'regulatory information', 'secure wipe', 'interrupt menu', 'rescue and recovery',
            'mebx', 'usb cd', 'usb fdd', 'nvme0', 'usb hdd', 'pxe boot', 'lenovo cloud',
            'other cd', 'other hdd', 'ider boot', 'ata hdd', 'atapi cd'
        ];

        for (const line of lines) {
            const match = /^Boot([0-9A-Fa-f]{4})\*\s+(.+)$/.exec(line.trim());
            if (match) {
                const bootNum = match[1];
                let rawTitle = match[2];

                let cleanTitle = rawTitle.split(/\t|HD\(|FvFile\(|VenMsg\(/)[0].trim();
                if (!cleanTitle) cleanTitle = rawTitle.trim();

                const lowerTitle = cleanTitle.toLowerCase();
                const isBlacklisted = blacklistedKeywords.some(kw => lowerTitle.includes(kw));

                if (!isBlacklisted && cleanTitle.length > 0) {
                    entries.push({
                        id: bootNum,
                        title: cleanTitle,
                        backend: 'efibootmgr',
                    });
                }
            }
        }
        return entries;
    }

    static async setEfiBootTarget(bootNum) {
        const bin = '/usr/bin/efibootmgr';
        const [status] = await execCommand(['/usr/bin/pkexec', bin, '-n', bootNum]);
        return status === 0;
    }

    // --- SYSTEMD-BOOT ---

    static async getSystemdBootEntries() {
        const bin = '/usr/bin/bootctl';
        const [status, stdout] = await execCommand([bin, 'list']);
        if (status !== 0 || !stdout) return [];

        const lines = stdout.split('\n');
        const entries = [];
        let currentTitle = '';
        let currentId = '';

        for (const line of lines) {
            const titleMatch = /(?<=title:\s+).+/.exec(line);
            const idMatch = /(?<=id:\s+).+/.exec(line);

            if (titleMatch) {
                currentTitle = titleMatch[0].trim();
            } else if (idMatch) {
                currentId = idMatch[0].trim();
                if (currentTitle && currentId) {
                    entries.push({
                        id: currentId,
                        title: currentTitle,
                        backend: 'systemd-boot',
                    });
                    currentTitle = '';
                    currentId = '';
                }
            }
        }
        return entries;
    }

    static async setSystemdBootTarget(id) {
        const bin = '/usr/bin/bootctl';
        const [status] = await execCommand(['/usr/bin/pkexec', bin, 'set-oneshot', id]);
        return status === 0;
    }

    static async binExists(path) {
        const file = Gio.File.new_for_path(path);
        return file.query_exists(null);
    }
}
