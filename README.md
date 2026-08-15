# Power Menu Custom Reboot

A modern GNOME Shell extension that integrates multi-boot OS entries (Windows, Linux, etc.) directly into the **Quick Settings Power Menu** next to Restart and Power Off.

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
4. Restart GNOME Shell (log out and log back in on Wayland).

## Optional System Configuration

### 1. Passwordless Reboot (All Distros)
To allow changing the next boot target without typing your administrator password each time, run this universal one-liner in your terminal (works on **Fedora, Ubuntu, Debian, Arch Linux, openSUSE, and Pop!_OS**):

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

---

### 2. GRUB Read Permissions (Fedora / RHEL / openSUSE)
On some distributions (like Fedora), GRUB directories have restricted permissions by default. Ensure unprivileged read access so GNOME Shell can detect your boot entries without superuser prompts:

* **Fedora / RHEL / openSUSE**:
  ```bash
  sudo chmod 755 /boot/grub2 && sudo chmod 644 /boot/grub2/grub.cfg
  ```
* **Ubuntu / Debian / Arch Linux**:
  *(Usually readable by default)*
  ```bash
  sudo chmod 644 /boot/grub/grub.cfg 2>/dev/null || true
  ```

---

### 3. Disable GRUB Boot Countdown (Instant Boot)
To boot straight into your default Linux distro without displaying the GRUB countdown screen:

* **Universal (Auto-Detect Distro)**:
  ```bash
  sudo sed -i 's/^GRUB_TIMEOUT=.*/GRUB_TIMEOUT=0/' /etc/default/grub
  grep -q "GRUB_TIMEOUT_STYLE" /etc/default/grub && sudo sed -i 's/^GRUB_TIMEOUT_STYLE=.*/GRUB_TIMEOUT_STYLE=hidden/' /etc/default/grub || echo 'GRUB_TIMEOUT_STYLE="hidden"' | sudo tee -a /etc/default/grub
  grep -q "GRUB_RECORDFAIL_TIMEOUT" /etc/default/grub || echo 'GRUB_RECORDFAIL_TIMEOUT=0' | sudo tee -a /etc/default/grub

  # Regenerate GRUB configuration
  command -v update-grub >/dev/null && sudo update-grub || \
  command -v grub2-mkconfig >/dev/null && sudo grub2-mkconfig -o /boot/grub2/grub.cfg || \
  command -v grub-mkconfig >/dev/null && sudo grub-mkconfig -o /boot/grub/grub.cfg
  ```

* **Ubuntu / Debian / Pop!_OS**:
  ```bash
  sudo update-grub
  ```
* **Arch Linux / Manjaro**:
  ```bash
  sudo grub-mkconfig -o /boot/grub/grub.cfg
  ```
* **Fedora / RHEL / openSUSE**:
  ```bash
  sudo grub2-mkconfig -o /boot/grub2/grub.cfg
  ```

## Preferences

Open **Extension Settings** or run:
```bash
gnome-extensions prefs power-menu-custom-reboot@notcezar.github.io
```

## License

GPL-3.0 License.
