# Zbarber Noir & Champagne

## Source and scope
Generated visual system based on the user's homepage design brief, not an import
of the app's whole component library. Existing mobile code remains authoritative
for business behavior and routes. This package's initial web component catalog
uses the same tokens. The approved mobile home now consumes the shared native
theme, fonts and primitives; product-specific compositions remain in the app.

## Source-derived composition rules
- Dark: background #0C0D10, surface #17191E, primary #C9A76A,
  foreground #F5F3EF, secondary text #92959D.
- Light mode is a derived companion, not a supplied reference.
- Champagne highlights the primary action; avoid gold outlines around every card.
- Keep surfaces flat: no heavy shadows or aggressive gradients.
- Use existing Inter for UI and Playfair Display for editorial headings.
- Cover photographs use 4:3 crops and 14–18 pixel corners, never stretched.
- Keep information under cover images rather than in heavy card footers.
- Missing-image illustrations must be unmistakable placeholders, not invented salons.
- Ratings, distances, categories and other product facts must come from real data.
- Compact autoplay advertisement previews start muted, never play off-screen,
  and keep an accessible icon-only audio toggle.

## Continuation
The Noir & Champagne direction was approved before mobile integration. Keep
production data and backend contracts unchanged. The mobile task's acceptance
criteria, not the component demos, determine completion.
