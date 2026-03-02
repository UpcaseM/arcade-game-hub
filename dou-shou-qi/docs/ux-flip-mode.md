# Dou Shou Qi Flip Mode UX Spec

## Player Identity

- Identity uses redundant encoding: color + side label + shape badge.
- Blue side uses circle badge and dot pattern; red side uses diamond badge and stripe pattern.
- Hidden pieces stay neutral and never imply side ownership.

## HUD

- Left HUD has two persistent player panels with active-turn caret.
- Turn chip above board repeats active player and action hint.
- Opening phase shows both players as unassigned until first reveal resolves side assignment.

## Visual Effects

- Flip reveal: short card-flip (scaleX in/out) with immediate face update at midpoint.
- Selection pulse: subtle scale pulse while selected, stopped on deselect.
- Move polish: cubic tween and short trail from source to destination.
- Capture cue: brief impact ring and fade-down of captured piece.
- Turn transition: bottom banner with next player cue and board border pulse.
- Win overlay: dimmer + animated panel/title/buttons with winner identity.

## Motion and Accessibility Controls

- Reduced motion disables/simplifies movement-heavy tweens.
- Color assist toggle controls piece pattern overlays for color-vision support.
- Sound toggle is persisted for future audio hooks.

## Performance Rules

- Piece objects are persistent (`PieceView`) and updated in place.
- Input is locked during action animations to avoid race conditions.
- Effects are one-shot tweens with bounded lifetime and object count.
