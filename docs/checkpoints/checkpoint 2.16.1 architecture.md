# Checkpoint 2.16.1 Architecture: Settings Cleanup & Refinement

## 1. Objective
Refine the user interface and settings logic to improve clarity and tactile feedback. This includes renaming key visual settings, reorganizing the settings layout, and enhancing the behavior and feedback of slider controls.

## 2. Setting Renames & Structural Changes
To better align with the application's terminology and user mental models, the following settings will be renamed and moved:

- **"Highlight Recent"** -> **"Highlight Latest Run"**
  - Moved from the general "Visualization" section into the "Dot Cloud" group.
  - Logic update: It will now only highlight the latest run if it occurred within the current active session.
- **"Show Grid Lines"** -> **"Show Rank Notches"**
  - Renamed for technical accuracy regarding what is actually being rendered on the Canvas.
- **"Show Rank Badges"** -> **"Show All-Time Best"**
  - Renamed to emphasize the data source (all-time history).

## 3. Tactile Slider Enhancements
The `SettingsUiFactory` and its slider implementation will be updated to provide more precise control and better visual feedback:

### 3.1 Zero-Notch Interaction
- Clicking the "notch" (the vertical bar at the start of certain sliders, like Master Volume) will set the value to exactly **0%**.
- When a notch is present, the first dot in the track will represent the first value **above 0%** (e.g., 10% for volume), ensuring the notch is the exclusive way to reach absolute zero.

### 3.2 Dynamic Value Display
- Sliders will now display their exact current value (e.g., "75%", "15 min") in the label or a sub-label.
- The value text will utilize the `lower-band-3` color variable (`#5485AB`) to remain legible but secondary to the primary label.

## 4. Technical Implementation Details

### 4.1 History Data Enrichment
- `HistoryService.getLastScores` will be updated to return an array of objects containing both the `score` and its `timestamp`, rather than just raw numbers.
- This allows the `DotCloudComponent` to filter and identify which dots belong to the current session by comparing timestamps with the `SessionService` state.

### 4.2 Visual Settings Service
- The `VisualSettings` interface will be updated to reflect the new property names (where internal keys need to change for consistency) and default values.
- Migrations or default value overrides will ensure existing user sessions aren't broken by property renames.

### 4.3 Component Updates
- `SettingsSectionRenderer`: Will be reorganized to place "Highlight Latest Run" inside the Dot Cloud sub-rows.
- `DotCloudCanvasRenderer`: Will update its highlight logic to check the session status of the latest score.
- `SettingsUiFactory`: Will receive updates to `createSlider` and `_createDotTrack` to handle the new notch logic and value display.

## 5. Verification Plan
- [ ] Open settings and verify all renames are applied.
- [ ] Verify "Highlight Latest Run" is nested under "Dot Cloud".
- [ ] Play a scenario and verify the latest dot is highlighted only while the session is active.
- [ ] Click the notch on Master Volume and verify it sets to 0%.
- [ ] Verify slider values (%, min) update in real-time with `lower-band-3` styling.
