# System Workflow

This document outlines the high-level operational flow of Raw Output, from user onboarding to real-time data visualization.

## 1. User Onboarding & Permissions
- **Entry**: User visits the web application.
- **Directory Selection**: User clicks a "Monitor Stats Folder" button.
- **Browser Prompt**: The browser triggers the `showDirectoryPicker()` dialog.
- **Permission Grant**: The user selects their Kovaak's `stats` folder and grants read/write (or just read) permission.

## 2. Initial Indexing
- **Baseline Scan**: The application performs an initial read of existing CSV files in the directory.
- **Benchmark Filtering**: Only files matching the official Viscose Benchmark scenario list are indexed.
- **Data Hydration**: Relevant metrics are parsed from the most recent files to populate the initial dashboard.
- **Threshold Analysis**: Historical data is evaluated against "Score Thresholds" to establish a consistency baseline.
- **State Persistence**: The folder handle is saved to IndexedDB to allow for session restoration.

## 3. Passive Monitoring
- **File System Observer**: The application maintains a listener for changes in the directory handle.
- **New File Detection**: When Kovaak's saves a new CSV (typically at the end of a scenario), the observer triggers a callback.
- **Filtered Parsing**: The application identifies the new file based on timestamp and filename conventions.

## 4. Data Processing & Visualization
- **Parsing**: The CSV content is piped through a parser that extracts:
    - **Scenario name**: Matched against Viscose Benchmark definitions.
- **Score & Accuracy**: Extracted as raw data.
- **Threshold Evaluation**: The score is checked against the scenario's defined "Repeatable Standard" (Threshold).
- **In-Memory Update**: The local data store is updated with the new record.
- **Reactive UI**: The dashboard re-renders, highlighting consistency gains and threshold status rather than just "New Highscore" alerts.

## 5. Session Management
- **Local Storage**: All processed data remains in the browser's local storage or memory.
- **Exporting (Optional)**: Users can export their processed history as JSON for local backups.
