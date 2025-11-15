/*!
 * Copyright (c) 2019-2024 TUXEDO Computers GmbH <tux@tuxedocomputers.com>
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
import { DaemonWorker } from './DaemonWorker';
import { CpuController } from '../../common/classes/CpuController';
import { PathConfig } from '../../common/classes/PathConfig';

import { TuxedoControlCenterDaemon } from './TuxedoControlCenterDaemon';
import { ITccProfile } from '../../common/models/TccProfile';
import { ScalingDriver } from '../../common/classes/LogicalCpuController';
import { TUXEDODevice } from '../../common/models/DefaultProfiles';
import { IStaticCpuInfo, IStaticCpuData, IRuntimeCpuInfo, IRuntimeCpuData } from '../../common/models/TccCpuInfo';

export class CpuWorker extends DaemonWorker {
    private readonly basePath = PathConfig.SYS_CPU;
    private readonly cpuCtrl: CpuController;

    private readonly preferredAcpiFreqGovernors = [ 'ondemand', 'schedutil', 'conservative' ];
    private readonly preferredPerformanceAcpiFreqGovernors = [ 'performance' ];

    /**
     * Skip writing energy performance preference if flag is set
     */
    private noEPPWriteQuirk: boolean;

    /**
     * Cached static CPU information (hardware limits, topology).
     * Collected once on daemon startup to avoid repeated sysfs reads.
     */
    private cachedStaticCpuInfo: IStaticCpuInfo;

    constructor(tccd: TuxedoControlCenterDaemon) {
        super(10000, tccd);
        this.cpuCtrl = new CpuController(this.basePath);

        const dev = this.tccd.identifyDevice();
        if ([TUXEDODevice.SIRIUS1602, TUXEDODevice.STELLSL15A06].includes(dev)) {
            this.noEPPWriteQuirk = true;
        } else {
            this.noEPPWriteQuirk = false;
        }
    }

    /**
     * Collect static CPU information (hardware limits, topology).
     * This data rarely changes so it's cached once on startup.
     *
     * @returns Static CPU info for all CPUs
     */
    private collectStaticCpuInfo(): IStaticCpuInfo {
        const cpuData: IStaticCpuData[] = [];

        for (const core of this.cpuCtrl.cores) {
            try {
                // Ensure CPU is online to read its data
                // Note: cpu0 is always online and doesn't have online file
                const isOnline = core.coreIndex === 0 ? true : core.online.readValue();

                // Skip offline CPUs - we can't read their static data
                // In future, we might want to temporarily online them to cache data
                if (!isOnline) {
                    this.tccd.logLine(`CpuWorker: Skipping offline CPU ${core.coreIndex} for static info collection`);
                    continue;
                }

                const staticData: IStaticCpuData = {
                    cpuId: core.coreIndex,
                    cpuinfoMinFreq: core.cpuinfoMinFreq.readValue(),
                    cpuinfoMaxFreq: core.cpuinfoMaxFreq.readValue(),
                    scalingAvailableFrequencies: core.scalingAvailableFrequencies.readValueNT(),
                    scalingAvailableGovernors: core.scalingAvailableGovernors.readValue(),
                    energyPerformanceAvailablePreferences: core.energyPerformanceAvailablePreferences.readValueNT() || [],
                    coreId: core.coreId.readValue(),
                    threadSiblingsList: core.threadSiblingsList.readValue(),
                    coreSiblingsList: core.coreSiblingsList.readValue()
                };

                cpuData.push(staticData);
            } catch (err) {
                this.tccd.logLine(`CpuWorker: Error collecting static info for CPU ${core.coreIndex} => ${err}`);
            }
        }

        return {
            totalCpus: this.cpuCtrl.cores.length,
            cpus: cpuData
        };
    }

    /**
     * Collect runtime CPU information (current frequencies, governor, online status).
     * This data changes frequently and is collected on every work cycle.
     *
     * @returns Runtime CPU info for all CPUs with current timestamp
     */
    private collectRuntimeCpuInfo(): IRuntimeCpuInfo {
        const cpuData: IRuntimeCpuData[] = [];

        for (const core of this.cpuCtrl.cores) {
            cpuData.push(this.collectSingleRuntimeCpuData(core));
        }

        return {
            timestamp: Date.now(),
            cpus: cpuData,
            boost: this.cpuCtrl.boost.readValueNT() || false,
            noTurbo: this.cpuCtrl.intelPstate.noTurbo.readValueNT() || false
        };
    }


    /**
     * Create runtime CPU data structure for an offline CPU.
     * All runtime fields are set to null since they cannot be read when CPU is offline.
     *
     * @param cpuId Logical CPU ID
     * @returns Runtime CPU data with online=false and null values
     */
    private createOfflineCpuData(cpuId: number): IRuntimeCpuData {
        return {
            cpuId: cpuId,
            online: false,
            scalingCurFreq: null,
            scalingMinFreq: null,
            scalingMaxFreq: null,
            scalingGovernor: null,
            energyPerformancePreference: null
        };
    }

    /**
     * Collect runtime CPU data for a single logical CPU.
     * Handles both online and offline CPUs, returning appropriate data structure.
     *
     * @param core Logical CPU controller
     * @returns Runtime CPU data
     */
    private collectSingleRuntimeCpuData(core: any): IRuntimeCpuData {
        try {
            // Check if CPU is online
            // cpu0 doesn't have online file, it's always online
            const isOnline = core.coreIndex === 0 ? true : (core.online.isAvailable() ? core.online.readValue() : false);

            if (isOnline) {
                // CPU is online - read all runtime data
                return {
                    cpuId: core.coreIndex,
                    online: true,
                    scalingCurFreq: core.scalingCurFreq.readValueNT(),
                    scalingMinFreq: core.scalingMinFreq.readValueNT(),
                    scalingMaxFreq: core.scalingMaxFreq.readValueNT(),
                    scalingGovernor: core.scalingGovernor.readValueNT(),
                    energyPerformancePreference: core.energyPerformancePreference.readValueNT()
                };
            } else {
                // CPU is offline - can't read runtime data, return offline structure
                return this.createOfflineCpuData(core.coreIndex);
            }
        } catch (err) {
            this.tccd.logLine(`CpuWorker: Error collecting runtime info for CPU ${core.coreIndex} => ${err}`);
            // On error, return offline entry
            return this.createOfflineCpuData(core.coreIndex);
        }
    }


    /**
     * Save current CPU online state and online all CPUs.
     * This allows us to collect static info from all CPUs, even those currently offline.
     *
     * @returns Array of CPU indices that were online before this operation
     */
    private saveAndOnlineAllCpus(): number[] {
        try {
            // Read current online state
            const savedOnlineState = this.cpuCtrl.online.readValue();
            this.tccd.logLine(`CpuWorker: Saved online state: [${savedOnlineState.join(',')}]`);

            // Online all CPUs (skip CPU 0 as it's always online)
            this.tccd.logLine('CpuWorker: Temporarily onlining all CPUs for static info collection');
            for (let i = 1; i < this.cpuCtrl.cores.length; i++) {
                const core = this.cpuCtrl.cores[i];

                // Check if online file is available and writable
                if (!core.online.isAvailable() || !core.online.isWritable()) {
                    this.tccd.logLine(`CpuWorker: Cannot control online state for CPU ${i} (not available or not writable)`);
                    continue;
                }

                try {
                    // Only try to online if currently offline
                    if (!core.online.readValue()) {
                        core.online.writeValue(true);
                        this.tccd.logLine(`CpuWorker: Brought CPU ${i} online`);
                    }
                } catch (err) {
                    this.tccd.logLine(`CpuWorker: Failed to online CPU ${i} => ${err}`);
                }
            }

            return savedOnlineState;
        } catch (err) {
            this.tccd.logLine(`CpuWorker: Error saving/onlining CPUs => ${err}`);
            // Return empty array on error - restoration will be skipped
            return [];
        }
    }

    /**
     * Restore CPU online state to previously saved state.
     *
     * @param savedState Array of CPU indices that should be online
     */
    private restoreCpuOnlineState(savedState: number[]): void {
        if (!savedState || savedState.length === 0) {
            this.tccd.logLine('CpuWorker: No saved state to restore, skipping restoration');
            return;
        }

        try {
            this.tccd.logLine(`CpuWorker: Restoring previous online state: [${savedState.join(',')}]`);

            // Restore state for each CPU (skip CPU 0 as it's always online)
            for (let i = 1; i < this.cpuCtrl.cores.length; i++) {
                const core = this.cpuCtrl.cores[i];

                // Check if online file is available and writable
                if (!core.online.isAvailable() || !core.online.isWritable()) {
                    continue;
                }

                try {
                    const shouldBeOnline = savedState.includes(i);
                    const currentlyOnline = core.online.readValue();

                    // Only write if state needs to change
                    if (shouldBeOnline && !currentlyOnline) {
                        core.online.writeValue(true);
                        this.tccd.logLine(`CpuWorker: Restored CPU ${i} to online`);
                    } else if (!shouldBeOnline && currentlyOnline) {
                        core.online.writeValue(false);
                        this.tccd.logLine(`CpuWorker: Restored CPU ${i} to offline`);
                    }
                } catch (err) {
                    this.tccd.logLine(`CpuWorker: Failed to restore state for CPU ${i} => ${err}`);
                }
            }

            this.tccd.logLine('CpuWorker: CPU online state restoration complete');
        } catch (err) {
            this.tccd.logLine(`CpuWorker: Error restoring CPU state => ${err}`);
        }
    }

    public onStart() {
        // Collect and cache static CPU information on daemon startup
        // Temporarily online all CPUs to ensure we get complete hardware info
        let savedOnlineState: number[] = [];

        try {
            // Save current state and online all CPUs
            savedOnlineState = this.saveAndOnlineAllCpus();

            // Small delay to let CPUs stabilize after onlining
            if (savedOnlineState.length > 0) {
                // Sleep for 100ms
                const startTime = Date.now();
                while (Date.now() - startTime < 100) {
                    // Busy wait (acceptable for short delay in startup)
                }
            }

            // Collect static info (now includes all CPUs)
            this.cachedStaticCpuInfo = this.collectStaticCpuInfo();
            this.tccd.dbusData.staticCpuInfoJSON = JSON.stringify(this.cachedStaticCpuInfo);
            this.tccd.logLine(`CpuWorker: Cached static CPU info for ${this.cachedStaticCpuInfo.cpus.length} CPUs`);
        } catch (err) {
            this.tccd.logLine(`CpuWorker: Error collecting static CPU info => ${err}`);
        } finally {
            // Always restore previous online state, even if collection failed
            this.restoreCpuOnlineState(savedOnlineState);
        }

        // Apply active profile (which may change CPU online state again)
        if (this.tccd.settings.cpuSettingsEnabled) {
            this.applyCpuProfile(this.activeProfile);
        }
    }

    public onWork() {
        // Collect and expose runtime CPU information on every work cycle
        try {
            const runtimeCpuInfo = this.collectRuntimeCpuInfo();
            this.tccd.dbusData.runtimeCpuInfoJSON = JSON.stringify(runtimeCpuInfo);
        } catch (err) {
            this.tccd.logLine(`CpuWorker: Error collecting runtime CPU info => ${err}`);
        }

        // Check if current profile CPU values are actually set. If not
        // apply profile again
        try {
            if (this.tccd.settings.cpuSettingsEnabled && !this.validateCpuFreq()) {
                this.tccd.logLine('CpuWorker: Incorrect settings, reapplying profile');
                this.applyCpuProfile(this.activeProfile);
            }
        } catch (err) {
            this.tccd.logLine('CpuWorker: Error validating/reapplying profile => ' + err);
        }
    }

    public onExit() {
        this.setCpuDefaultConfig();
    }

    /**
     * Choose the default governor for the current system
     *
     * @returns The found governor or undefined on error or no match
     */
    public findDefaultGovernor(): string {
        let chosenName: string;
        try {
            let scalingDriver: string;
            if (this.cpuCtrl.cores[0].scalingDriver.isAvailable()) {
                scalingDriver = this.cpuCtrl.cores[0].scalingDriver.readValueNT();
            }

            const fixedPowersaveDrivers = [
                ScalingDriver.intel_pstate,
                ScalingDriver.amd_pstate_epp].map(d => d.toString());

            if (fixedPowersaveDrivers.includes(scalingDriver)) {
                // Fixed 'powersave' governor for intel_pstate and amd-pstate-epp
                return 'powersave';
            } else {
                // Preferred governors list for other drivers, mainly 'acpi-cpufreq'.
                // Also includes 'intel_cpufreq' which according to kernel.org doc on intel_pstate
                // behaves as the acpi-cpufreq governors.
                const availableGovernors = this.cpuCtrl.cores[0].scalingAvailableGovernors.readValue();
                for (const governorName of this.preferredAcpiFreqGovernors) {
                    if (availableGovernors.includes(governorName)) {
                        chosenName = governorName;
                        break;
                    }
                }
                return chosenName;
            }
        } catch (err) {
            return chosenName;
        }
    }

    /**
     * Choose the maximum performance governor for the current system
     *
     * @returns The found governor or undefined on error or no match
     */
    public findPerformanceGovernor(): string {
        let chosenName: string;
        try {
            let scalingDriver: string;
            if (this.cpuCtrl.cores[0].scalingDriver.isAvailable()) {
                scalingDriver = this.cpuCtrl.cores[0].scalingDriver.readValueNT();
            }

            const fixedPerformanceDrivers = [
                ScalingDriver.intel_pstate,
                ScalingDriver.amd_pstate_epp].map(d => d.toString());

            if (fixedPerformanceDrivers.includes(scalingDriver)) {
                // Fixed 'performance' governor for intel_pstate and amd-pstate-epp
                return 'performance';
            } else {
                // Preferred governors list for other drivers, mainly 'acpi-cpufreq'.
                // Also includes 'intel_cpufreq' which according to kernel.org doc on intel_pstate
                // behaves as the acpi-cpufreq governors.
                const availableGovernors = this.cpuCtrl.cores[0].scalingAvailableGovernors.readValue();
                for (const governorName of this.preferredPerformanceAcpiFreqGovernors) {
                    if (availableGovernors.includes(governorName)) {
                        chosenName = governorName;
                        break;
                    }
                }
                return chosenName;
            }
        } catch (err) {
            return chosenName;
        }
    }

    /**
     * Applies the cpu part of a profile by writing to the sysfs interface
     *
     * @param profile   Profile that contains a 'cpu' key of type ITccProfileCpu.
     *                  Undefined values are interpreted as "use default".
     */
    private applyCpuProfile(profile: ITccProfile) {
        try {
            // Reset everything to default on all cores before applying settings
            // Set online status last so that all cores get the same settings
            this.setCpuDefaultConfig();

            if (!profile.cpu.useMaxPerfGov) {
                // Note: Hard set governor to default (not included in profiles atm)
                profile.cpu.governor = this.findDefaultGovernor();

                this.cpuCtrl.setGovernor(profile.cpu.governor);
                if (!this.noEPPWriteQuirk) {
                    this.cpuCtrl.setEnergyPerformancePreference(profile.cpu.energyPerformancePreference);
                }

                this.cpuCtrl.setGovernorScalingMinFrequency(profile.cpu.scalingMinFrequency);
                this.cpuCtrl.setGovernorScalingMaxFrequency(profile.cpu.scalingMaxFrequency);
            }
            else {
                profile.cpu.governor = this.findPerformanceGovernor();

                this.cpuCtrl.setGovernor(profile.cpu.governor);
                if (!this.noEPPWriteQuirk) {
                    this.cpuCtrl.setEnergyPerformancePreference("performance");
                }

                this.cpuCtrl.setGovernorScalingMinFrequency(-2);
                this.cpuCtrl.setGovernorScalingMaxFrequency(undefined);
            }

            // Finally set the number of online cores
            this.cpuCtrl.useCores(profile.cpu.onlineCores);

            if (this.cpuCtrl.intelPstate.noTurbo.isAvailable() && this.cpuCtrl.intelPstate.noTurbo.isWritable()) {
                if (profile.cpu.noTurbo !== undefined) {
                    this.cpuCtrl.intelPstate.noTurbo.writeValue(profile.cpu.noTurbo);
                }
            }
        } catch (err) {
            this.tccd.logLine('CpuWorker: Failed to apply profile => ' + err);
        }
    }

    private setCpuDefaultConfig(): void {
        try {
            this.cpuCtrl.useCores();
            this.cpuCtrl.setGovernorScalingMinFrequency();
            this.cpuCtrl.setGovernorScalingMaxFrequency();
            this.cpuCtrl.setGovernor(this.findDefaultGovernor());
            if (!this.noEPPWriteQuirk) {
                this.cpuCtrl.setEnergyPerformancePreference('default');
            }
            if (this.cpuCtrl.intelPstate.noTurbo.isAvailable() && this.cpuCtrl.intelPstate.noTurbo.isWritable()) {
                this.cpuCtrl.intelPstate.noTurbo.writeValue(false);
            }
        } catch (err) {
            this.tccd.logLine('CpuWorker: Failed to set default cpu config => ' + err);
        }
    }

    private validateCpuFreq(): boolean {
        const profile = this.activeProfile;

        if (!profile.cpu.useMaxPerfGov) {
            // Note: Hard set governor to default (not included in profiles atm)
            profile.cpu.governor = this.findDefaultGovernor();
        }
        else {
            profile.cpu.governor = this.findPerformanceGovernor();
        }

        let cpuFreqValidConfig = true;

        // Check number of online cores
        this.cpuCtrl.getAvailableLogicalCores();
        if (this.cpuCtrl.online.isAvailable() && this.cpuCtrl.cores.length !== 0) {
            const currentOnlineCores = this.cpuCtrl.online.readValue();
            let onlineCoresProfile = profile.cpu.onlineCores;
            if (onlineCoresProfile === undefined) { onlineCoresProfile = this.cpuCtrl.cores.length; }
            if (currentOnlineCores.length !== onlineCoresProfile) {
                cpuFreqValidConfig = false;
                this.tccd.logLine('CpuWorker: onlineCores not as expected, '
                    + currentOnlineCores.length + ' instead of ' + onlineCoresProfile);
            }
        }

        let scalingDriver;
        // Check settings for each core
        for (const core of this.cpuCtrl.cores) {
            if (core.coreIndex !== 0 && !core.online.readValue()) {
                // Skip offline cores
                continue;
            }

            // Also Skip min/max freq validation on intel_pstate meanwhile bugged
            // ie scaling_max_freq readout does not stay at cpuinfo_max_freq
            if (profile.cpu.noTurbo !== true && this.cpuCtrl.cores[0].scalingDriver.readValueNT() !== 'intel_pstate') { // Only attempt to enforce frequencies if noTurbo isn't set
                scalingDriver = core.scalingDriver.readValueNT();
                const coreAvailableFrequencies = core.scalingAvailableFrequencies.readValueNT();
                const coreMinFreq = core.cpuinfoMinFreq.readValue();
                const coreMaxFreq = coreAvailableFrequencies !== undefined ? coreAvailableFrequencies[0] : core.cpuinfoMaxFreq.readValue();
                if (core.scalingMinFreq.isAvailable() && core.cpuinfoMinFreq.isAvailable()) {
                    const minFreq = core.scalingMinFreq.readValue();
                    let minFreqProfile = profile.cpu.scalingMinFrequency;
                    if (minFreqProfile === undefined || minFreqProfile < coreMinFreq) {
                        minFreqProfile = coreMinFreq;
                    } else if (minFreqProfile > coreMaxFreq || profile.cpu.useMaxPerfGov) {
                        minFreqProfile = coreMaxFreq;
                    }
                    if (minFreq !== minFreqProfile) {
                        cpuFreqValidConfig = false;
                        this.tccd.logLine('CpuWorker: Unexpected value core' + core.coreIndex + ' minimum scaling frequency '
                            + ' => ' + minFreq + ' instead of ' + minFreqProfile);
                    }
                }

                if (core.scalingMaxFreq.isAvailable() && core.cpuinfoMaxFreq.isAvailable()) {
                    const maxFreq = core.scalingMaxFreq.readValue();
                    let maxFreqProfile = profile.cpu.scalingMaxFrequency;
                    if (maxFreqProfile === -1) {
                        if (this.cpuCtrl.boost.isAvailable() && scalingDriver === ScalingDriver.acpi_cpufreq) {
                            maxFreqProfile = coreMaxFreq;
                        } else {
                            maxFreqProfile = core.getReducedAvailableFreq();
                        }
                    } else if (maxFreqProfile === undefined || maxFreqProfile > coreMaxFreq || profile.cpu.useMaxPerfGov) {
                        maxFreqProfile = coreMaxFreq;
                    } else if (maxFreqProfile < coreMinFreq) {
                        maxFreqProfile = coreMinFreq;
                    }
                    if (maxFreq !== maxFreqProfile) {
                        cpuFreqValidConfig = false;
                        this.tccd.logLine('CpuWorker: Unexpected value core' + core.coreIndex + ' maximum scaling frequency '
                            + ' => ' + maxFreq + ' instead of ' + maxFreqProfile);
                    }
                }
            }

            if (core.scalingGovernor.isAvailable() && core.scalingAvailableGovernors.isAvailable()) {
                const currentGovernor = core.scalingGovernor.readValue();
                const governorProfile = profile.cpu.governor;
                // Skip check if not set in profile
                if (governorProfile !== undefined) {
                    if (currentGovernor !== governorProfile) {
                        cpuFreqValidConfig = false;
                        this.tccd.logLine('CpuWorker: Unexpected value core' + core.coreIndex + ' scaling governor '
                            + ' => \'' + currentGovernor + '\' instead of \'' + governorProfile + '\'');
                    }
                }
            }

            if (core.energyPerformancePreference.isAvailable() && core.energyPerformanceAvailablePreferences.isAvailable()) {
                if (this.noEPPWriteQuirk) {
                    continue;
                }

                const currentPerformancePreference = core.energyPerformancePreference.readValue();
                let performancePreferenceProfile: string;
                if (!profile.cpu.useMaxPerfGov) {
                    performancePreferenceProfile = profile.cpu.energyPerformancePreference
                } else {
                    performancePreferenceProfile = "performance"
                }
                // Skip check if not set in profile or is 'default'
                // note: writing 'default' tends to set another string which is considered the default
                if (performancePreferenceProfile !== undefined && performancePreferenceProfile !== 'default') {
                    if (currentPerformancePreference !== performancePreferenceProfile) {
                        cpuFreqValidConfig = false;
                        this.tccd.logLine('CpuWorker: Unexpected value core' + core.coreIndex + ' energy performance preference => \''
                            + currentPerformancePreference + '\' instead of \'' + performancePreferenceProfile + '\'');
                    }
                }
            }
        }

        if (this.cpuCtrl.boost.isAvailable() && scalingDriver === ScalingDriver.acpi_cpufreq) {
            const currentBoost = this.cpuCtrl.boost.readValue()
            const coreMaxFreq = this.cpuCtrl.cores[0].cpuinfoMaxFreq.readValue();
            const availableFreqs = this.cpuCtrl.cores[0].scalingAvailableFrequencies.readValueNT();
            let maxSelectableFreq;
            if (availableFreqs !== undefined && availableFreqs.length > 0) {
                maxSelectableFreq = Math.max(...availableFreqs);
            }

            const maxFreqProfile = profile.cpu.scalingMaxFrequency;
            if (profile.cpu.useMaxPerfGov) {
                if (!currentBoost) {
                    cpuFreqValidConfig = false;
                    this.tccd.logLine('CpuWorker: Unexpected value boost => false instead of true');
                }
            }
            else {
                if ((maxFreqProfile === undefined || (maxSelectableFreq !== undefined && maxFreqProfile > maxSelectableFreq)) && !currentBoost) {
                    cpuFreqValidConfig = false;
                    this.tccd.logLine('CpuWorker: Unexpected value boost => false instead of true');
                }
                else if ((maxFreqProfile === -1 || (maxSelectableFreq !== undefined && maxFreqProfile <= maxSelectableFreq)) && currentBoost) {
                    cpuFreqValidConfig = false;
                    this.tccd.logLine('CpuWorker: Unexpected value boost => true instead of false');
                }
            }
        }

        if (this.cpuCtrl.intelPstate.noTurbo.isAvailable() && this.cpuCtrl.intelPstate.noTurbo.isWritable()) {
            const currentNoTurbo = this.cpuCtrl.intelPstate.noTurbo.readValue();
            const profileNoTurbo = profile.cpu.noTurbo;

            if (profileNoTurbo !== undefined) {
                if (currentNoTurbo !== profileNoTurbo) {
                    cpuFreqValidConfig = false;
                    this.tccd.logLine('CpuWorker: Unexpected value noTurbo => \''
                        + currentNoTurbo + '\' instead of \'' + profileNoTurbo + '\'');
                }
            }
        }

        return cpuFreqValidConfig;
    }
}
