import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { CpuDashboardComponent } from './cpu-dashboard.component';
import { IRuntimeCpuInfo, IRuntimeCpuData } from 'src/common/models/TccCpuInfo';

describe('CpuDashboardComponent', () => {
  let component: CpuDashboardComponent;
  let fixture: ComponentFixture<CpuDashboardComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ CpuDashboardComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(CpuDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('updateFrequencyData', () => {
    it('should calculate average frequency correctly when all CPUs are online', () => {
      // Arrange: 4 CPUs all online with different frequencies
      const mockRuntimeInfo: IRuntimeCpuInfo = {
        timestamp: Date.now(),
        cpus: [
          { cpuId: 0, online: true, scalingCurFreq: 2000000, scalingMinFreq: 800000, scalingMaxFreq: 3500000, scalingGovernor: 'powersave', energyPerformancePreference: 'balance_performance' },
          { cpuId: 1, online: true, scalingCurFreq: 2500000, scalingMinFreq: 800000, scalingMaxFreq: 3500000, scalingGovernor: 'powersave', energyPerformancePreference: 'balance_performance' },
          { cpuId: 2, online: true, scalingCurFreq: 3000000, scalingMinFreq: 800000, scalingMaxFreq: 3500000, scalingGovernor: 'powersave', energyPerformancePreference: 'balance_performance' },
          { cpuId: 3, online: true, scalingCurFreq: 2500000, scalingMinFreq: 800000, scalingMaxFreq: 3500000, scalingGovernor: 'powersave', energyPerformancePreference: 'balance_performance' }
        ],
        boost: false,
        noTurbo: false
      };

      component.runtimeCpuInfo = mockRuntimeInfo;

      // Act
      component['updateFrequencyData']();

      // Assert: (2000000 + 2500000 + 3000000 + 2500000) / 4 = 2500000
      expect(component.avgCpuFreq).toBe(2500000);
    });

    it('should calculate average frequency using only online CPUs when some are offline', () => {
      // Arrange: 4 CPUs, 2 online and 2 offline
      const mockRuntimeInfo: IRuntimeCpuInfo = {
        timestamp: Date.now(),
        cpus: [
          { cpuId: 0, online: true, scalingCurFreq: 2000000, scalingMinFreq: 800000, scalingMaxFreq: 3500000, scalingGovernor: 'powersave', energyPerformancePreference: 'balance_performance' },
          { cpuId: 1, online: true, scalingCurFreq: 3000000, scalingMinFreq: 800000, scalingMaxFreq: 3500000, scalingGovernor: 'powersave', energyPerformancePreference: 'balance_performance' },
          { cpuId: 2, online: false, scalingCurFreq: null, scalingMinFreq: null, scalingMaxFreq: null, scalingGovernor: null, energyPerformancePreference: null },
          { cpuId: 3, online: false, scalingCurFreq: null, scalingMinFreq: null, scalingMaxFreq: null, scalingGovernor: null, energyPerformancePreference: null }
        ],
        boost: false,
        noTurbo: false
      };

      component.runtimeCpuInfo = mockRuntimeInfo;

      // Act
      component['updateFrequencyData']();

      // Assert: Should be (2000000 + 3000000) / 2 = 2500000, NOT (2000000 + 3000000 + 0 + 0) / 4 = 1250000
      expect(component.avgCpuFreq).toBe(2500000);
    });

    it('should return 0 when all CPUs are offline', () => {
      // Arrange: All CPUs offline
      const mockRuntimeInfo: IRuntimeCpuInfo = {
        timestamp: Date.now(),
        cpus: [
          { cpuId: 0, online: false, scalingCurFreq: null, scalingMinFreq: null, scalingMaxFreq: null, scalingGovernor: null, energyPerformancePreference: null },
          { cpuId: 1, online: false, scalingCurFreq: null, scalingMinFreq: null, scalingMaxFreq: null, scalingGovernor: null, energyPerformancePreference: null },
          { cpuId: 2, online: false, scalingCurFreq: null, scalingMinFreq: null, scalingMaxFreq: null, scalingGovernor: null, energyPerformancePreference: null },
          { cpuId: 3, online: false, scalingCurFreq: null, scalingMinFreq: null, scalingMaxFreq: null, scalingGovernor: null, energyPerformancePreference: null }
        ],
        boost: false,
        noTurbo: false
      };

      component.runtimeCpuInfo = mockRuntimeInfo;

      // Act
      component['updateFrequencyData']();

      // Assert: Should be 0 when no CPUs are online
      expect(component.avgCpuFreq).toBe(0);
    });

    it('should treat null frequencies as 0 for online CPUs', () => {
      // Arrange: Online CPU with null frequency (edge case)
      const mockRuntimeInfo: IRuntimeCpuInfo = {
        timestamp: Date.now(),
        cpus: [
          { cpuId: 0, online: true, scalingCurFreq: 2000000, scalingMinFreq: 800000, scalingMaxFreq: 3500000, scalingGovernor: 'powersave', energyPerformancePreference: 'balance_performance' },
          { cpuId: 1, online: true, scalingCurFreq: null, scalingMinFreq: 800000, scalingMaxFreq: 3500000, scalingGovernor: 'powersave', energyPerformancePreference: 'balance_performance' }
        ],
        boost: false,
        noTurbo: false
      };

      component.runtimeCpuInfo = mockRuntimeInfo;

      // Act
      component['updateFrequencyData']();

      // Assert: (2000000 + 0) / 2 = 1000000
      expect(component.avgCpuFreq).toBe(1000000);
    });

    it('should handle undefined runtimeCpuInfo gracefully', () => {
      // Arrange
      component.runtimeCpuInfo = undefined;

      // Act
      component['updateFrequencyData']();

      // Assert: Should not crash, avgCpuFreq remains unchanged
      expect(component.avgCpuFreq).toBeUndefined();
    });

    it('should handle runtimeCpuInfo with no cpus array gracefully', () => {
      // Arrange
      component.runtimeCpuInfo = {
        timestamp: Date.now(),
        cpus: null,
        boost: false,
        noTurbo: false
      };

      // Act
      component['updateFrequencyData']();

      // Assert: Should not crash
      expect(component.avgCpuFreq).toBeUndefined();
    });
  });
});
