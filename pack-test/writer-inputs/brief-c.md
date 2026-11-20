# Brief for the control-item writer (read only the files in this folder)

You are writing short test items for a labelling study. Read only this brief and `cells.json`. Do not read any other file or folder on this computer and do not look up where `cells.json` comes from.

`cells.json` describes 27 "cells". Each cell has an `id`, a `rank`, an `op`, a `grain`, a `mode`, a `domain`, a `terrain` and a `stance`.

## What to write

Write one concrete everyday event for each of these 12 cell ids, in this order (the first row is `C-01`):

1. NUL·Ground  2. SEG·Ground  3. CON·Ground  4. REC·Ground
5. SIG·Figure  6. INS·Figure  7. SYN·Figure  8. DEF·Figure
9. NUL·Pattern  10. CON·Pattern  11. EVA·Pattern  12. REC·Pattern

For each, read the cell's `mode`, `domain`, `terrain` and `stance` and write ONE event, in one or two sentences, with named actors and objects, that someone who understood those four words together would recognise as that cell. Use ordinary everyday settings (offices, kitchens, schools, shops, gardens, clubs) and vary them. 

## Rules

- Everyday words only. Never use the cell id, the op name, the grain name, or the words in the cell's `mode`, `domain`, `terrain` or `stance` fields, or the words "operator", "grain", "mode", "domain" or "cell". Do not use any of the words that appear anywhere in the `mode`, `domain`, `terrain` or `stance` fields of `cells.json`.
- No labels, tags or explanations inside the item text.

## Output

Write `out/items-c.json`: an array of objects with exactly these fields: `{"id": "C-01", "set": "C", "text": "..."}`. Write the answers in a separate file `out/key-c.json`: an array of `{"id": "C-01", "cell": "NUL·Ground"}`. Check that both are valid JSON and have 12 entries. Then reply with only the number of items written.
