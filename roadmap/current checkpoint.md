```raw_output\roadmap\current checkpoint.md#L1-18
# Current Checkpoint: 2.8.1: Dot Cloud Vertical Alignment Refinement

## Status
Done

## Deliverables
- Refactor vertical positioning logic in `DotCloudComponent`.
- Center performance dots within the vertical span of rank notches.
- Decouple dot vertical centering from the label-inclusive canvas height.

## Summary
The Dot Cloud visualization currently centers performance dots relative to the entire canvas height. Since rank labels occupy the bottom portion of this height, the dots appear vertically offset from the rank notches. This refinement adjusts the rendering logic to center the dots within the remaining vertical space occupied by the notches, improving visual alignment.

## Next Up
Checkpoint 2.9: Visual Settings Placeholder
