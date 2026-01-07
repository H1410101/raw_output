```raw_output\docs\checkpoints\phase 2\checkpoint 2.11.1 architecture.md#L1-43
# Checkpoint 2.11.1: Reactive Session Expiration & Re-acquisition Architecture

The goal of this checkpoint is to ensure the UI remains in sync with the session state without requiring user interaction, while also supporting "Session Re-acquisition". A session is re-acquired if a user increases the session interval such that the previously "expired" last run now falls within the new window.

## 1. Session Service Enhancements

The `SessionService` will be updated to manage an internal timer and maintain session state even when technically "inactive," until a new session is explicitly started by a fresh run.

### Reactive Timer Logic
- **Timer Management**: A private `_expiration_timer_id` will be maintained.
- **Notification over Reset**: When the timer fires, it will not call `resetSession()`. Instead, it will trigger `_notifySessionUpdate()`. This allows the UI to re-evaluate `is_session_active()` and hide session-specific data while preserving the data in memory.
- **Dynamic Scheduling**: Every time `_lastRunTimestamp` is updated or `SessionSettings` change, the service recalculates the time remaining.

### Support for Re-acquisition
- **Data Preservation**: Session bests and the `_lastRunTimestamp` are preserved even after the timeout interval has passed. 
- **State Evaluation**: `is_session_active()` remains the source of truth for whether the session data should be displayed.
- **Re-activation**: If the user increases the `sessionTimeoutMinutes`, `_schedule_expiration_check` is called. If the `_lastRunTimestamp` is now within the new interval, the session becomes "active" again, and a new expiration timer is scheduled.

## 2. UI Synchronization

The `BenchmarkView` (and other components) subscribe to `SessionService` updates.
- **Visibility Logic**: UI components use `is_session_active()` to decide whether to render "Session Best" badges or other session-relative metrics.
- **Automatic Transitions**: When the timer fires, the notification triggers a re-render. `is_session_active()` returns `false`, and the UI "releases" the session view (hides badges).
- **Interactive Transitions**: When settings change, the notification triggers a re-render. If the session is now active due to an interval increase, the UI "re-acquires" the session view (shows badges).

## 3. Data Flow

1. **Inactivity Timeout**:
   - `setTimeout` callback executes.
   - `SessionService` calls `_notifySessionUpdate()`.
   - `BenchmarkView` re-renders; `is_session_active()` is `false` -> badges hidden.

2. **Session Re-acquisition**:
   - User increases session interval in `VisualSettings`.
   - `SessionSettingsService` notifies `SessionService`.
   - `SessionService` updates `_sessionTimeoutMilliseconds` and calls `_schedule_expiration_check()`.
   - New `delay` is calculated. If `delay > 0`, a new timer is set and `_notifySessionUpdate()` is called.
   - `BenchmarkView` re-renders; `is_session_active()` is now `true` -> badges reappearing with previous session data.

3. **True Reset**:
   - `RunIngestionService` -> `SessionService.registerRun()`.
   - `SessionService` checks `_isSessionExpired(newTimestamp)`.
   - If `true`, `resetSession()` is called, clearing all maps and the timestamp.
   - New run data is then registered as the start of a brand new session.
