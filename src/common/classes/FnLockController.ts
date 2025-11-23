import { SysFsPropertyBoolean } from "./SysFsProperties";
import { PathConfig } from "./PathConfig";

export class FnLockController {
    fnLock = new SysFsPropertyBoolean(PathConfig.SYS_TUXEDO_KEYBOARD_FN_LOCK);

    getFnLockSupported = () => this.fnLock.isAvailable();

    getFnLockStatus = () => this.fnLock.readValueNT();

    setFnLockStatus = (status: boolean) => this.fnLock.writeValue(status);
}