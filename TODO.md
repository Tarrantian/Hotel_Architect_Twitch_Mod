# TODO

Known issues in `main.lua`, not yet fixed.

## Staff placeholder reset never runs

`resetExistingStaffNames()` is called at the bottom of `main.lua`, so it runs when the mod loads —
during game startup, before a save is loaded. At that point `FindAllOf("HaStaffCharacter")` returns
nothing, so the function does nothing and prints nothing.

Effect: staff named after a previous stream's viewers keep those names when the save is loaded.

Fix: call it from the staff polling loop instead, once, the first time staff are found.

## File errors are silent

`readLines()` returns an empty table when `io.open` fails, and `appendLine()` returns without
writing. A wrong `MOD_DIR` in `main.lua` is therefore indistinguishable from an empty queue — both
produce `[TwitchMod] Queue empty.`

This matters because `MOD_DIR` is set separately in `main.lua` and in `bot.js`. Updating one and
not the other produces a mod that appears to be working and does nothing.

Fix: print the resolved `MOD_DIR` once at startup, and log a warning when a read or write fails.
