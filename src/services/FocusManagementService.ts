/**
 * Represents the reason why a specific scenario was focused.
 */
export type FocusReason = "NEW_SCORE";

/**
 * State representing the currently focused scenario and the reason for it.
 */
export interface FocusState {
  /** The unique name of the scenario. */
  readonly scenarioName: string;
  /** The reason why this scenario is being focused. */
  readonly reason: FocusReason;
}

/**
 * Callback function for focus state change notifications.
 */
export type FocusListener = (state: FocusState) => void;

/**
 * Service responsible for managing the "active" or "focused" scenario within the application.
 */
export class FocusManagementService {
  private _currentState: FocusState | null = null;

  private readonly _listeners: FocusListener[] = [];

  /**
   * Retrieves the currently focused scenario state.
   *
   * @returns The focus state or null if none is focused.
   */
  public getFocusState(): FocusState | null {
    return this._currentState;
  }

  /**
   * Updates the focus state and notifies all registered listeners.
   *
   * @param scenarioName - The name of the scenario to focus.
   * @param reason - The reason for the focus transition.
   */
  public focusScenario(scenarioName: string, reason: FocusReason): void {
    const newState: FocusState = {
      scenarioName,
      reason,
    };

    this._currentState = newState;

    this._notifyListeners(newState);
  }

  /**
   * Registers a listener to be notified when the focus state changes.
   *
   * @param listener - The callback function to invoke.
   */
  public subscribe(listener: FocusListener): void {
    this._listeners.push(listener);
  }

  /**
   * Resets the current focus state.
   */
  public clearFocus(): void {
    this._currentState = null;
  }

  private _notifyListeners(state: FocusState): void {
    this._listeners.forEach((listener: FocusListener): void => {
      listener(state);
    });
  }
}
