# Changelog

## Stoney Sudoku Update

### Added
- Bootstrap 5 for layout, buttons, cards, and badges.
- Plaster wall background with a warm wash.
- Grain texture on board cells and outlined buttons (orange buttons left plain).
- Squiggle underline under the title.
- Playful button hover (lift and tilt) and pop-in animations, with reduced-motion support.
- Joke footer from a fake company.
- Design tokens (colors, spacing, radius, easing) in `index.css`.

### Changed
- Layout now uses Bootstrap's grid: three columns on large screens, stacked on small ones.
- Board has rounded corners, layered shadow, and tabular numerals.
- Info cards and buttons use thin hairline borders.
- Orange accent color for the Generate and Test buttons, hints, and cell focus.
- "Experiencing Issues?" hover now shows a text note instead of an image.
- Card headings are centered.

### Removed
- Old hand-written media queries and margin hacks.
- `DirectionsBoard.css` and `SudokuScanner.css`.
- Backend warning image from the page (file still in assets).
