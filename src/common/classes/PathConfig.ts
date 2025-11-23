/*!
 * Copyright (c) 2019-2025 TUXEDO Computers GmbH <tux@tuxedocomputers.com>
 *
 * This file is part of TUXEDO Control Center.
 *
 * TUXEDO Control Center is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * TUXEDO Control Center is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with TUXEDO Control Center.  If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * Centralized configuration for all system paths used by TCC.
 *
 * Allows overriding system paths via environment variables for development and testing:
 * - TCC_SYS_BASE: Override base /sys path (default: /sys)
 * - TCC_PROC_BASE: Override base /proc path (default: /proc)
 * - TCC_DEV_BASE: Override base /dev path (default: /dev)
 *
 * Example usage for development with mock system:
 *   TCC_SYS_BASE=/tmp/mock-sys npm start
 */
export class PathConfig {
    // Base system paths - can be overridden via environment variables
    static readonly SYS_BASE = process.env.TCC_SYS_BASE || '/sys';
    static readonly PROC_BASE = process.env.TCC_PROC_BASE || '/proc';
    static readonly DEV_BASE = process.env.TCC_DEV_BASE || '/dev';

    // CPU control paths
    static readonly SYS_CPU = `${PathConfig.SYS_BASE}/devices/system/cpu`;
    static readonly SYS_CPU_CPUFREQ_BOOST = `${PathConfig.SYS_BASE}/devices/system/cpu/cpufreq/boost`;
    static readonly SYS_CPU_INTEL_PSTATE = `${PathConfig.SYS_BASE}/devices/system/cpu/intel_pstate`;

    // Display backlight paths
    static readonly SYS_BACKLIGHT = `${PathConfig.SYS_BASE}/class/backlight`;

    // Power supply paths
    static readonly SYS_POWER_SUPPLY = `${PathConfig.SYS_BASE}/class/power_supply`;

    // Hardware monitor paths
    static readonly SYS_HWMON = `${PathConfig.SYS_BASE}/class/hwmon`;

    // DMI/BIOS information paths
    static readonly SYS_DMI = `${PathConfig.SYS_BASE}/class/dmi/id`;

    // Platform device paths
    static readonly SYS_PLATFORM_DEVICES = `${PathConfig.SYS_BASE}/bus/platform/devices`;

    // TUXEDO keyboard platform paths
    static readonly SYS_TUXEDO_KEYBOARD = `${PathConfig.SYS_BASE}/devices/platform/tuxedo_keyboard`;
    static readonly SYS_TUXEDO_KEYBOARD_LEDS_WHITE = `${PathConfig.SYS_TUXEDO_KEYBOARD}/leds/white:kbd_backlight`;
    static readonly SYS_TUXEDO_KEYBOARD_LEDS_RGB = `${PathConfig.SYS_TUXEDO_KEYBOARD}/leds/rgb:kbd_backlight`;
    static readonly SYS_TUXEDO_KEYBOARD_LEDS_RGB_1 = `${PathConfig.SYS_TUXEDO_KEYBOARD}/leds/rgb:kbd_backlight_1`;
    static readonly SYS_TUXEDO_KEYBOARD_LEDS_RGB_2 = `${PathConfig.SYS_TUXEDO_KEYBOARD}/leds/rgb:kbd_backlight_2`;
    static readonly SYS_TUXEDO_KEYBOARD_FN_LOCK = `${PathConfig.SYS_TUXEDO_KEYBOARD}/fn_lock`;
    static readonly SYS_TUXEDO_KEYBOARD_CHARGING_PROFILE = `${PathConfig.SYS_TUXEDO_KEYBOARD}/charging_profile`;
    static readonly SYS_TUXEDO_KEYBOARD_CHARGING_PRIORITY = `${PathConfig.SYS_TUXEDO_KEYBOARD}/charging_priority`;

    // TUXEDO NB05 keyboard backlight paths
    static readonly SYS_TUXEDO_NB05_KBD_BACKLIGHT = `${PathConfig.SYS_PLATFORM_DEVICES}/tuxedo_nb05_kbd_backlight/leds/white:kbd_backlight`;

    // TUXEDO fan control paths
    static readonly SYS_TUXEDO_FAN_CONTROL = `${PathConfig.SYS_PLATFORM_DEVICES}/tuxedo_fan_control`;

    // TUXEDO platform profile paths
    static readonly SYS_TUXEDO_PLATFORM_PROFILE = `${PathConfig.SYS_PLATFORM_DEVICES}/tuxedo_platform_profile/platform_profile`;
    static readonly SYS_TUXEDO_PLATFORM_PROFILE_CHOICES = `${PathConfig.SYS_PLATFORM_DEVICES}/tuxedo_platform_profile/platform_profile_choices`;

    // TUXEDO NVIDIA power control paths
    static readonly SYS_TUXEDO_NVIDIA_POWER_CTRL = `${PathConfig.SYS_BASE}/devices/platform/tuxedo_nvidia_power_ctrl`;
    static readonly SYS_TUXEDO_NVIDIA_POWER_CTRL_CTGP_OFFSET = `${PathConfig.SYS_TUXEDO_NVIDIA_POWER_CTRL}/ctgp_offset`;

    // ACPI platform profile paths
    static readonly SYS_ACPI_PLATFORM_PROFILE = `${PathConfig.SYS_BASE}/firmware/acpi/platform_profile`;
    static readonly SYS_ACPI_PLATFORM_PROFILE_CHOICES = `${PathConfig.SYS_BASE}/firmware/acpi/platform_profile_choices`;

    // Intel RAPL (power control) paths
    static readonly SYS_INTEL_RAPL_BASE = `${PathConfig.SYS_BASE}/devices/virtual/powercap/intel-rapl`;
    static readonly SYS_INTEL_RAPL_CPU = `${PathConfig.SYS_INTEL_RAPL_BASE}/intel-rapl:0`;
    static readonly SYS_INTEL_RAPL_IGPU = `${PathConfig.SYS_INTEL_RAPL_BASE}/intel-rapl:0/intel-rapl:0:1`;

    // PCI device paths
    static readonly SYS_PCI_DEVICES = `${PathConfig.SYS_BASE}/bus/pci/devices`;

    // USB device paths
    static readonly SYS_USB_DEVICES = `${PathConfig.SYS_BASE}/bus/usb/devices`;
    static readonly SYS_USB_DRIVERS = `${PathConfig.SYS_BASE}/bus/usb/drivers/usb`;

    // HID driver paths for keyboard backlight
    static readonly SYS_HID_DRIVERS = `${PathConfig.SYS_BASE}/bus/hid/drivers`;
    static readonly SYS_HID_TUXEDO_KEYBOARD_ITE = `${PathConfig.SYS_HID_DRIVERS}/tuxedo-keyboard-ite`;
    static readonly SYS_HID_ITE_829X = `${PathConfig.SYS_HID_DRIVERS}/ite_829x`;
    static readonly SYS_HID_ITE_8291 = `${PathConfig.SYS_HID_DRIVERS}/ite_8291`;

    // Platform driver paths for keyboard backlight
    static readonly SYS_PLATFORM_DRIVERS = `${PathConfig.SYS_BASE}/bus/platform/drivers`;
    static readonly SYS_PLATFORM_TUXEDO_NB04_KBD_BACKLIGHT = `${PathConfig.SYS_PLATFORM_DRIVERS}/tuxedo_nb04_kbd_backlight`;

    // Block device paths
    static readonly SYS_BLOCK = `${PathConfig.SYS_BASE}/block`;

    // Debug DRI paths
    static readonly SYS_KERNEL_DEBUG_DRI = `${PathConfig.SYS_BASE}/kernel/debug/dri`;

    // PROC filesystem paths
    static readonly PROC_CPUINFO = `${PathConfig.PROC_BASE}/cpuinfo`;

    // Device file paths
    static readonly DEV_TUXEDO_IO = `${PathConfig.DEV_BASE}/tuxedo_io`;
}
