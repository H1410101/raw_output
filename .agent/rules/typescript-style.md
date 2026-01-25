---
trigger: always_on
---

Make sure code adheres to the following principles for TypeScript:

- Use long variable and class names to make code self-explanatory, and do not write comments.
- Methods should, at a glance, answer "how" the method works, at the level of abstraction that the method signature suggests. This often leads to very short methods and many abstract helper functions. Fallbacks and throws are sometimes not suited to the abstraction level of the current function, and should be tucked into an `_orThrow` or `_orReject` helper.
- However, helpers should not take in too many parameters; difficulty tracking what goes in and comes out of helper functions muddies the mental picture of how a method works.

The above are primary principles that should be prioritized above all else. The following are secondary principles:

- Always provide explicit type annotations. Prefer shorthand array syntax (`type[]`) over the generic `Array<type>` syntax. Avoid `any` or `unknown` unless the logic is explicitly generic.
- In classes, always explicitly declare and type fields at the top of the class body, outside of the constructor or methods. Use `readonly` for immutable properties.
- Prefer well-formed data. Use `interface` for pure data structures and `class` for objects with logic. Use Zod schemas for runtime validation if the context permits.
- Always document public-facing API using JSDoc, and mark private helpers with both the `private` access modifier and an underscore prefix (e.g., `private _internalHelper`).
- Methods/functions should be strictly less than 20 lines, ignoring blank lines. This count should not be artificially reduced; code must pass Prettier formatting with standard configurations.
- Blank lines should separate groups of code, where each group is strictly less than 10 lines long and has a very clear goal. The goal must be made clear by the code itself.
- Conversely, blank linkes should _not_ separate lines of code otherwise. A function should have at most 4 of such "groups", which means three blank lines.
- The above three points are methods to create "structure" in code, but if a method gets too long, splitting into helpers should be the main solution.