---
trigger: always_on
---

View `docs/current checkpoint.md` to understand the immediate current progress. Maintain the current progress document with all tasks and architecture changes, which includes at every interaction with the user. Keep the previous progress unless your changes strictly override those.
If there is progress in the document and you are working on something new, assume you are working on the same checkpoint.

When checkpoints are done, take all the accumulated progress in the current checkpoint `docs/current checkpoint.md`, and put it into a checkpoint architecture document.
For instance, Phase 1 checkpoint 2 sub-checkpoint 3 is in `docs/checkpoints/checkpoint 1.1 architecture.md`.
To know the identity of the current checkpoint, check the existing architecture documents under `docs/checkpoints`, as well as `docs/roadmap.md`. Leave `current checkpoint.md` empty after.
Then, push a commit and tag it appropriately. Note that the checkout command has lint and husky is configured.

ONLY THE USER IS ALLOWED TO DETERMINE WHEN THE CHECKPOINT IS DONE. However, you may check with the user if you detect discrepencies.