# Dou Shou Qi Rule Comparison Matrix

This project implements one consistent mainstream ruleset for Dou Shou Qi / Jungle and documents where earlier behavior differed.

Access date for all sources: **March 1, 2026**.

## Sources used

1. Wikipedia, "Jungle (board game)"  
   https://en.wikipedia.org/wiki/Jungle_(board_game)
2. LIACS (Leiden Institute of Advanced Computer Science), "The AI of Jungle" (rules section + board figure)  
   https://liacs.leidenuniv.nl/~visjk/doushouqi/about.html
3. Yellow Mountain Imports, "How to Play Jungle (Dou Shou Qi)"  
   https://www.ymimports.com/pages/how-to-play-jungle

## Matrix

| Rule area | Previous project behavior | Standard behavior from sources | Implemented behavior |
|---|---|---|---|
| River layout | Single 5×3 river block (`col 1..5`, `row 3..5`) | Two separate river zones (`col 1,2` and `col 4,5` for `row 3..5`) | Updated to two-river 12-cell layout |
| Trap layout | Three top traps at `row 1`; three bottom traps at `row 7` | Traps adjacent to each den: top `(2,0) (4,0) (3,1)` and bottom `(2,8) (4,8) (3,7)` | Updated to standard den-adjacent trap coordinates |
| Initial setup | Non-standard positions (including lion on den file and swapped formations) | Standard opening from rules diagrams (mirrored across board centerline) | Updated to standard starting coordinates |
| Basic movement | One orthogonal step only (no jump support) | One orthogonal step for most pieces | Preserved |
| River entry | Non-rat pieces blocked; rat allowed | Rat/mouse is the only piece that can occupy river | Preserved |
| Lion/Tiger jump | Not actually implemented in move validator | Lion/Tiger jump across contiguous river squares in straight lines | Implemented horizontal and vertical jump logic |
| Jump blocking | Not implemented | Any rat in crossed river path blocks lion/tiger jump | Implemented (checks every crossed river square) |
| Rat ↔ Elephant | Elephant blocked from taking rat; rat could take elephant without terrain constraint | Rat can take elephant, elephant cannot take rat; river/land interaction restricts captures across terrain boundary | Implemented with land/river capture boundary checks |
| River vs land captures | Not fully enforced | Piece in water does not capture piece on land (and vice versa) | Implemented for all captures |
| Trap weakening | Mentioned, but not fully integrated in rank comparison | Defender in attacker-owned trap can be captured by any attacker | Implemented as priority rule in capture validation |
| Win conditions | Opponent den entry or elimination | Den entry and elimination are core win conditions in cited rules | Preserved and tested |
| No-legal-move outcome | Not implemented | Sources disagree (loss in some rule sets, draw in others) | Not adopted in this project; left out intentionally to avoid unverified variant lock-in |

## Variant note

The no-legal-move / stalemate outcome varies by source sets and house rules. Because cited references are not fully consistent on this point, this implementation keeps only the universally shared win conditions (den entry and elimination) and documents that choice explicitly.
