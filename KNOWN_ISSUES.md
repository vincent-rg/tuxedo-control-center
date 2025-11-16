# Known Issues

This file tracks known problems and limitations that need to be addressed in future work.

## Angular Test Infrastructure - Browser Tests Cannot Run

**Status**: Open
**Severity**: Medium
**Discovered**: 2025-11-16

**Problem**:
Angular browser-based tests (Karma/Jasmine) cannot run due to architectural dependency issues. The Angular GUI services depend on `TccDBusController` which imports `dbus-next` (a Node.js module). This creates transitive dependencies affecting 20+ component tests.

**Affected Components**:
- Any component or service that imports `TccDBusClientService` (directly or transitively)
- Examples: `state.service`, `config.service`, `webcam-settings`, and many others

**Root Cause**:
The application architecture mixes browser code (Angular) with Node.js code (D-Bus IPC, filesystem access). Webpack cannot bundle Node.js built-in modules (`child_process`, `fs`, `path`, `dbus-next`) for browser environment.

**Failed Compilation Chain Example**:
```
component.spec.ts
  → component.ts
    → some.service.ts
      → TccDBusClientService
        → TccDBusController
          → dbus-next (Node.js module) ❌
```

**Workarounds**:
1. Manual testing of Angular components in Electron environment
2. Unit test pure functions/logic in isolation (backend tests work fine)
3. Rename problematic spec files to `.skip.ts` to exclude them

**Potential Solutions** (for future work):
1. **Create browser-compatible mocks**: Provide stub/mock implementations of Node.js services for test environment
2. **Dependency injection refactor**: Use abstract interfaces and inject different implementations for browser vs Electron
3. **Split test suites**: Browser-only tests vs Electron integration tests
4. **Webpack polyfills**: Configure custom webpack build with node polyfills (limited effectiveness for actual IPC/filesystem)

**Impact**:
- Cannot run Angular unit tests via `npm run test-ng`
- Test code can still be written and reviewed, just not executed
- Backend tests (`npm run test-service-app`, `npm run test-common`) work fine

**Related Work**:
- Commit `7d66590b`: Added comprehensive tests for CPU dashboard frequency calculation (syntactically correct, cannot run due to this issue)

---

## Template for New Issues

```markdown
## Issue Title

**Status**: Open | In Progress | Blocked
**Severity**: Low | Medium | High | Critical
**Discovered**: YYYY-MM-DD

**Problem**:
Brief description of the issue

**Root Cause**:
What causes this problem

**Workarounds**:
Temporary solutions if any

**Potential Solutions**:
Ideas for permanent fixes

**Impact**:
Who/what is affected
```
