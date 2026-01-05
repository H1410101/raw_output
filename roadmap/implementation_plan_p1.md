# Implementation Plan - Phase 1

This plan details the foundation of the Raw Output engine. Each step is designed to yield a verifiable result.

## Strategy
Build a thin but functional pipeline where a file is saved in a folder and its data is immediately available to the app's internal state.

## Immediate Steps

1.  **Project Shell** (Checkpoint 1.1)
    - **Action**: Scaffold with Vite + TypeScript.
    - **Verification**: `npm run dev` shows the app title on `localhost`.

2.  **Permissions & Access** (Checkpoint 1.2)
    - **Action**: Implement `DirectoryAccessService` using the File System Access API.
    - **Verification**: Click button -> Select Folder -> UI displays "Connected to: [FolderName]".

3.  **Parser Foundation** (Checkpoint 1.3)
    - **Action**: Build a robust CSV extractor.
    - **Verification**: Select a file -> UI displays "Scenario: [Name], Score: [Value]".

4.  **Observer Pattern** (Checkpoint 1.4)
    - **Action**: Set up a directory watcher (polling/listener).
    - **Verification**: Add file to folder -> Entry appears in UI list automatically.

## Success Criteria (Observable Results)
- [ ] **Initialized**: Page loads with "Raw Output" branding.
- [ ] **Connected**: Folder picker opens and folder name is captured.
- [ ] **Parsed**: Metadata from a single CSV is rendered on screen.
- [ ] **Live**: New files on disk trigger UI updates in real-time.
