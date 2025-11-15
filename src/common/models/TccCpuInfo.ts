/*!
 * Copyright (c) 2024 TUXEDO Computers GmbH <tux@tuxedocomputers.com>
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
 * Static CPU information that rarely changes (hardware capabilities).
 * This data is cached once on daemon startup to avoid repeated sysfs reads.
 */
export interface IStaticCpuInfo {
    /** Total number of logical CPUs in the system */
    totalCpus: number;
    /** Array of per-CPU static data */
    cpus: IStaticCpuData[];
}

/**
 * Static data for a single logical CPU.
 * Includes hardware limits and topology information.
 */
export interface IStaticCpuData {
    /** Logical CPU ID (0, 1, 2, ...) */
    cpuId: number;
    /** Minimum frequency the CPU hardware supports (Hz) */
    cpuinfoMinFreq: number;
    /** Maximum frequency the CPU hardware supports (Hz) */
    cpuinfoMaxFreq: number;
    /** List of available discrete frequency steps (Hz), may be undefined */
    scalingAvailableFrequencies: number[] | undefined;
    /** List of available CPU governors (e.g., 'powersave', 'performance') */
    scalingAvailableGovernors: string[];
    /** List of available energy performance preference values */
    energyPerformanceAvailablePreferences: string[];
    /** Physical core ID (multiple logical CPUs can share same coreId for HT/SMT) */
    coreId: number;
    /** List of logical CPU IDs that share the same physical core (hyperthreading siblings) */
    threadSiblingsList: number[];
}

/**
 * Runtime CPU information that changes frequently (current state).
 * This data is updated every daemon work cycle.
 */
export interface IRuntimeCpuInfo {
    /** Timestamp when this data was collected (milliseconds since epoch) */
    timestamp: number;
    /** Array of per-CPU runtime data */
    cpus: IRuntimeCpuData[];
    /** Global boost status (AMD CPUs) */
    boost: boolean;
    /** Global turbo disable flag (Intel CPUs) */
    noTurbo: boolean;
}

/**
 * Runtime data for a single logical CPU.
 * Fields are null when CPU is offline (cannot be read from sysfs).
 */
export interface IRuntimeCpuData {
    /** Logical CPU ID (0, 1, 2, ...) */
    cpuId: number;
    /** Whether this CPU is currently online/enabled */
    online: boolean;
    /** Current CPU frequency (Hz), null if offline */
    scalingCurFreq: number | null;
    /** Current minimum frequency limit (Hz), null if offline */
    scalingMinFreq: number | null;
    /** Current maximum frequency limit (Hz), null if offline */
    scalingMaxFreq: number | null;
    /** Current active governor, null if offline */
    scalingGovernor: string | null;
    /** Current energy performance preference, null if offline */
    energyPerformancePreference: string | null;
}
