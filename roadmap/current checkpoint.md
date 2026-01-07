```raw_output\roadmap\current checkpoint.md#L1-15
# Current Checkpoint: 2.11.1: Reactive Session Expiration

## Status
Completed

## Deliverables
- Automated session reset timer.
- UI synchronization on session timeout.
- Support for session re-acquisition when increasing intervals.

## Summary
The `SessionService` now manages an internal reactive timer that notifies UI listeners exactly when a session expires. To support re-acquisition, session data is preserved until a new run explicitly starts a fresh session, allowing the UI to "re-acquire" and display session bests if the user increases the inactivity threshold.

## Next Up
Checkpoint 2.12: Inter-session Behaviour
