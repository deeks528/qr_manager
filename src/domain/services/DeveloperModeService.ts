export interface TapResult {
  activated: boolean;
  isAlreadyActive: boolean;
  remainingSteps?: number;
  message?: string;
}

export class DeveloperModeService {
  public static readonly REQUIRED_TAPS = 7;
  public static readonly NOTIFICATION_THRESHOLD = 3; // Steps toast starts after 3 taps (i.e., at 4th tap)
  public static readonly TAP_TIMEOUT_MS = 2500;

  /**
   * Process a tap on the version number.
   * Activates developer mode on 7 rapid taps, displaying countdown toasts after 3 taps.
   */
  static handleTap(
    currentTapCount: number,
    lastTapTime: number,
    isAlreadyActive: boolean,
    now: number = Date.now()
  ): { nextCount: number; lastTapTime: number; result: TapResult } {
    if (isAlreadyActive) {
      return {
        nextCount: 0,
        lastTapTime: now,
        result: {
          activated: false,
          isAlreadyActive: true,
          message: 'Developer Mode is already active',
        },
      };
    }

    const isRapidTap = now - lastTapTime < this.TAP_TIMEOUT_MS;
    const nextCount = isRapidTap ? currentTapCount + 1 : 1;

    if (nextCount >= this.REQUIRED_TAPS) {
      return {
        nextCount: 0,
        lastTapTime: now,
        result: {
          activated: true,
          isAlreadyActive: false,
          message: 'You are now in Developer Mode!',
        },
      };
    }

    if (nextCount > this.NOTIFICATION_THRESHOLD) {
      const remaining = this.REQUIRED_TAPS - nextCount;
      return {
        nextCount,
        lastTapTime: now,
        result: {
          activated: false,
          isAlreadyActive: false,
          remainingSteps: remaining,
          message: `You are now ${remaining} step${remaining > 1 ? 's' : ''} away from being a developer.`,
        },
      };
    }

    return {
      nextCount,
      lastTapTime: now,
      result: {
        activated: false,
        isAlreadyActive: false,
      },
    };
  }
}
