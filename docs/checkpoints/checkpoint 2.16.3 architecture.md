# Checkpoint 2.16.3 Architecture: Functional Settings Integration

## 1. Objective
Transition the remaining placeholder settings in the "Visual Settings" and "Audio" menus into fully functional systems. This involves implementing the logic for global UI scaling and initializing the infrastructure for application-wide sound effects and volume control.

## 2. Functional Scope

### 2.1 Master Scaling Implementation
The "Master Scaling" segmented control will be wired to a reactive scaling system:
- **CSS Variable Injection**: The selected scale (0.8x, 1.0x, 1.2x) will update a `--master-scale` CSS variable on the `:root` element.
- **Fluid Layout Adjustment**: Primary layout dimensions, font sizes (via the `clamp` function), and tactile components (scroll thumbs, buttons) will utilize this variable to scale proportionally.
- **Canvas Scaling**: The `DotCloudCanvasRenderer` will listen for scaling changes to adjust its internal resolution and hit detection logic.

### 2.2 Audio Infrastructure (SFX Service)
Initial implementation of the `SoundEffectService` to handle the "Master Volume" and placeholder audio settings:
- **Audio Context Management**: Initialize a shared `AudioContext` for low-latency playback.
- **Volume Chaining**: Implement a `GainNode` hierarchy where individual sound categories (UI, Alerts, Music) are child nodes of the "Master Volume" gain node.
- **Placeholder Feedback**: Wiring the 7 audio placeholder rows to trigger distinct frequency "blips" or temporary assets to verify the toggle/slider connectivity.

## 3. Technical Strategy

### 3.1 `SoundEffectService.ts`
- **Singleton Pattern**: A centralized service to manage audio assets and volume state.
- **Persistence**: Volume settings will be persisted via `LocalStorage` or `IndexedDB`, similar to `VisualSettingsService`.
- **Pre-loading**: Implement an asset manifest to pre-load essential UI sound effects (clicks, hover-scroll ticks).

### 3.2 Setting Wiring
- **`SettingsSectionRenderer` Updates**: Remove placeholder `onChange` handlers and replace them with calls to the respective services (`visualSettingsService.updateScale`, `soundEffectService.setMasterVolume`).
- **Reactive State**: Ensure that changing a setting in one part of the UI (e.g., Master Volume notch) immediately reflects in the service's state and any active audio nodes.

## 4. Component Refinements

### 4.1 `VisualSettingsService.ts`
- Extend the `VisualSettings` interface to include `masterScale: number`.
- Add validation logic to ensure the scale remains within the supported [0.8, 1.2] range.

### 4.2 `SettingsUiFactory.ts`
- Ensure the `updateTrackVisuals` logic remains performant when called by rapid slider movements from functional components.

## 5. Verification Plan
- [ ] Select "0.8x" and "1.2x" in Master Scaling and verify all UI elements (fonts, cards, buttons) resize accordingly.
- [ ] Move the Master Volume slider and verify (via console/audio output) that the gain level of the audio system changes.
- [ ] Click or interact with the audio placeholder rows and verify that a test sound is triggered.
- [ ] Refresh the page and verify that both Scale and Volume settings persist.
