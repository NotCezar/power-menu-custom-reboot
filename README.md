# Power Menu Custom Reboot

A modern GNOME Shell extension that seamlessly integrates multi-boot OS entries (Windows, Linux, etc.) directly into the **Quick Settings Power Menu** next to Restart and Power Off.

## Features

- **Native Power Menu Integration**: Choose your boot target directly when clicking the power icon in Quick Settings.
- **Multi-Bootloader Support**:
  - **GRUB / GRUB2**: Reliable `grub-reboot` / `grub2-reboot` support with os-prober integration.
  - **EFI Boot Manager (`efibootmgr`)**: Direct NVRAM boot-next support.
  - **systemd-boot**: `bootctl set-oneshot` support.
  - **Custom Commands**: Run custom reboot scripts and commands.
- **Rename Boot Entries**: Rename cryptic partition names (e.g. `Windows Boot Manager (on /dev/nvme0n1p1)`) to clean names like `Windows 11`.
- **Custom Icon Files**: Choose your own `.svg` or `.png` icon files for each operating system.
- **Toggle Visibility**: Easily hide entries you don't need (like installers or utility entries).
- **Smart OS Filtering**: Automatically hides the currently running operating system so you only see boot targets you can actually reboot into.
- **GRUB Auto-Hide Helper**: One-click utility in Settings to disable GRUB timeout delay so your PC boots instantly into your primary OS by default.
- **Passwordless Reboot**: Optional Polkit rule generator to reboot into other OSs without entering your password every time.

## Installation

### Quick Install

```bash
# Clone the repository
git clone https://github.com/NotCezar/power-menu-custom-reboot.git
cd power-menu-custom-reboot

# Run installation script
chmod +x install.sh
./install.sh
```

### Manual Installation

1. Copy extension files to:
   `~/.local/share/gnome-shell/extensions/power-menu-custom-reboot@notcezar.github.io/`
2. Compile the schema:
   ```bash
   glib-compile-schemas ~/.local/share/gnome-shell/extensions/power-menu-custom-reboot@notcezar.github.io/schemas/
   ```
3. Enable the extension:
   ```bash
   gnome-extensions enable power-menu-custom-reboot@notcezar.github.io
   ```
4. Restart GNOME Shell (log out and log back in on Wayland, or press `Alt+F2` -> `r` on X11).

## Preferences

Open **Extension Settings** or run:
```bash
gnome-extensions prefs power-menu-custom-reboot@notcezar.github.io
```

## License

GPL-3.0 License.
