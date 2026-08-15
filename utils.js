import Gio from 'gi://Gio';

/**
 * Execute a command asynchronously using Gio.Subprocess
 * @param {string[]} argv 
 * @returns {Promise<[number, string, string]>} [exitStatus, stdout, stderr]
 */
export async function execCommand(argv) {
    return new Promise((resolve, reject) => {
        try {
            const proc = new Gio.Subprocess({
                argv: argv,
                flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
            });
            proc.init(null);
            proc.communicate_utf8_async(null, null, (subprocess, res) => {
                try {
                    const [ok, stdout, stderr] = subprocess.communicate_utf8_finish(res);
                    const status = subprocess.get_exit_status();
                    resolve([status, stdout || '', stderr || '']);
                } catch (err) {
                    reject(err);
                }
            });
        } catch (err) {
            reject(err);
        }
    });
}

/**
 * Creates a Gio.Icon from an icon name or custom file path (.svg, .png)
 * @param {string} iconValue 
 * @returns {Gio.Icon}
 */
export function createGIcon(iconValue) {
    if (!iconValue || typeof iconValue !== 'string') {
        return Gio.Icon.new_for_string('system-reboot-symbolic');
    }

    if (iconValue.startsWith('/') || iconValue.startsWith('file://')) {
        const cleanPath = iconValue.replace('file://', '');
        const file = Gio.File.new_for_path(cleanPath);
        if (file.query_exists(null)) {
            return new Gio.FileIcon({ file: file });
        }
    }

    return Gio.Icon.new_for_string(iconValue);
}

/**
 * Maps OS title to appropriate default symbolic icon name if no custom file is set
 * @param {string} title 
 * @param {string} [overrideIcon]
 * @returns {string} iconName or file path
 */
export function getOSIcon(title, overrideIcon) {
    if (overrideIcon && overrideIcon.trim().length > 0) {
        return overrideIcon.trim();
    }

    const lower = (title || '').toLowerCase();
    if (lower.includes('window') || lower.includes('win10') || lower.includes('win11')) {
        return 'computer-symbolic';
    }
    return 'drive-harddisk-symbolic';
}

export function logError(msg, err) {
    console.error(`[PowerMenuCustomReboot] ${msg}`, err || '');
}
