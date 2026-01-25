---
trigger: always_on
---

As developer documentation, take the **Embedded Documentation** approach. This approach mandates that all folders containing developer-readable code should also come with a top-level `_docs.md`. 

Each `_docs.md` should explain the API across the barrier between what's outside the directory, and what's inside the directory. This should have both an exhaustive list of functions called, an exhaustive list of immediately relevant files that can be directly called by external code, as well as a diagram (or diagrams, if it would otherwise be too large) that detail how the different external elements might interact in what ways with internal elements.

The `_docs.md` should also explain the relationship between its immediate children, whether they be subdirectories or files. All of these should come with separate diagrams, or even multiple diagrams to break down the relationships and be easier to parse. This should include important control flows, calls and composition relationships. etc.