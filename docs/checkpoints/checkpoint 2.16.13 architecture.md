# Checkpoint 2.16.13 Architecture: Reactive Title Glow

## Context
The "Raw Output" title currently sits on top of a dynamic background grid that reacts to moving ripples. To enhance the tactile and integrated feel of the UI, the title should also react to these ripples by exhibiting a subtle glow when they pass through its screen coordinates.

## Design Decisions
1.  **Sharp Offset Shadow**: The reactive element is implemented using a `text-shadow` with a minimal blur (0.1rem) and a slight offset (0.2rem down and right). This creates a sharp "echo" of the text that only appears within the ripples.
2.  **Reactive Masking**: The glow will use the same logic as the `.ripple` elements. Instead of being always visible, it will be masked by the same radial gradients used for the background dots.
3.  **Initial Invisibility**: To ensure the shadow is not visible on page load, the ripple CSS variables are initialized to coordinates far outside the viewport (`-2000px`), preventing the mask from revealing the text until the first ripple cycle begins.
4.  **Logical Synchronization**: To ensure the glow appears exactly when the ripple passes "through" the title, the title glow elements will share the exact same CSS variables (`--ripple-x`, `--ripple-y`, `--ripple-radius`, `--ripple-thickness`) as the background ripples.

## Implementation Details
- **HTML Structure**:
    - Add a `.title-glow-container` inside `.header-content`, positioned behind the `h1`.
    - Mirror the three ripple layers (`.ripple-1`, `.ripple-2`, `.ripple-3`) within this container.
- **CSS Logic**:
    - The glow ripples do not contain a dot grid pattern. Instead, they contain the text "Raw Output" with a transparent fill and a sharp `text-shadow` (0.1rem blur, 0.2rem offset) that appears as the ripple passes through.
    - Added default values for `--ripple-x`, `--ripple-y`, and `--ripple-radius` (`-2000px`) to the `.title-ripple` class to enforce initial invisibility.
    - Use `-webkit-mask-image` / `mask-image` on these glow layers, referencing the global ripple variables.
    - Ensure `pointer-events: none` and `z-index` are set so the glow stays behind the main text and doesn't interfere with interactions.
- **Controller Integration**:
    - The existing `RippleController` already updates the `--ripple-*` variables on the `.ripple` elements. No changes to the controller are required if the new glow elements are siblings or children that can inherit or receive the same variable updates.

## Verification Plan
- **Visual Sync**: Observe the "Raw Output" title as background ripples pass through. The glow should appear only within the bounds of the "wave" and move across the text in sync with the grid's lighting.
- **Performance**: Ensure that adding three more masked layers (even if small) doesn't cause layout thrashing or dropped frames during ripple animations.
