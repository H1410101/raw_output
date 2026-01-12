# Checkpoint 3 Architecture - Internal Test Suite

## Overview
This checkpoint establishes a robust, browser-based internal testing infrastructure to verify the core behavioral and geometric integrity of the Raw Output application. It transitions the project from ad-hoc verification to a systematic, hierarchical assertion model based on the `Master Behavior Document`.

## Testing Infrastructure
- **Framework**: Vitest 4.x in browser mode.
- **Provider**: Playwright (Chromium).
- **Tooling**: `@testing-library/dom` for interaction, `getBoundingClientRect` for pixel-perfect layout math.
- **Identity System**: Strict dot-notation (e.g., `header.nav.ext.symmetry`) ensuring direct traceability to requirements.

## Verified Layers

### 1. Data Layer (`data.conn.int`)
- **Discovery**: Verification of `DirectoryAccessService` automatic suffix appending (`/Kovaaks/ExternalData/stats`).
- **Persistence**: Verification of IndexedDB handle storage and automatic reconnection.

### 2. Session Layer (`session.logic.int`)
- **Persistence**: Reactive expiration and re-acquisition logic.
- **Non-Destructive Expiration**: Refactored `SessionService` to preserve session data upon expiration to support re-acquisition via timeout increases.

### 3. Header & Shell (`header.*`)
- **Grid Layout**: Verification of `1fr auto 1fr` header distribution.
- **Symmetry**: Mathematical proof of equidistant navigation buttons.
- **Alignment**: Pixel-level horizontal alignment between the application title and the dashboard glass.

### 4. Dashboard & Sensory (`ui.*`)
- **Scrollbar Symmetry**: Precise spacing verification for the custom scroll trench (`Dist(Row.Right, Hole.Left) === Dist(Hole.Right, Panel.Right)`).
- **Audio Throttling**: Centralized anti-spam logic in `AudioService` enforcing a 40ms silence interval.

## Refactor Summary
- **AudioService**: Moved 40ms throttling from `BenchmarkScrollController` to `AudioService.playSound` to ensure global compliance.
- **SessionService**: Replaced `resetSession()` with `_notifySessionUpdate()` in expiration timers to prevent data loss.
