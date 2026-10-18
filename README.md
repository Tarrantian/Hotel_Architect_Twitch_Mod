Hotel Architect Twitch Integration
This is a small-scale hobby project, for the singular purpose of allowing a twitch streamer to interact with their viewers, and their viewers to interact with the game (albeit in a limited sense) when the streamer plays Hotel Architect.
Let your Twitch viewers check into your hotel — or join the staff! Viewers type `!visit` in chat to become a guest, or `!staff` to become an employee. Guests get renamed when they check in, and staff get renamed when hired or when a slot is available.
How It Works
Guests:
Viewer types `!visit` in Twitch chat
Bot adds them to the guest queue and confirms their position
When a new guest checks into your hotel, they get renamed to the first viewer in the queue
Bot announces in chat when they check in and check out
After checkout, the viewer can `!visit` again
Staff:
Viewer types `!staff` in Twitch chat
If there's an unclaimed staff member, they get renamed to the viewer — first come, first served!
If all staff are already claimed: "Sorry, no job openings currently!"
When the streamer hires new staff, a slot opens up and viewers can race to claim it
A viewer can be a guest or staff, but not both at the same time
Arcade Leaderboard:
When a Twitch guest uses the arcade machine in-game, the mod detects it automatically
When they finish playing, a random score is generated and announced in chat
If it beats the all-time high score, chat gets a special announcement
Scores persist forever in `scores.json` — the leaderboard carries across streams
Viewers can type `!arcade` to see the top 3 all-time scores
Chat Commands
Command	Description
`!visit`	Join the queue to become a hotel guest
`!staff`	Claim a staff member (first come, first served)
`!quit`	Quit the hotel staff (frees up the slot for others)
`!queue`	See who's currently in the guest queue
`!position`	Check your position in the guest queue
`!arcade`	Show the all-time top 3 arcade high scores
---
Prerequisites
Hotel Architect on Steam
UE4SS (Unreal Engine modding framework)
Node.js (LTS version)
A Twitch account
---
Installation
Part 1 — UE4SS Setup
> **Read this first.** Hotel Architect runs on Unreal Engine 5.7. The **stable** UE4SS release does
> not support UE 5.7 — it fails during startup, never finishes loading, and the mod never runs. You
> need an **experimental** build. See [Troubleshooting](#troubleshooting) for what the failure looks like.
Go to github.com/UE4SS-RE/RE-UE4SS/releases and find the release tagged `experimental-latest` (marked "Pre-release"). Do not use the release marked "Latest".
Expand Assets and download the plain build — it's named `UE4SS_v3.x.x-####-########.zip`. Skip the one starting `zDEV-`; that's a debug build and it will slow your game down.
Unblock the zip before extracting it. Right-click the downloaded file → Properties → if there's an Unblock checkbox at the bottom of the General tab, tick it and click OK. Windows blocks DLLs downloaded from the internet, and a blocked loader fails silently with no error.
Extract the zip somewhere neutral, like your Desktop. Inside you'll find a `ue4ss` folder and a `dwmapi.dll` file.
Copy both of them into your Hotel Architect binaries folder:
```
   ...\Hotel Architect\HotelArchitect\Binaries\Win64\
   ```
`Win64` should now contain a `ue4ss` folder and a `dwmapi.dll`, sitting alongside the game's own files. Copy the `ue4ss` folder itself — not its contents.
Open `Win64\ue4ss\UE4SS-settings.ini` and set:
```
   bUseUObjectArrayCache = true
   ```
Verified working with: UE4SS `v3.0.1-1181-g83330635` and the Hotel Architect build dated 28 September 2026. If a later game update breaks the mod, a newer `experimental-latest` is the first thing to try.
Part 2 — Lua Mod Setup
The `Mods` folder already exists and holds UE4SS's own built-in mods. Create your folders alongside them — don't remove anything that's already in there:
```
   Win64\ue4ss\Mods\TwitchMod\Scripts\
   ```
Copy `main.lua` from this repo into the `Scripts` folder:
```
   Win64\ue4ss\Mods\TwitchMod\Scripts\main.lua
   ```
The bot will automatically create data files in the `TwitchMod` folder the first time it runs — you do not need to create these manually:
```
   Win64\ue4ss\Mods\TwitchMod\twitchqueue.txt
   Win64\ue4ss\Mods\TwitchMod\assigned.txt
   Win64\ue4ss\Mods\TwitchMod\checkedout.txt
   Win64\ue4ss\Mods\TwitchMod\staffqueue.txt
   Win64\ue4ss\Mods\TwitchMod\staffassigned.txt
   Win64\ue4ss\Mods\TwitchMod\staffslots.txt
   Win64\ue4ss\Mods\TwitchMod\arcadedone.txt
   Win64\ue4ss\Mods\TwitchMod\staffquit.txt
   ```
Enable the mod in both mod list files in `Win64\ue4ss\Mods\`. Current UE4SS builds ship a
`mods.json` as well as a `mods.txt`, and they should agree with each other.
In `mods.txt`, add this line underneath `BPModLoaderMod : 1`:
```
   TwitchMod : 1
   ```
Leave `Keybinds : 1` at the bottom — the file says "do not move up!" and it means it.
In `mods.json`, add this block directly before the `Keybinds` entry:
```json
       {
           "mod_name": "TwitchMod",
           "mod_enabled": true
       },
   ```
Mind the commas: your new block ends with `},` while the `Keybinds` block after it still ends
with a plain `}` before the closing `]`.
Update the path in `main.lua` — open the file and change the `MOD_DIR` at the top to match your installation:
```lua
   local MOD_DIR = "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Hotel Architect\\HotelArchitect\\Binaries\\Win64\\ue4ss\\Mods\\TwitchMod\\"
   ```
If your Steam library is on a different drive or folder, update this path accordingly.
Part 3 — Twitch Bot Setup
Create a folder on your PC, e.g. `C:\TwitchBot\`
Copy `bot.js` from this repo into that folder
Open a command prompt in that folder (click the address bar in Explorer, type `cmd`, press Enter) and run:
```
   npm install tmi.js
   ```
Get a Twitch OAuth token:
Go to twitchtokengenerator.com
Log in with your Twitch account
Copy the Access Token
Update the config at the top of `bot.js`:
```javascript
   const TWITCH_CHANNEL = 'your_channel_name'; // your Twitch username (lowercase)
   const BOT_USERNAME = 'your_channel_name';   // same as above
   ```
And update the password line:
```javascript
   password: 'oauth:YOUR_ACCESS_TOKEN_HERE'
   ```
Update the `MOD_DIR` path in `bot.js` to match your installation (same path as in `main.lua`):
```javascript
   const MOD_DIR = 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Hotel Architect\\HotelArchitect\\Binaries\\Win64\\ue4ss\\Mods\\TwitchMod\\';
   ```
---
Running the Mod
Every time you stream:
Start the bot — open a command prompt in `C:\TwitchBot\` and run:
```
   node bot.js
   ```
Start Hotel Architect and load your save
That's it! The mod hooks load automatically with the game. Viewers can now type `!visit` or `!staff` in your chat.
Order matters. Start the bot first, then the game. And if you restart the bot mid-session, restart Hotel Architect too — the bot clears the shared text files on startup while the running game mod keeps its own place in them, so they fall out of sync and commands appear to stop working.
---
Troubleshooting
Nothing gets renamed, and the log repeats "Scan failed"
This is the most common failure, and the bot gives you no hint about it — it still connects to
Twitch and answers commands perfectly, so everything looks fine until you notice nobody is being
renamed.
Look in the log for a block like this, repeating:
```
Found EngineVersion: 5.7
Failed to find FName::FName(wchar_t*): FNameCtorWchar: expected at least one value
Failed to find FUObjectHashTables::Get(): FUObjectHashTablesGet: expected at least one value
Failed to find GNatives: GNatives: expected at least one value
Scan failed
PS Scan attempt 101 (Phase 2)
```
That means your UE4SS build doesn't support Unreal Engine 5.7 — almost always because it's the
stable release instead of `experimental-latest`. UE4SS never finishes starting up, so `main.lua`
never loads and no hooks are ever registered.
Fix: redo Part 1 using the `experimental-latest` build.
The retrying stops on its own after `SecondsToScanBeforeGivingUp` (120 by default), but it pegs a CPU
core and spins your fans up until it does.
The UE4SS console window doesn't appear
Some builds start without a visible console. That's not a fault — everything still goes to the log:
```
...\Binaries\Win64\ue4ss\UE4SS.log
```
Open it in Notepad and search for `TwitchMod`. If the file's "Date modified" matches your last
launch, UE4SS is loading fine.
Bot connects but `!visit` does nothing
Make sure the bot is running (`node bot.js`) and shows "Connected to #yourchannel"
Check that the `MOD_DIR` path in `bot.js` is correct
Guests aren't being renamed
Check `UE4SS.log` for `[TwitchMod] Loaded. Waiting for guests, staff, and arcade events...`
Check that `TwitchMod` is enabled in both `mods.txt` and `mods.json`
Check that the `MOD_DIR` path in `main.lua` is correct. It's a second, separate copy of the path you set in `bot.js` — updating one and forgetting the other produces exactly this symptom, because the bot writes to the real folder while the mod reads one that isn't there
"Command not found" errors in UE4SS
Make sure `main.lua` is inside the `Scripts` subfolder, not directly in `TwitchMod`
Make sure the filename is exactly `main.lua` and not `main.lua.txt` (Windows may hide the `.txt` extension)
---
File Structure Reference
```
Hotel Architect\HotelArchitect\Binaries\Win64\
├── ue4ss\
│   ├── Mods\
│   │   ├── mods.txt               ← add "TwitchMod : 1" here
│   │   ├── mods.json              ← add the TwitchMod block here too
│   │   └── TwitchMod\
│   │       ├── Scripts\
│   │       │   └── main.lua       ← the game mod
│   │       ├── twitchqueue.txt    ← guest queue (append-only)
│   │       ├── assigned.txt       ← guest check-in log (append-only)
│   │       ├── checkedout.txt     ← guest checkout log (append-only)
│   │       ├── staffqueue.txt     ← staff claims (append-only)
│   │       ├── staffassigned.txt  ← staff assignment log (append-only)
│   │       ├── staffslots.txt     ← open slot count (written by Lua)
│   │       ├── arcadedone.txt     ← arcade completions (written by Lua)
│   │       └── staffquit.txt     ← staff quit requests (written by bot)
│   ├── UE4SS-settings.ini
│   └── UE4SS.log                  ← check here first when something goes wrong
│
C:\TwitchBot\
├── bot.js                         ← the Twitch bot
├── scores.json                    ← persistent all-time arcade leaderboard
├── package.json
└── node_modules\
```
---
Credits
Built with UE4SS and tmi.js.
