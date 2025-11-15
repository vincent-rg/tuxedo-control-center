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
import 'jasmine';
const mock = require('mock-fs');

import { CpuWorker } from './CpuWorker';
import { TuxedoControlCenterDaemon } from './TuxedoControlCenterDaemon';
import { IStaticCpuInfo, IRuntimeCpuInfo } from '../../common/models/TccCpuInfo';

describe('CpuWorker CPU Info Collection', () => {

    let cpuWorker: CpuWorker;
    let mockTccd: any;

    // Mock a 4-CPU system (2 cores with hyperthreading)
    beforeEach(() => {
        // Create mock TuxedoControlCenterDaemon
        mockTccd = {
            logLine: jasmine.createSpy('logLine'),
            identifyDevice: jasmine.createSpy('identifyDevice').and.returnValue('mock-device'),
            settings: { cpuSettingsEnabled: true },
            dbusData: {
                staticCpuInfoJSON: '',
                runtimeCpuInfoJSON: ''
            }
        };

        // Mock sysfs structure for a 4-CPU system
        mock({
            '/sys/devices/system/cpu': {
                'possible': '0-3',
                'present': '0-3',
                'online': '0-2',  // System-wide online list (CPU 3 is offline)
                'offline': '3',   // System-wide offline list
                'cpu0': {
                    'online': mock.file({ content: '1', mode: 0o444 }), // cpu0 always online (but file may exist)
                    'cpufreq': {
                        'cpuinfo_min_freq': '400000',
                        'cpuinfo_max_freq': '4500000',
                        'scaling_available_frequencies': '4500000 4000000 3500000 3000000 2500000 2000000 1500000 1000000 500000 400000',
                        'scaling_available_governors': 'performance powersave',
                        'scaling_cur_freq': '2400000',
                        'scaling_min_freq': '400000',
                        'scaling_max_freq': '4500000',
                        'scaling_governor': 'powersave',
                        'scaling_driver': 'intel_pstate',
                        'energy_performance_available_preferences': 'default performance balance_performance balance_power power',
                        'energy_performance_preference': 'balance_performance'
                    },
                    'topology': {
                        'core_id': '0',
                        'thread_siblings_list': '0,2',
                        'core_siblings_list': '0-3'
                    }
                },
                'cpu1': {
                    'online': '1',
                    'cpufreq': {
                        'cpuinfo_min_freq': '400000',
                        'cpuinfo_max_freq': '4500000',
                        'scaling_available_frequencies': '4500000 4000000 3500000 3000000 2500000 2000000 1500000 1000000 500000 400000',
                        'scaling_available_governors': 'performance powersave',
                        'scaling_cur_freq': '1800000',
                        'scaling_min_freq': '400000',
                        'scaling_max_freq': '4500000',
                        'scaling_governor': 'powersave',
                        'scaling_driver': 'intel_pstate',
                        'energy_performance_available_preferences': 'default performance balance_performance balance_power power',
                        'energy_performance_preference': 'balance_performance'
                    },
                    'topology': {
                        'core_id': '1',
                        'thread_siblings_list': '1,3',
                        'core_siblings_list': '0-3'
                    }
                },
                'cpu2': {
                    'online': '1',
                    'cpufreq': {
                        'cpuinfo_min_freq': '400000',
                        'cpuinfo_max_freq': '4500000',
                        'scaling_available_frequencies': '4500000 4000000 3500000 3000000 2500000 2000000 1500000 1000000 500000 400000',
                        'scaling_available_governors': 'performance powersave',
                        'scaling_cur_freq': '3200000',
                        'scaling_min_freq': '400000',
                        'scaling_max_freq': '4500000',
                        'scaling_governor': 'powersave',
                        'scaling_driver': 'intel_pstate',
                        'energy_performance_available_preferences': 'default performance balance_performance balance_power power',
                        'energy_performance_preference': 'balance_performance'
                    },
                    'topology': {
                        'core_id': '0',
                        'thread_siblings_list': '0,2',
                        'core_siblings_list': '0-3'
                    }
                },
                'cpu3': {
                    'online': '0',  // CPU 3 is offline
                    'cpufreq': {
                        'cpuinfo_min_freq': '400000',
                        'cpuinfo_max_freq': '4500000',
                        'scaling_available_frequencies': '4500000 4000000 3500000 3000000 2500000 2000000 1500000 1000000 500000 400000',
                        'scaling_available_governors': 'performance powersave',
                        'scaling_cur_freq': '400000',  // Low freq when offline
                        'scaling_min_freq': '400000',
                        'scaling_max_freq': '4500000',
                        'scaling_governor': 'powersave',
                        'scaling_driver': 'intel_pstate',
                        'energy_performance_available_preferences': 'default performance balance_performance balance_power power',
                        'energy_performance_preference': 'power'
                    },
                    'topology': {
                        'core_id': '1',
                        'thread_siblings_list': '1,3',
                        'core_siblings_list': '0-3'
                    }
                },
                'cpufreq': {
                    'boost': '0'
                },
                'intel_pstate': {
                    'no_turbo': '0'
                }
            }
        });

        cpuWorker = new CpuWorker(mockTccd as TuxedoControlCenterDaemon);
    });

    afterEach(() => {
        mock.restore();
    });

    describe('collectStaticCpuInfo()', () => {
        it('should collect static info from all online CPUs', () => {
            // Access the private method via type assertion
            const staticInfo: IStaticCpuInfo = (cpuWorker as any).collectStaticCpuInfo();

            expect(staticInfo).toBeDefined();
            expect(staticInfo.totalCpus).toBe(4);
            // Should only have 3 CPUs in the array (cpu3 is offline and skipped)
            expect(staticInfo.cpus.length).toBe(3);
        });

        it('should include correct hardware limits for CPU 0', () => {
            const staticInfo: IStaticCpuInfo = (cpuWorker as any).collectStaticCpuInfo();
            const cpu0 = staticInfo.cpus.find(cpu => cpu.cpuId === 0);

            expect(cpu0).toBeDefined();
            expect(cpu0.cpuinfoMinFreq).toBe(400000);
            expect(cpu0.cpuinfoMaxFreq).toBe(4500000);
        });

        it('should include available governors', () => {
            const staticInfo: IStaticCpuInfo = (cpuWorker as any).collectStaticCpuInfo();
            const cpu0 = staticInfo.cpus.find(cpu => cpu.cpuId === 0);

            expect(cpu0.scalingAvailableGovernors).toEqual(['performance', 'powersave']);
        });

        it('should include available frequencies', () => {
            const staticInfo: IStaticCpuInfo = (cpuWorker as any).collectStaticCpuInfo();
            const cpu0 = staticInfo.cpus.find(cpu => cpu.cpuId === 0);

            expect(cpu0.scalingAvailableFrequencies).toBeDefined();
            expect(cpu0.scalingAvailableFrequencies.length).toBeGreaterThan(0);
            expect(cpu0.scalingAvailableFrequencies[0]).toBe(4500000);
        });

        it('should include energy performance preferences', () => {
            const staticInfo: IStaticCpuInfo = (cpuWorker as any).collectStaticCpuInfo();
            const cpu0 = staticInfo.cpus.find(cpu => cpu.cpuId === 0);

            expect(cpu0.energyPerformanceAvailablePreferences).toEqual([
                'default', 'performance', 'balance_performance', 'balance_power', 'power'
            ]);
        });

        it('should include topology information', () => {
            const staticInfo: IStaticCpuInfo = (cpuWorker as any).collectStaticCpuInfo();
            const cpu0 = staticInfo.cpus.find(cpu => cpu.cpuId === 0);

            expect(cpu0.coreId).toBe(0);
            expect(cpu0.threadSiblingsList).toEqual([0, 2]);
        });

        it('should skip offline CPUs with warning log', () => {
            const staticInfo: IStaticCpuInfo = (cpuWorker as any).collectStaticCpuInfo();
            const cpu3 = staticInfo.cpus.find(cpu => cpu.cpuId === 3);

            // CPU 3 is offline, should not be in the array
            expect(cpu3).toBeUndefined();
            // Should have logged a warning
            expect(mockTccd.logLine).toHaveBeenCalledWith(
                jasmine.stringContaining('Skipping offline CPU 3')
            );
        });
    });

    describe('collectRuntimeCpuInfo()', () => {
        it('should collect runtime info for all CPUs', () => {
            const runtimeInfo: IRuntimeCpuInfo = (cpuWorker as any).collectRuntimeCpuInfo();

            expect(runtimeInfo).toBeDefined();
            expect(runtimeInfo.cpus.length).toBe(4);
            expect(runtimeInfo.timestamp).toBeGreaterThan(0);
        });

        it('should include current frequencies for online CPUs', () => {
            const runtimeInfo: IRuntimeCpuInfo = (cpuWorker as any).collectRuntimeCpuInfo();
            const cpu0 = runtimeInfo.cpus.find(cpu => cpu.cpuId === 0);

            expect(cpu0).toBeDefined();
            expect(cpu0.online).toBe(true);
            expect(cpu0.scalingCurFreq).toBe(2400000);
            expect(cpu0.scalingMinFreq).toBe(400000);
            expect(cpu0.scalingMaxFreq).toBe(4500000);
        });

        it('should include governor for online CPUs', () => {
            const runtimeInfo: IRuntimeCpuInfo = (cpuWorker as any).collectRuntimeCpuInfo();
            const cpu0 = runtimeInfo.cpus.find(cpu => cpu.cpuId === 0);

            expect(cpu0.scalingGovernor).toBe('powersave');
            expect(cpu0.energyPerformancePreference).toBe('balance_performance');
        });

        it('should mark offline CPUs with null values', () => {
            const runtimeInfo: IRuntimeCpuInfo = (cpuWorker as any).collectRuntimeCpuInfo();
            const cpu3 = runtimeInfo.cpus.find(cpu => cpu.cpuId === 3);

            expect(cpu3).toBeDefined();
            expect(cpu3.online).toBe(false);
            expect(cpu3.scalingCurFreq).toBeNull();
            expect(cpu3.scalingMinFreq).toBeNull();
            expect(cpu3.scalingMaxFreq).toBeNull();
            expect(cpu3.scalingGovernor).toBeNull();
            expect(cpu3.energyPerformancePreference).toBeNull();
        });

        it('should include global boost and noTurbo flags', () => {
            const runtimeInfo: IRuntimeCpuInfo = (cpuWorker as any).collectRuntimeCpuInfo();

            expect(runtimeInfo.boost).toBe(false);
            expect(runtimeInfo.noTurbo).toBe(false);
        });

        it('should have different frequencies for different CPUs', () => {
            const runtimeInfo: IRuntimeCpuInfo = (cpuWorker as any).collectRuntimeCpuInfo();
            const cpu0 = runtimeInfo.cpus.find(cpu => cpu.cpuId === 0);
            const cpu1 = runtimeInfo.cpus.find(cpu => cpu.cpuId === 1);
            const cpu2 = runtimeInfo.cpus.find(cpu => cpu.cpuId === 2);

            expect(cpu0.scalingCurFreq).toBe(2400000);
            expect(cpu1.scalingCurFreq).toBe(1800000);
            expect(cpu2.scalingCurFreq).toBe(3200000);
        });

        it('should include timestamp in milliseconds', () => {
            const beforeTimestamp = Date.now();
            const runtimeInfo: IRuntimeCpuInfo = (cpuWorker as any).collectRuntimeCpuInfo();
            const afterTimestamp = Date.now();

            expect(runtimeInfo.timestamp).toBeGreaterThanOrEqual(beforeTimestamp);
            expect(runtimeInfo.timestamp).toBeLessThanOrEqual(afterTimestamp);
        });
    });

    describe('onStart() integration', () => {
        it('should cache static CPU info and expose via D-Bus data', () => {
            cpuWorker.onStart();

            expect(mockTccd.dbusData.staticCpuInfoJSON).toBeTruthy();

            const parsedData: IStaticCpuInfo = JSON.parse(mockTccd.dbusData.staticCpuInfoJSON);
            expect(parsedData.totalCpus).toBe(4);
            expect(parsedData.cpus.length).toBe(4); // All 4 CPUs (temporarily onlined during collection)
        });

        it('should log successful static info collection', () => {
            cpuWorker.onStart();

            expect(mockTccd.logLine).toHaveBeenCalledWith(
                jasmine.stringContaining('Cached static CPU info for 4 CPUs')
            );
        });
    });

    describe('onWork() integration', () => {
        it('should expose runtime CPU info via D-Bus data', () => {
            cpuWorker.onWork();

            expect(mockTccd.dbusData.runtimeCpuInfoJSON).toBeTruthy();

            const parsedData: IRuntimeCpuInfo = JSON.parse(mockTccd.dbusData.runtimeCpuInfoJSON);
            expect(parsedData.cpus.length).toBe(4);
            expect(parsedData.timestamp).toBeGreaterThan(0);
        });

        it('should update runtime info with fresh data', () => {
            cpuWorker.onWork();
            const firstTimestamp = JSON.parse(mockTccd.dbusData.runtimeCpuInfoJSON).timestamp;

            // Simulate time passing
            jasmine.clock().install();
            jasmine.clock().tick(100);

            cpuWorker.onWork();
            const secondTimestamp = JSON.parse(mockTccd.dbusData.runtimeCpuInfoJSON).timestamp;

            expect(secondTimestamp).toBeGreaterThanOrEqual(firstTimestamp);
            jasmine.clock().uninstall();
        });
    });

    describe('CPU online state save/restore', () => {
        it('should save current online state', () => {
            const savedState = (cpuWorker as any).saveAndOnlineAllCpus();

            // Should return array of currently online CPU indices
            expect(savedState).toBeDefined();
            expect(Array.isArray(savedState)).toBe(true);
            // CPUs 0, 1, 2 are online (CPU 3 is offline in mock)
            expect(savedState).toContain(0);
            expect(savedState).toContain(1);
            expect(savedState).toContain(2);
            expect(savedState).not.toContain(3);
        });

        it('should online all CPUs during save operation', () => {
            (cpuWorker as any).saveAndOnlineAllCpus();

            // After save operation, CPU 3 should be onlined
            // Read the mock filesystem to verify
            const fs = require('fs');
            const cpu3OnlineState = fs.readFileSync('/sys/devices/system/cpu/cpu3/online', 'utf8');
            expect(cpu3OnlineState.trim()).toBe('1');
        });

        it('should log save and online operations', () => {
            (cpuWorker as any).saveAndOnlineAllCpus();

            expect(mockTccd.logLine).toHaveBeenCalledWith(
                jasmine.stringContaining('Saved online state')
            );
            expect(mockTccd.logLine).toHaveBeenCalledWith(
                jasmine.stringContaining('Temporarily onlining all CPUs')
            );
        });

        it('should restore CPUs to previous online state', () => {
            const fs = require('fs');

            // Save state: CPUs 0,1,2 online, CPU 3 offline
            const savedState = (cpuWorker as any).saveAndOnlineAllCpus();

            // Now all CPUs are online
            expect(fs.readFileSync('/sys/devices/system/cpu/cpu3/online', 'utf8').trim()).toBe('1');

            // Restore to previous state
            (cpuWorker as any).restoreCpuOnlineState(savedState);

            // CPU 3 should be offline again
            expect(fs.readFileSync('/sys/devices/system/cpu/cpu3/online', 'utf8').trim()).toBe('0');
        });

        it('should restore CPUs to online if they were online before', () => {
            const fs = require('fs');

            // Manually offline CPU 1
            fs.writeFileSync('/sys/devices/system/cpu/cpu1/online', '0');

            // Save state with CPU 1 offline
            const savedState = (cpuWorker as any).saveAndOnlineAllCpus();

            // Now all CPUs are online
            expect(fs.readFileSync('/sys/devices/system/cpu/cpu1/online', 'utf8').trim()).toBe('1');

            // Manually offline CPU 1 again
            fs.writeFileSync('/sys/devices/system/cpu/cpu1/online', '0');

            // Restore should bring CPU 1 back online (because it was in savedState)
            (cpuWorker as any).restoreCpuOnlineState(savedState);

            expect(fs.readFileSync('/sys/devices/system/cpu/cpu1/online', 'utf8').trim()).toBe('1');
        });

        it('should log restoration operations', () => {
            const savedState = [0, 1, 2]; // CPUs 0,1,2 should be online

            (cpuWorker as any).restoreCpuOnlineState(savedState);

            expect(mockTccd.logLine).toHaveBeenCalledWith(
                jasmine.stringContaining('Restoring previous online state')
            );
            expect(mockTccd.logLine).toHaveBeenCalledWith(
                jasmine.stringContaining('CPU online state restoration complete')
            );
        });

        it('should handle empty saved state gracefully', () => {
            (cpuWorker as any).restoreCpuOnlineState([]);

            expect(mockTccd.logLine).toHaveBeenCalledWith(
                jasmine.stringContaining('No saved state to restore')
            );
        });
    });

    describe('onStart() with offline CPUs', () => {
        it('should collect static info from all CPUs including initially offline ones', () => {
            // CPU 3 starts offline in the mock
            cpuWorker.onStart();

            const parsedData: IStaticCpuInfo = JSON.parse(mockTccd.dbusData.staticCpuInfoJSON);

            // After onlining all CPUs during collection, we should have data for all 4
            expect(parsedData.totalCpus).toBe(4);
            expect(parsedData.cpus.length).toBe(4); // All CPUs now included

            // Verify CPU 3 data is present
            const cpu3 = parsedData.cpus.find(cpu => cpu.cpuId === 3);
            expect(cpu3).toBeDefined();
        });

        it('should restore offline CPUs after collection', () => {
            const fs = require('fs');

            // Disable CPU profile application to test pure save/restore
            mockTccd.settings.cpuSettingsEnabled = false;

            // CPU 3 starts offline
            expect(fs.readFileSync('/sys/devices/system/cpu/cpu3/online', 'utf8').trim()).toBe('0');

            cpuWorker.onStart();

            // After onStart completes, CPU 3 should be offline again
            expect(fs.readFileSync('/sys/devices/system/cpu/cpu3/online', 'utf8').trim()).toBe('0');
        });

        it('should log the complete save/restore flow', () => {
            cpuWorker.onStart();

            // Should log saving state
            expect(mockTccd.logLine).toHaveBeenCalledWith(
                jasmine.stringContaining('Saved online state')
            );

            // Should log onlining CPUs
            expect(mockTccd.logLine).toHaveBeenCalledWith(
                jasmine.stringContaining('Temporarily onlining all CPUs')
            );

            // Should log successful collection
            expect(mockTccd.logLine).toHaveBeenCalledWith(
                jasmine.stringContaining('Cached static CPU info for 4 CPUs')
            );

            // Should log restoration
            expect(mockTccd.logLine).toHaveBeenCalledWith(
                jasmine.stringContaining('Restoring previous online state')
            );
        });

        it('should restore state even if collection fails', () => {
            const fs = require('fs');

            // Disable CPU profile application to test pure save/restore
            mockTccd.settings.cpuSettingsEnabled = false;

            // Corrupt the mock to cause collection to fail
            fs.writeFileSync('/sys/devices/system/cpu/cpu0/cpufreq/cpuinfo_min_freq', 'INVALID');

            // CPU 3 starts offline
            expect(fs.readFileSync('/sys/devices/system/cpu/cpu3/online', 'utf8').trim()).toBe('0');

            cpuWorker.onStart();

            // Even though collection failed, CPU 3 should be restored to offline
            expect(fs.readFileSync('/sys/devices/system/cpu/cpu3/online', 'utf8').trim()).toBe('0');
        });
    });

    describe('JSON serialization', () => {
        it('should produce valid JSON for static CPU info', () => {
            cpuWorker.onStart();

            expect(() => {
                JSON.parse(mockTccd.dbusData.staticCpuInfoJSON);
            }).not.toThrow();
        });

        it('should produce valid JSON for runtime CPU info', () => {
            cpuWorker.onWork();

            expect(() => {
                JSON.parse(mockTccd.dbusData.runtimeCpuInfoJSON);
            }).not.toThrow();
        });

        it('should have correct structure in static JSON', () => {
            cpuWorker.onStart();
            const data = JSON.parse(mockTccd.dbusData.staticCpuInfoJSON);

            expect(data).toEqual(jasmine.objectContaining({
                totalCpus: jasmine.any(Number),
                cpus: jasmine.any(Array)
            }));

            expect(data.cpus[0]).toEqual(jasmine.objectContaining({
                cpuId: jasmine.any(Number),
                cpuinfoMinFreq: jasmine.any(Number),
                cpuinfoMaxFreq: jasmine.any(Number),
                scalingAvailableGovernors: jasmine.any(Array),
                energyPerformanceAvailablePreferences: jasmine.any(Array),
                coreId: jasmine.any(Number),
                threadSiblingsList: jasmine.any(Array)
            }));
        });

        it('should have correct structure in runtime JSON', () => {
            cpuWorker.onWork();
            const data = JSON.parse(mockTccd.dbusData.runtimeCpuInfoJSON);

            expect(data).toEqual(jasmine.objectContaining({
                timestamp: jasmine.any(Number),
                cpus: jasmine.any(Array),
                boost: jasmine.any(Boolean),
                noTurbo: jasmine.any(Boolean)
            }));

            // Check online CPU structure
            const onlineCpu = data.cpus.find(cpu => cpu.online === true);
            expect(onlineCpu).toEqual(jasmine.objectContaining({
                cpuId: jasmine.any(Number),
                online: true,
                scalingCurFreq: jasmine.any(Number),
                scalingMinFreq: jasmine.any(Number),
                scalingMaxFreq: jasmine.any(Number),
                scalingGovernor: jasmine.any(String),
                energyPerformancePreference: jasmine.any(String)
            }));

            // Check offline CPU structure
            const offlineCpu = data.cpus.find(cpu => cpu.online === false);
            expect(offlineCpu).toEqual(jasmine.objectContaining({
                cpuId: jasmine.any(Number),
                online: false,
                scalingCurFreq: null,
                scalingMinFreq: null,
                scalingMaxFreq: null,
                scalingGovernor: null,
                energyPerformancePreference: null
            }));
        });
    });
});
