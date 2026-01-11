# Checkpoint 2.19: SFX Identity

## Objective
Implement a comprehensive sound effect system to enhance the tactical and premium feel of the application. This involves establishing an `AudioService` and integrating specific auditory feedback for key UI interactions.

## Architecture Changes

### Audio Management System
- **`AudioService.ts`**: Introduced a centralized service for sound playback.
    - Implements semantic methods `playLight()` and `playHeavy()` to decouple file paths from component logic.
    - Uses `HTMLAudioElement` cloning for polyphonic playback (allowing multiple instances of the same sound).
    - Synchronizes master volume with `VisualSettingsService`.
    - Caches audio elements to reduce latency and redundant network requests.

### Tactical Interactions
- **Launch Button**: 
    - Hold sound (`rxSound11.ogg`) pulses at **25Hz (0.04s)** during hold-to-confirm.
    - Impact sound (`kick-deep.ogg`) triggers on successful scenario launch.
- **Scrollbars**:
    - Integrated "light" hitsounds into the custom `BenchmarkScrollController`.
    - Implemented a **0.04s throttle** for hover-scroll sounds to maintain auditory clarity during high-speed movement.
    - Movement detection threshold was lowered to ensure consistency on short lists (e.g., Settings menu).

### Global UI Feedback
- **Buttons & Links**: All `<button>` and `<a>` elements trigger a "heavy" impact sound via a global listener in `AppBootstrap`.
- **Title Interaction**: The main application title features an exclusive "light" hover sound and a "heavy" click sound.
- **Popups**: Closing the **About** or **Visual Settings** popups triggers a "heavy" confirmation sound.
- **Settings Sliders**: Implemented synchronized "wave" sounds for slider DOT transitions, where hit sounds are delayed to match visual ripple timing.

### Structural Refinement
- **Dependency DI**: Refactored multiple controllers (`BenchmarkScrollController`, `BenchmarkSettingsController`, etc.) to use a **Dependency Object** pattern. This ensures compliance with the **4-parameter limit** (linting) while making the architecture more modular and testable.

## Progress Summary
- [x] Integrated `AudioService` into `AppBootstrap` and passed it through to relevant sub-controllers.
- [x] Established semantic sound categories (Light: `rxSound11.ogg` / Heavy: `kick-deep.ogg`).
- [x] Implemented throttled hover-scroll audio for all custom scrollbars.
- [x] Added global click sounds for all buttons, links, and the application title.
- [x] Synchronized slider "wave" SFX with CSS transition timings.
- [x] Linked audio volume to the master volume slider in Visual Settings.
- [x] Cleaned up audio settings placeholders.
- [x] Ensured zero lint errors across modified services and components.
