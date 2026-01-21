/**
 * Enum representing the detected device category.
 */
export enum DeviceCategory {
  MOBILE = "MOBILE",
  SUSPICIOUS = "SUSPICIOUS",
  DESKTOP = "DESKTOP",
}

/**
 * Service responsible for detecting the device type and environment.
 * Helps in determining if the user should see the mobile landing page or a warning.
 */
export class DeviceDetectionService {
  /**
   * Determine the device category based on User Agent and screen metrics.
   *
   * @returns The detected device category.
   */
  public getDetectedCategory(): DeviceCategory {
    const userAgent: string = navigator.userAgent || "";

    if (this._isConfirmedMobileUA(userAgent)) {
      return DeviceCategory.MOBILE;
    }

    if (this._isSuspiciousMobile(userAgent)) {
      return DeviceCategory.SUSPICIOUS;
    }

    return DeviceCategory.DESKTOP;
  }

  private _isConfirmedMobileUA(userAgent: string): boolean {
    const mobileUaPattern: RegExp = /Android|iPhone|iPod|Opera Mini|IEMobile|WPDesktop/i;

    const isMobileUa: boolean = mobileUaPattern.test(userAgent);

    const isSmallScreen: boolean = window.innerWidth <= 480;

    return isMobileUa || isSmallScreen;
  }

  private _isSuspiciousMobile(userAgent: string): boolean {
    const suspiciousUaPattern: RegExp = /iPad|PlayBook|Silk/i;

    const isSuspiciousUa: boolean = suspiciousUaPattern.test(userAgent);

    const isMediumScreen: boolean = window.innerWidth > 480 && window.innerWidth <= 1024;

    const hasTouch: boolean = "ontouchstart" in window || navigator.maxTouchPoints > 0;

    return isSuspiciousUa || (isMediumScreen && hasTouch);
  }
}
