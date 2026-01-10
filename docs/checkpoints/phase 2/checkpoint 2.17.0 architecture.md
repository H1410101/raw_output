```raw_output\docs\checkpoints\phase 2\checkpoint 2.17.0 architecture.md#L1-43
# Checkpoint 2.17.0: Triple Action Header Architecture

This document describes the architectural changes for the redesign of the application header to include a unified triple-action button group on the top right.

## Overview

The previous header layout featured a centralized navigation menu and a separate status indicator with a dropdown. Individual views (like the Benchmark View) also managed their own local settings buttons. This checkpoint consolidates these actions into the global header for a more cohesive UI.

## Structural Changes

### 1. HTML Layout (`index.html`)
- **Action Group**: Introduced `.header-actions` container at the end of the `.app-header`.
- **Button Order**:
    1. **Folder Button**: Linked to the existing status dropdown.
    2. **Theme Button**: Placeholder for the upcoming light/dark mode toggle.
    3. **Settings Button**: Global access to visual and session settings.
- **Status Integration**: The `.status-dot-container` is now nested inside the Folder Button, allowing the connectivity status (Active, Scanning, Disconnected) to be reflected as a notification dot on the folder icon itself.

### 2. Component Logic (`BenchmarkView.ts`)
- **Decentralization**: The local `visual-settings-button` and its associated creation logic were removed from `BenchmarkView`.
- **Public API**: Exposed `openSettings()` as a public method to allow external controllers (like `AppBootstrap`) to trigger the settings menu.

### 3. Orchestration (`AppBootstrap.ts`)
- **Global Wiring**: The bootstrap now explicitly wires the header's "Settings" button to the `BenchmarkView.openSettings()` method, centralizing the interaction logic.

## Visual Styling

- **Unified Button Style**: All header actions share the `.header-action-btn` class, ensuring consistent sizing (2.25rem), glass-morphism effects, and hover transitions.
- **Iconography**: Standardized SVG paths for Folder, Theme (Moon), and Settings (Cog).
- **Responsive Status**: The status indicator dot is absolutely positioned relative to the folder button, maintaining visibility without disrupting the layout of the action group.

## Deliverables Verification
- [x] Implement three buttons on the top right of the header.
- [x] Order buttons as: Folder, Theme, and Settings.
- [x] Ensure buttons are visually consistent with the existing UI style.
