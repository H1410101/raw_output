```raw_output\roadmap\current checkpoint.md#L1-12
# Current Checkpoint: 2.17.3: Scaling Unit Linting

## Status
Completed

## Deliverables
- [x] Implement `scripts/verify_scaling.js` with regex-based detection of absolute pixel units.
- [x] Define exceptions for 1px/2px hairline borders and large off-screen masking constants.
- [x] Create architecture document `docs/checkpoints/phase 2/checkpoint 2.17.3 architecture.md`.
- [x] Add `lint:scaling` script to `package.json`.
- [x] Fix existing `px` violations in the codebase.
- [x] Integrate into pre-commit husky hooks.
