# Raw Output - Project Roadmap

This roadmap outlines the development phases for **Raw Output**. Each checkpoint is a commit-sized unit of work with a **verifiable, user-observable outcome**.

---

## Phase 1: The Core Engine (Foundation & Monitoring)
**Focus**: Establishing the technical bedrock and the "Zero Manual Effort" promise.

### Checkpoint 1.1: Project Initialization (Done)
- **Deliverable**: A configured Vite + TypeScript environment.
- **Commit Goal**: Running `npm run dev` serves a page displaying the "Raw Output" title and a "Ready" status.

### Checkpoint 1.2: Folder Picker Connectivity (Done)
- **Deliverable**: File System Access API integration.
- **Commit Goal**: Clicking a "Link Stats Folder" button opens the native OS folder picker and displays the selected folder's name on the UI.

### Checkpoint 1.3: Session Persistence (Done)
- **Deliverable**: IndexedDB folder handle storage.
- **Commit Goal**: Refreshing the page automatically attempts to re-verify the folder link, displaying "Re-connected to: [FolderName]" without re-opening the picker.

### Checkpoint 1.4: Recent Runs UI (Done)
- **Deliverable**: Dashboard list component.
- **Commit Goal**: A "Recent Runs" panel appears in the UI with a premium layout (Scenario, Score, Date), ready for data ingestion.

### Checkpoint 1.5: Static CSV Parsing (Done)
- **Deliverable**: Kovaak's CSV extractor & Folder Scanner.
- **Commit Goal**: Clicking "Import CSVs" scans the linked folder for `.csv` files and populates the "Recent Runs" list with the top 10 most recent entries.

### Checkpoint 1.6: Deep Directory Discovery (Done)
- **Deliverable**: Path normalization logic.
- **Commit Goal**: If a user selects a top-level Kovaak's folder, the app automatically finds and targets the internal `stats` directory.

### Checkpoint 1.7: Real-time File Ingestion (Done)
- **Deliverable**: Directory monitoring loop.
- **Commit Goal**: Dropping a new CSV into the linked folder automatically adds a new entry to the "Recent Runs" list without a page refresh.

---

## Phase 2: Benchmark Table
**Focus**: Creating a centralized, interactive hub for viewing benchmark scenarios and analyzing performance distributions.

### Checkpoint 2.1: Benchmark Filtering (Done)
- **Deliverable**: Benchmark CSV parsing and difficulty association.
- **Commit Goal**: The system successfully parses `benchmarks/*.csv` files and maps scenarios to their respective difficulties (Easier, Medium, Hard).

### Checkpoint 2.2: Benchmark View & Data Loading (Done)
- **Deliverable**: Navigation UI, Extended BenchmarkService, and Base Table.
- **Commit Goal**: Users can navigate between "Recent Runs" and "Benchmarks". The Benchmarks view displays a table of scenarios for the selected difficulty.

### Checkpoint 2.3: Benchmark Categories & Layout (Done)
- **Deliverable**: CSV Metadata Extraction & Categorized UI.
- **Commit Goal**: The `extract_ranks.cjs` script preserves category/subcategory data, and the Benchmark UI displays these as vertical labels on the left side of the table.

### Checkpoint 2.4: Rank Tags (Done)
- **Deliverable**: Rank Calculation Logic & UI Badges.
- **Commit Goal**: The benchmark table displays a "Rank" column. Each row shows a badge with the calculated rank and progress percentage (e.g., `[Jade + 50%]`) based on the scenario's specific thresholds.

### Checkpoint 2.5: Scenario Launch Interactions (Done)
- **Deliverable**: Actionable row interactions.
- **Commit Goal**: Each row in the benchmark table includes a "Play" action. Clicking it launches Kovaaks with the corresponding scenario name.

### Checkpoint 2.6: Live Session Best (Done)
- **Deliverable**: Session-specific highscore tracking.
- **Commit Goal**: The system tracks the best score for each scenario achieved during the current active session, separate from all-time highs.

### Checkpoint 2.7: New Runs View (Done)
- **Deliverable**: Live performance dashboard.
- **Commit Goal**: A "New Runs" view automatically displays scenarios as they are played, highlighting improvements against the current session best.

### Checkpoint 2.8: Visualization & Fluid Typography (Done)
- **Deliverable**: Micro-chart visualization (Strip Plot) and Global CSS fluid typography.
- **Commit Goal**: 
  1. A new visual column renders a "Dot Cloud" for each scenario, plotting the last 100 recorded scores as semi-transparent dots.
  2. Font sizes scale smoothly using the `clamp()` function based on screen resolution, ensuring legibility from 1080p to 4K.

### Checkpoint 2.8.1: Dot Cloud Vertical Alignment Refinement (Done)
- **Deliverable**: Refined vertical positioning logic for performance dots.
- **Commit Goal**: Dots are centered within the vertical span of rank notches, improving visual alignment and clarity across resolutions.

### Checkpoint 2.9: Visual Settings Placeholder (Done)
- **Deliverable**: Configuration UI shell.
- **Commit Goal**: A "Visual Settings" menu or toolbar is added to the table interface. It contains the structure for view toggles but does not yet impact the charts.

### Checkpoint 2.10: Visual Settings Wiring (Done)
- **Deliverable**: Reactivity and State Management for visualizations.
- **Commit Goal**: The "Visual Settings" controls are fully wired up, allowing the user to adjust visual parameters in real-time.

### Checkpoint 2.11: Session Interval Settings (Done)
- **Deliverable**: Configurable session timeout logic.
- **Commit Goal**: A setting is added to define the session inactivity interval. The UI avoids showing session stats for the last played session if that session is no longer active based on this interval.

### Checkpoint 2.11.1: Reactive Session Expiration (Done)
- **Deliverable**: Automated session reset timer.
- **Commit Goal**: The UI automatically refreshes and clears session-specific data when the session timeout is reached, without requiring a manual page refresh or settings change.

### Checkpoint 2.12: Inter-session Behaviour (Done)
- **Deliverable**: Consistent app behaviour between sessions.
- **Commit Goal**: Page is retained through app restarts, including settings and popups. All settings are persistent. 

### Checkpoint 2.13: Visual & Tactile Identity (Done)
- **Deliverable**: Distinct visual identity and micro-interactions.
- **Commit Goal**: The application's visual identity and interactions are distinctive, featuring a unique color palette, spacing, and subtle animations that move away from generic glassmorphism.

### Checkpoint 2.13.1: Background Dynamics (Done)
- **Deliverable**: Dynamic background dot grid with ripple effects.
- **Commit Goal**: A dot grid background (10rem spacing, grey dots) is added, featuring transparency ripples and background blur interaction with the benchmark cards.

### Checkpoint 2.13.2: Scroll Track Cut-out (Done)
- **Deliverable**: Custom scroll track with glass cut-out and fixed-height tactile thumb.
- **Commit Goal**: The benchmark table features a stationary glass background with a rounded "cut-out" for the scroll track and a 2rem tactile scroll thumb with hover-to-scroll logic.

### Checkpoint 2.14: SFX Identity
- **Deliverable**: Sound effects for relevant interactions.
- **Commit Goal**: The application is no longer fully quiet; it sounds distinctive and has a sound bank that subjectively matches the theme.

### Checkpoint 2.15: Milestone - Code Consolidation & Debt Payoff
- **Deliverable**: Refactored codebase and consolidated logic.
- **Commit Goal**: The codebase is cleaned, redundant logic is removed, and architecture is hardened to ensure stability before proceeding to Phase 3.

---

## Phase 3: Ranked Runs
**Focus**: Building the active "Session Mode" where users perform their runs with real-time feedback, directed flow, and immersive visual/audio feedback.

### Checkpoint 3.1: Ranked Session Layout
- **Deliverable**: Vertical UI Shell.
- **Commit Goal**: Navigating to "Ranked Session" displays the basic structure of the Ranked Run screen with three vertical zones (Past, Present, Future), populated with placeholder/dummy data.

### Checkpoint 3.2: Scenario Selection Logic
- **Deliverable**: Strong-Weak-Weak Algorithm.
- **Commit Goal**: The "Ranked Session" now uses real history data to populate the Past, Present, and Future zones using the Strong-Weak-Weak algorithm instead of dummy data.

### Checkpoint 3.3: Target Bar Component
- **Deliverable**: Visualization Component.
- **Commit Goal**: A dedicated React component that renders a target line and a score spread bar, capable of receiving a "target" and "current spread" as props (demonstrated in isolation or with static props).

### Checkpoint 3.4: HUD Integration
- **Deliverable**: Centering Logic & Data Wiring.
- **Commit Goal**: The Target Bar is integrated into the "Present" zone of the layout. It mathematically centers the view on the specific Score Target for the active scenario.

### Checkpoint 3.5: Visual System Unification & Theme
- **Deliverable**: Design Token System / Global CSS.
- **Commit Goal**: The application's color palette, typography, and spacing are unified under a distinct, custom visual theme (not generic UI libraries), verifiable across all existing pages.

### Checkpoint 3.6: Scenario Transitions
- **Deliverable**: View Transition Logic.
- **Commit Goal**: Switching between scenarios in the Ranked Session (e.g., finishing "Present" and moving it to "Past") triggers a smooth, coordinated animation rather than an instant snap.

### Checkpoint 3.7: Live Feedback Loop
- **Deliverable**: Real-time score ingestion and state reactivity.
- **Commit Goal**: When a new CSV is detected for the active scenario:
  1. "Session Peak" updates.
  2. If Peak < Target: Display is neutral.
  3. If Peak >= Target: Display becomes vibrant; "Next" button activates.

### Checkpoint 3.8: Rank Estimator
- **Deliverable**: "Current Estimate" display component.
- **Commit Goal**: 
  1. A component displays the "Current Estimated Rank" below the scenario.
  2. Achieving a new peak triggers a promotion animation.

### Checkpoint 3.9: Audio Feedback
- **Deliverable**: Sound Manager System.
- **Commit Goal**: Distinct, satisfying sound effects play for key events: Rank Up, New Highscore, and Session Completion.

### Checkpoint 3.10: Infinite Progression
- **Deliverable**: Session extension logic.
- **Commit Goal**: On the final scenario, the "Next" button becomes "One More". Clicking it triggers the selection algorithm to append a new batch of scenarios to the active session.

---

## Phase 4: Focus-Based Dynamics
**Focus**: Enhancing the "juice" and responsiveness of the HUD based on user focus and performance milestones.

### Checkpoint 4.1: Dynamic Rank Indicator
- **Deliverable**: Animated HUD Element.
- **Commit Goal**: The "Current Rank" indicator physically moves or morphs on the screen in response to score changes.

### Checkpoint 4.2: Window Focus Awareness
- **Deliverable**: Focus management logic.
- **Commit Goal**: High-impact UI feedback and animations are paused or deferred if the browser tab/window loses focus, ensuring the user is present for key milestones.

### Checkpoint 4.3: Focus-Delayed Animations
- **Deliverable**: Window-focus event handling for animations.
- **Commit Goal**: When the window regains focus, animations wait for a short, configurable delay before playing, ensuring the user is ready to perceive the feedback.

### Checkpoint 4.4: Rank Up Ceremony
- **Deliverable**: Full-screen Overlay/Animation.
- **Commit Goal**: Achieving a new peak rank triggers a high-impact "Rank Up" animation sequence that takes over the visual hierarchy.

### Checkpoint 4.5: Infinite Progression Polish
- **Deliverable**: "One More" Transitions.
- **Commit Goal**: Triggering the "One More" infinite loop plays a seamless animation and sound effect as new scenarios are dealt into the queue.

---

## Phase 5: Ecosystem & Analytics
**Focus**: Seasons, data analysis, and community integration.

### Checkpoint 5.1: Ranked Seasons Core
- **Deliverable**: Versioning Logic (SemVer for Seasons).
- **Commit Goal**: The app displays the current Season Version (e.g., "Ranked 1.1"). It loads benchmark data specific to that version (allowing for future rebalances).

### Checkpoint 5.2: Season Timer
- **Deliverable**: Countdown UI.
- **Commit Goal**: A UI element displays the number of days remaining in the current ranked season based on the configuration.

### Checkpoint 5.3: Data Opt-in
- **Deliverable**: Privacy Settings & API Client.
- **Commit Goal**: A "Submit Anonymous Rank Data" toggle is added to settings. Enabling it sends a verification payload to the backend.

### Checkpoint 5.4: Warm-up Analysis
- **Deliverable**: Performance Analytics View.
- **Commit Goal**: A new analytics view compares early session attempts ("Warm-up") against peak performance, helping users identify their warm-up duration.