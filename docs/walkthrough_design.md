# Design System Upgrade: Neon Void

**Goal:** Transform the application's aesthetic to a "Cyber-Industrial" look, matching the new "AI Forge" capabilities.

## Changes Created

### 1. **Color Palette (`tailwind.config.js`)**
Shifted from a generic Purple/Violet theme to **"Neon Void"**:
*   **Background**: `#030712` (Deep Obsidian) - A true void backing.
*   **Primary**: `#06b6d4` (Cyan 500) - For constructive actions (Build/Compose).
*   **Optimization**: `#f59e0b` (Amber 500) - For the reasoning/thinking loop.
*   **Fonts**: Swapped `Outfit` for `Space Grotesk` (Headers) and `Inter` (Body).

### 2. **Global Styles (`index.css`)**
*   Updated the body background to use a **double radial gradient + technical grid**.
*   Added `neon-text-cyan` and `neon-text-amber` utilities for glowing text effects.
*   Refined scrollbars to be slimmer and darker.

### 3. **Font Integration (`index.html`)**
*   Imported `Space Grotesk` and `Inter` from Google Fonts.

## Verification

### Visual Check
1.  **Background**: Should look deeply dark with a subtle blueish radial glow in the top-left and amber glow in the bottom-right.
2.  **Typography**: Headers should look wider and technical (Space Grotesk). Body text should be crisp (Inter).
3.  **Accent Colors**: Buttons and highlights should now use Cyan (Blue-Green) instead of Purple.

## Conclusion
The application now visually aligns with the "Advanced Agentic Engineering" positioning derived from the notebook research. The "Forge" component and the main editor share a unified, professional aesthetic.
