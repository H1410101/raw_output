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

### Checkpoint 1.4: Recent Runs UI
- **Deliverable**: Dashboard list component.
- **Commit Goal**: A "Recent Runs" panel appears in the UI with placeholder entries showing the intended premium layout (Scenario, Score, Date).

### Checkpoint 1.5: Static CSV Parsing
- **Deliverable**: Kovaak's CSV extractor.
- **Commit Goal**: Manually selecting a single `.csv` file via the UI populates the "Recent Runs" list with real data from that file.

### Checkpoint 1.6: Deep Directory Discovery
- **Deliverable**: Path normalization logic.
- **Commit Goal**: If a user selects a top-level Kovaak's folder, the app automatically finds and targets the internal `stats` directory.

### Checkpoint 1.7: Real-time File Ingestion
- **Deliverable**: Directory monitoring loop.
- **Commit Goal**: Dropping a new CSV into the linked folder automatically adds a new entry to the "Recent Runs" list without a page refresh.

---

## Phase 2: Domain Intelligence (Benchmark Logic & Results)
**Focus**: Integrating Viscose Benchmark rules and score validation.

### Checkpoint 2.1: Scenario Identification
- **Deliverable**: Viscose Benchmark lookup table.
- **Commit Goal**: Parsed runs are visually tagged as either "Benchmark" or "Custom" based on the official Viscose scenario list.

### Checkpoint 2.2: Threshold Validation
- **Deliverable**: Score-to-Threshold comparison logic.
- **Commit Goal**: Benchmark runs display a green "Threshold Met" badge if the score meets the scenario's repeatable standard.

---

## Phase 3: The Pulse (Analytics & Rank Decay)
**Focus**: Visualizing long-term consistency and the "rust" factor.

### Checkpoint 3.1: Premium Layout & Aesthetics
- **Deliverable**: Glassmorphic UI implementation.
- **Commit Goal**: The application displays a multi-pane layout (Sidebar/Dashboard) with modern typography and semi-transparent "glass" cards.

### Checkpoint 3.2: Rank-Decay (Rust) Visualization
- **Deliverable**: Decay algorithm implementation.
- **Commit Goal**: Scenarios not played for over 48 hours display a "Rusting" icon and a reduced "Current Skill Level" bar.

### Checkpoint 3.3: Consistency Trending
- **Deliverable**: EMA (Exponential Moving Average) charting.
- **Commit Goal**: Selecting a scenario opens a chart showing the raw score vs. the EMA trend line over time.

---

## Phase 4: Growth Engine (Weakness Targeting & Polish)
**Focus**: Proactive training guidance and performance scaling.

### Checkpoint 4.1: Weakness Analytics
- **Deliverable**: Data analysis engine.
- **Commit Goal**: A "Training Priorities" panel lists the three benchmark scenarios with the highest decay or worst threshold consistency.

### Checkpoint 4.2: Interactive Recommendations
- **Deliverable**: Recommendation UI.
- **Commit Goal**: A "Suggest Scenario" button selects and highlights a specific scenario's card based on identified weaknesses.

### Checkpoint 4.3: Background Indexing
- **Deliverable**: Web Worker integration.
- **Commit Goal**: The UI remains responsive (running a smooth micro-animation) while the app parses a folder containing 1,000+ historical logs.
