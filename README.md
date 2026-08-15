# Power Menu Custom Reboot

A modern GNOME Shell extension that seamlessly integrates multi-boot OS entries (Windows, Linux, etc.) directly into the **Quick Settings Power Menu** next to Restart and Power Off.

## Features

- **Native Power Menu Integration**: Choose your boot target directly when clicking the power icon in Quick Settings.
- **Multi-Bootloader Support**:
  - **GRUB / GRUB2**: Reliable `grub-reboot` / `grub2-reboot` support with os-prober integration.
  - **EFI Boot Manager (`efibootmgr`)**: Direct NVRAM boot-next support.
  - **systemd-boot**: `bootctl set-oneshot` support.
- **Rename Boot Entries**: Rename cryptic partition names (e.g. `Windows Boot Manager (on /dev/nvme0n1p1)`) to clean names like `Windows 11`.
- **Custom Icon Files**: Choose your own `.svg` or `.png` icon files for each operating system.
- **Toggle Visibility**: Easily hide entries you don't need (like installers or utility entries).
- **Smart OS Filtering**: Automatically hides the currently running operating system so you only see boot targets you can actually reboot into.

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

## Optional System Configuration

### 1. Passwordless Reboot (One-Liner)
To reboot into your other operating systems without typing your administrator password each time, run this one-liner in your terminal:

```bash
sudo tee /etc/polkit-1/rules.d/99-custom-reboot.rules << 'EOF'
polkit.addRule(function(action, subject) {
    if ((action.id == "org.freedesktop.policykit.exec") &&
        (subject.isInGroup("wheel") || subject.isInGroup("sudo"))) {
        var cmd = action.lookup("command_line");
        if (cmd && (cmd.indexOf("efibootmgr") >= 0 || cmd.indexOf("grub-reboot") >= 0 || cmd.indexOf("grub2-reboot") >= 0 || cmd.indexOf("bootctl") >= 0)) {
            return polkit.Result.YES;
        }
    }
});
EOF
```

### 2. Disable GRUB Boot Timeout
To boot straight into your default Linux distro without displaying the GRUB countdown:

```bash
# Set timeout to 0 and hidden
sudo sed -i 's/^GRUB_TIMEOUT=.*/GRUB_TIMEOUT=0/' /etc/default/grub
grep -q "GRUB_TIMEOUT_STYLE" /etc/default/grub && sudo sed -i 's/^GRUB_TIMEOUT_STYLE=.*/GRUB_TIMEOUT_STYLE=hidden/' /etc/default/grub || echo 'GRUB_TIMEOUT_STYLE="hidden"' | sudo tee -a /etc/default/grub

# Regenerate GRUB config
sudo grub2-mkconfig -o /boot/grub2/grub.cfg 2>/dev/null || sudo grub-mkconfig -o /boot/grub/grub.cfg
```

## Preferences

Open **Extension Settings** or run:
```bash
gnome-extensions prefs power-menu-custom-reboot@notcezar.github.io
```

## License

GPL-3.0 License.
