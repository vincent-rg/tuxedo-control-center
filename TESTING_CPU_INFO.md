# Testing CPU Info Collection

This document describes how to manually test the CPU information collection feature added to TCC daemon.

## Overview

The CPU info collection feature exposes CPU hardware information and runtime state through the D-Bus interface. The data is split into two categories:

- **Static CPU Info**: Hardware limits and topology (cached once on daemon startup)
- **Runtime CPU Info**: Current frequencies, online status, and governor settings (updated every work cycle)

## Feature Components

### 1. Data Structures
Located in `src/common/models/TccCpuInfo.ts`:
- `IStaticCpuInfo`: Container for static CPU information
- `IStaticCpuData`: Per-CPU static data (hardware limits, topology)
- `IRuntimeCpuInfo`: Container for runtime CPU information
- `IRuntimeCpuData`: Per-CPU runtime data (current state)

### 2. D-Bus Interface
The daemon exposes two new methods via D-Bus:
- `GetStaticCpuInfoJSON()`: Returns static CPU info as JSON string
- `GetRuntimeCpuInfoJSON()`: Returns runtime CPU info as JSON string

### 3. Debug File Dump (Optional)
When enabled, the daemon writes CPU info to `/tmp/tccd/`:
- `static_cpu_info.json`: Written once on daemon start
- `runtime_cpu_info.json`: Updated every work cycle (~10 seconds)

### 4. CPU Onlining During Static Info Collection
**Important behavioral note:**

During daemon startup (`onStart()`), the CpuWorker temporarily onlines ALL CPUs to collect complete static hardware information, then restores their previous online state:

1. **Save**: Current online state is saved (e.g., CPUs 0,1,2 online, CPU 3 offline)
2. **Online**: All CPUs are brought online temporarily (CPUs 0,1,2,3 all online)
3. **Stabilize**: 100ms delay to let CPUs stabilize
4. **Collect**: Static info is collected from ALL CPUs
5. **Restore**: Previous online state is restored (CPU 3 goes back offline)

**Why this is necessary:**
- Hardware limits and topology can only be read from online CPUs
- Without onlining, static data would be incomplete for offline CPUs
- Per-core configuration requires knowing limits for ALL CPUs, not just currently online ones

**Impact:**
- Static CPU info will include ALL CPUs, even those that were offline at daemon start
- Very brief (~100ms) period where all CPUs are online during daemon startup
- Original online state is always restored via try-finally (even if collection fails)
- You'll see log messages: "Temporarily onlining all CPUs" and "Restoring previous online state"

## Enabling Debug File Dump

To enable debug file output:

1. Open `src/service-app/classes/CpuWorker.ts`
2. Find the `ENABLE_DEBUG_FILES` constant (around line 41)
3. Change it from `false` to `true`:
   ```typescript
   private readonly ENABLE_DEBUG_FILES: boolean = true;
   ```
4. Rebuild and restart the daemon (see instructions below)

**Important**: Remember to set it back to `false` before committing production code!

## Testing Procedure

### Prerequisites

1. Development environment set up (see README.md)
2. Daemon service configured for development

### Step 1: Enable Debug Output

1. Edit `src/service-app/classes/CpuWorker.ts`
2. Set `ENABLE_DEBUG_FILES = true`
3. Rebuild:
   ```bash
   npm run build
   ```

### Step 2: Restart the Daemon

```bash
sudo systemctl restart tccd
```

### Step 3: Verify Debug Files Are Created

Check that debug files exist:
```bash
ls -lh /tmp/tccd/
```

Expected output:
```
-rw-r--r-- 1 root root  2.1K Nov 15 10:30 static_cpu_info.json
-rw-r--r-- 1 root root  1.8K Nov 15 10:30 runtime_cpu_info.json
```

### Step 4: Examine Static CPU Info

View the static CPU info:
```bash
cat /tmp/tccd/static_cpu_info.json | python3 -m json.tool
```

Expected structure:
```json
{
  "totalCpus": 16,
  "cpus": [
    {
      "cpuId": 0,
      "cpuinfoMinFreq": 400000,
      "cpuinfoMaxFreq": 4500000,
      "scalingAvailableFrequencies": null,
      "scalingAvailableGovernors": ["performance", "powersave"],
      "energyPerformanceAvailablePreferences": ["default", "performance", "balance_performance", "balance_power", "power"],
      "coreId": 0,
      "threadSiblingsList": [0, 8],
      "coreSiblingsList": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
    },
    ...
  ]
}
```

Verify:
- `totalCpus` matches your system's logical CPU count
- Each online CPU has an entry with its hardware limits
- Frequency values are in Hz (e.g., 4500000 = 4.5 GHz)
- Topology data is correct (siblings, core IDs)

### Step 5: Examine Runtime CPU Info

View the runtime CPU info:
```bash
cat /tmp/tccd/runtime_cpu_info.json | python3 -m json.tool
```

Expected structure:
```json
{
  "timestamp": 1731665432123,
  "cpus": [
    {
      "cpuId": 0,
      "online": true,
      "scalingCurFreq": 2400000,
      "scalingMinFreq": 400000,
      "scalingMaxFreq": 4500000,
      "scalingGovernor": "powersave",
      "energyPerformancePreference": "balance_performance"
    },
    {
      "cpuId": 1,
      "online": false,
      "scalingCurFreq": null,
      "scalingMinFreq": null,
      "scalingMaxFreq": null,
      "scalingGovernor": null,
      "energyPerformancePreference": null
    },
    ...
  ],
  "boost": false,
  "noTurbo": false
}
```

Verify:
- `timestamp` is recent (milliseconds since epoch)
- Online CPUs have all fields populated
- Offline CPUs have `online: false` and all other fields as `null`
- Global `boost` and `noTurbo` flags match system state

### Step 6: Monitor Runtime Updates

Watch the runtime file update in real-time:
```bash
watch -n 1 'stat -c "%y" /tmp/tccd/runtime_cpu_info.json'
```

The file should update approximately every 10 seconds (daemon work cycle interval).

### Step 7: Test D-Bus Interface Directly

Query the D-Bus methods directly using `dbus-send`:

**Get Static CPU Info:**
```bash
dbus-send --system --print-reply \
  --dest=com.tuxedocomputers.tccd \
  /com/tuxedocomputers/tccd \
  com.tuxedocomputers.tccd.GetStaticCpuInfoJSON
```

**Get Runtime CPU Info:**
```bash
dbus-send --system --print-reply \
  --dest=com.tuxedocomputers.tccd \
  /com/tuxedocomputers/tccd \
  com.tuxedocomputers.tccd.GetRuntimeCpuInfoJSON
```

Both should return JSON strings matching the debug file contents.

### Step 8: Test with CPU Offlining

Test that offline CPUs are handled correctly in both static and runtime info:

#### Test 8a: Runtime Info with Offline CPU

1. Disable a CPU (example: CPU 1):
   ```bash
   echo 0 | sudo tee /sys/devices/system/cpu/cpu1/online
   ```

2. Wait 10+ seconds for runtime info update

3. Check runtime CPU info:
   ```bash
   cat /tmp/tccd/runtime_cpu_info.json | python3 -m json.tool | grep -A 8 '"cpuId": 1'
   ```

   Expected result: CPU 1 should show `online: false` with all other fields as `null`

4. Re-enable the CPU:
   ```bash
   echo 1 | sudo tee /sys/devices/system/cpu/cpu1/online
   ```

5. Verify it shows as online again after ~10 seconds

#### Test 8b: Static Info with Initially Offline CPU

1. Disable a CPU before daemon start (example: CPU 2):
   ```bash
   echo 0 | sudo tee /sys/devices/system/cpu/cpu2/online
   ```

2. Restart the daemon:
   ```bash
   sudo systemctl restart tccd
   ```

3. Check static CPU info:
   ```bash
   cat /tmp/tccd/static_cpu_info.json | python3 -m json.tool | grep -c '"cpuId"'
   ```

   Expected result: Should show all CPUs (e.g., 16 on a 16-CPU system)

4. Verify CPU 2 data is present:
   ```bash
   cat /tmp/tccd/static_cpu_info.json | python3 -m json.tool | grep -A 10 '"cpuId": 2'
   ```

   Expected result: CPU 2 hardware limits and topology should be present

5. Verify CPU 2 is still offline after daemon start:
   ```bash
   cat /sys/devices/system/cpu/cpu2/online
   ```

   Expected result: `0` (daemon restored the offline state)

6. Re-enable CPU 2:
   ```bash
   echo 1 | sudo tee /sys/devices/system/cpu/cpu2/online
   ```

**Note**: CPU 0 cannot be disabled on most systems.

### Step 9: Check Daemon Logs

View daemon logs for any errors:
```bash
sudo journalctl -u tccd -f
```

Look for:
- `CpuWorker: Saved online state: [...]` - shows which CPUs were online before collection
- `CpuWorker: Temporarily onlining all CPUs for static info collection` - onlining phase
- `CpuWorker: Brought CPU N online` - for each offline CPU that was onlined
- `CpuWorker: Cached static CPU info for N CPUs` - successful collection with all CPUs
- `CpuWorker: Restoring previous online state: [...]` - restoration phase
- `CpuWorker: Restored CPU N to offline` - for each CPU restored to offline state
- `CpuWorker: CPU online state restoration complete` - completion
- No error messages related to CPU info collection

### Step 10: Verify Data Consistency

Compare data from multiple sources:

1. **Static min/max frequencies** should match sysfs:
   ```bash
   cat /sys/devices/system/cpu/cpu0/cpufreq/cpuinfo_min_freq
   cat /sys/devices/system/cpu/cpu0/cpufreq/cpuinfo_max_freq
   ```

2. **Runtime current frequency** should match sysfs:
   ```bash
   cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq
   ```

3. **Available governors** should match sysfs:
   ```bash
   cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_available_governors
   ```

4. **Topology data** should match:
   ```bash
   cat /sys/devices/system/cpu/cpu0/topology/core_id
   cat /sys/devices/system/cpu/cpu0/topology/thread_siblings_list
   ```

## Expected Behavior

### Static CPU Info
- ✅ Collected once on daemon startup
- ✅ **Includes ALL CPUs** (temporarily onlined if needed)
- ✅ Cached in memory (no repeated sysfs reads)
- ✅ Exposed via D-Bus `GetStaticCpuInfoJSON()`
- ✅ Written to `/tmp/tccd/static_cpu_info.json` if debug enabled
- ✅ Data never changes during daemon lifetime
- ✅ Original CPU online state is restored after collection

### Runtime CPU Info
- ✅ Collected every work cycle (~10 seconds)
- ✅ Not cached (always fresh data)
- ✅ Exposed via D-Bus `GetRuntimeCpuInfoJSON()`
- ✅ Written to `/tmp/tccd/runtime_cpu_info.json` if debug enabled
- ✅ Offline CPUs return null values
- ✅ Online CPUs return current state
- ✅ Includes timestamp and global boost/turbo flags

## Common Issues

### Debug Files Not Created
- **Cause**: `ENABLE_DEBUG_FILES` is `false`
- **Solution**: Set to `true`, rebuild, and restart daemon

### "Permission Denied" on /tmp/tccd/
- **Cause**: Daemon runs as root, directory owned by root
- **Solution**: Use `sudo` to access files, or change directory permissions

### All CPUs Temporarily Online During Daemon Start
- **Expected behavior**: Daemon temporarily onlines all CPUs to collect static info
- **Impact**: Very brief moment where all CPUs are online, then restored to previous state
- **Logs**: You'll see "Temporarily onlining all CPUs" and "Restoring previous online state"

### Runtime Info Timestamp Not Updating
- **Cause**: Daemon work cycle not running
- **Solution**: Check daemon logs for errors; verify daemon is running

## Cleanup

After testing, remember to:

1. Disable debug output:
   ```typescript
   private readonly ENABLE_DEBUG_FILES: boolean = false;
   ```

2. Rebuild:
   ```bash
   npm run build
   ```

3. Restart daemon:
   ```bash
   sudo systemctl restart tccd
   ```

4. Remove debug files (optional):
   ```bash
   sudo rm -rf /tmp/tccd/
   ```

## Next Steps

After verifying the CPU info collection works correctly:

1. Frontend integration (read data from D-Bus instead of sysfs)
2. Per-core CPU configuration UI
3. Profile extension for per-core settings
4. Additional unit tests for edge cases
