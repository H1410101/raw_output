```raw_output\roadmap\current checkpoint.md#L1-20
# Current Checkpoint: 2.13.3: Colour & Transparency Tuning

## Status
Completed

## Deliverables
- Calibrated color hierarchy for the dot cloud visualization using the "lower band" palette.
- Manual CSS variable resolution for Canvas rendering to ensure accurate color display.
- Transitioned benchmark table, settings menu, and stats folder popout to a high-transparency `background-2` configuration.
- Migrated stats folder popout typography to the "lower band" color tokens.
- Synchronized tactile scroll thumb and dropdown shadows with the updated panel depth.

## Summary
The visual system has undergone a comprehensive tuning pass. By halving opacities twice for primary containers (table, settings, and stats popout) and migrating their structural shadows to the `background-2` palette, we've achieved a lighter, more integrated "glass" aesthetic. Secondary typography across the popout and visualizations now correctly respects the project's "lower band" color tokens, ensuring a cohesive hierarchy.

## Todos before Milestone Checkpoint 2.14
- remove recent and new, change to a popup
- add rank names and rank progression
- add helpful instructional popups hidden behind question marks, that are hidden unless the cursor is close enough. Do so for all-time and session headers, and the stats folder and most actions and unexplained lines in it, as well as the recents tab.
- create and link real visual settings (under subcheckpoint 2.13.4: Visual Settings)

## Next Up
Checkpoint 2.14: SFX Identity
