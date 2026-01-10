# Checkpoint 2.17.5: Theme Fine-tuning Architecture

This document outlines the visual refinements made to unify the interaction language and scaling behavior across the application's navigation and action elements.

## 1. Interaction Consistency

The primary goal of this checkpoint is to ensure that all interactive elements provide consistent visual feedback that matches the global header's action buttons.

### Unified Hover States
Hover states have been synchronized across all primary buttons to use a consistent tint and typography highlight:
- **Background**: `rgba(var(--lower-band-1-rgb), 0.15)`
- **Text/Icon Color**: `var(--lower-band-3)`
- **Affected Elements**:
    - `.nav-item:hover` (Primary Navigation)
    - `.header-action-btn:hover` (Header Utilities)
    - `.tab-button:hover` (Difficulty Selectors)
    - `.folder-action-item:hover` (Stats Folder Settings)

## 2. Typography & Scaling Unified

To ensure a cohesive visual hierarchy, font sizes have been unified. Note that explicit scaling multipliers (like `--ui-scale`) were removed from font-size calculations to prevent "squared" scaling effects, as the application already uses reactive `rem` units tied to the root font size.

### Title Hierarchy
The application logo (`h1`), the "Welcome" introduction header, and the "Stats Linked" status title now share a consistent base size. The ripple shadows behind the logo have been adjusted to match this new scale.
- **Base Font Size**: `2.5rem`
- **Visual Fidelity**: Text shadows and ripple thickness have been increased to maintain impact at the larger size.

### Base Action Typography
Instructional text, connection labels, and action buttons in the folder view now use a unified base size to match the standard table typography.
- **Base Font Size**: `0.9rem`

## 3. Dynamic Spacing

All internal padding, margins, and gaps within the Folder Settings view and main header now respond to the global vertical spacing setting. Unlike font sizes, layout spacing benefits from explicit multipliers to adjust density.
- **Scaling Factor**: `--vertical-spacing-multiplier`
- **Applied To**: 
    - Separator margins (unified to `2rem` base).
    - Text margins (titles, paragraphs, and labels).
    - Component gaps (folder status details).
    - Global header padding and margins.

## 4. Deliverables Verification
- [x] Unify hover background tint and text color (`lower-band-3`) for all primary buttons.
- [x] Set application logo and folder view titles to a `2.5rem` base size.
- [x] Standardize ripple shadow thickness and offsets for the main logo.
- [x] Synchronize folder view action and instructional text to `0.9rem`.
- [x] Implement comprehensive padding, margin, and gap scaling using `--vertical-spacing-multiplier`.
- [x] Maintain clean `rem`-based scaling for typography without redundant multipliers.
