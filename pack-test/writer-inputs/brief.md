# Brief for the item writer (read only the files in this folder)

You are writing short test items for a labelling study. Readers will later be asked to classify each item, so each item must describe ONE concrete event, with actors and objects, in plain everyday words. You are not told how readers will classify them and you must not try to guess; just write clear, natural, varied items.

Read only these files: this brief, `concepts-A.md`, `roles-A2.md`, `banned.txt`, `jargon.txt`. Do not read any other file or folder on this computer. Do not search for the project they come from.

## What to write

- **Set A (24 items).** For each of the 12 ideas in `concepts-A.md`, write two different concrete events. Ids `A-01` to `A-24` (idea 1 gives A-01 and A-02, idea 2 gives A-03 and A-04, and so on).
- **Set A2 (28 items).** For each of the 14 ideas in `roles-A2.md`, write two different concrete events. Ids `A2-01` to `A2-28` in the same pattern.
- **Set B (24 items).** Write 24 ordinary record-keeping events from everyday apps (a customer list, a case tracker, a journal, a task list, a shared photo album). Make them varied: do not write only "create" and "edit" events. Include events where someone checks something against a standard, starts looking at something, merges two things, splits one thing in two, changes how something is read, links or unlinks things, and does nothing on purpose. Ids `B-01` to `B-24`. The ideas files do not apply to set B.

## Rules for every item

- One or two sentences. One event only. Name the actors and the objects (for example "Maya", "the budget spreadsheet").
- Use everyday words. Never use any word listed in `banned.txt`, in any form (including plurals and capitalised forms), and avoid the project jargon in `jargon.txt`.
- Do not name or hint at a category for the event. Do not write labels, tags, or explanations. Do not use the words "operator", "grain", "mode", "domain" or "cell".
- Make the two events for one idea clearly different from each other (different actors, objects and setting).
- Do not copy the idea sentence; illustrate it.

## Output

Write one JSON file: `out/items-ab.json`, an array of objects with exactly these fields:

```
{"id": "A-01", "set": "A", "idea": "permission-rule", "text": "..."}
```

For set B use `"idea": "everyday"`. Check your own output: valid JSON, exactly 76 items, ids unique, no banned words. Then reply with only the number of items written and any banned word you had to avoid.
