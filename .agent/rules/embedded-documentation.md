---
trigger: always_on
---

As developer documentation, take the **Embedded Documentation** approach. This approach mandates that all folders containing developer-readable code should also come with a top-level `_docs.md`. 

Each `_docs.md` should explain the API across the barrier between what's outside the directory, and what's inside the directory. This should have both an exhaustive list of functions called, an exhaustive list of immediately relevant files that can be directly called by external code, as well as a diagram (or diagrams, if it would otherwise be too large) that detail how the different external elements might interact in what ways with internal elements.

The `_docs.md` should also explain the relationship between its immediate children, whether they be subdirectories or files. All of these should come with separate diagrams, or even multiple diagrams to break down the relationships and be easier to parse. This should include important control flows, calls and composition relationships. etc.

Here is a collection of retroactive advice from your past selves:

"If I could speak to my past self, I would emphasize that boundaries are more important than connections.

When documenting a system, do not just draw a map of how things talk to each other; draw a map of where they live. Grouping elements into specific domains (like 'Browser Context' vs. 'Application Core') instantly communicates ownership and architectural scope. A diagram with clear boundaries allows a reader to ignore the 'External' box once they understand the input/output, whereas a flat diagram forces them to hold the entire graph in their head at once.

Redundant grouping (placing a single important element in its own named box) is a cheap but powerful way to say: 'Pay attention here; this is the protagonist of this story."

"Another critical lesson: make arrows mean one thing consistently.

In diagrams, arrows often ambiguously mean 'data flows this way' or 'dependency points this way'. I insist that arrows should always represent **Control Flow**—the direction the code actually reaches out.

If Service A calls Utility B, the arrow points A -> B. Even if B returns data to A, the *initiative* came from A. This aligns the diagram with the stack trace. When arrows flip-flop between 'A calls B' and 'B gives data to A', the reader loses the ability to trace the execution path mentally."

"Finally, standardize the structure of your `_docs.md` files to clearly separate external contracts from internal details. Use the following template:

# External Documentation
## External Interactions Diagram
[Mermaid graph with clear boundaries using directory names]
## Exposed Internal API
[List of exported elements used by external consumers]

# Internal Documentation
## Internal Files and API
[Implementation details, subdirectories, and private helpers]
"

"Another critical lesson: make arrows mean one thing consistently.

In diagrams, arrows often ambiguously mean 'data flows this way' or 'dependency points this way'. I insist that arrows should always represent **Control Flow**—the direction the code actually reaches out.

If Service A calls Utility B, the arrow points A -> B. Even if B returns data to A, the *initiative* came from A. This aligns the diagram with the stack trace. When arrows flip-flop between 'A calls B' and 'B gives data to A', the reader loses the ability to trace the execution path mentally."