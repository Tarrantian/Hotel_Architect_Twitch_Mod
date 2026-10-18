# Hotel Architect Twitch Integration

This is a small-scale hobby project, for the singular purpose of allowing a twitch streamer to interact with their viewers, and their viewers to interact with the game (albeit in a limited sense) when the streamer plays Hotel Architect.

Let your Twitch viewers check into your hotel — or join the staff! Viewers type `!visit` in chat to become a guest, or `!staff` to become an employee. Guests get renamed when they check in, and staff get renamed when hired or when a slot is available.

## How It Works

**Guests:**
1. Viewer types `!visit` in Twitch chat
2. Bot adds them to the guest queue and confirms their position
3. When a new guest checks into your hotel, they get renamed to the first viewer in the queue
4. Bot announces in chat when they check in and check out
5. After checkout, the viewer can `!visit` again

**Staff:**
1. Viewer types `!staff` in Twitch chat
2. If there's an unclaimed staff member, they get renamed to the viewer — first come, first served!
3. If all staff are already claimed, the bot says there are no openings and suggests trying again after new hires
4. When the streamer hires new staff, a slot opens up and viewers can race to claim it
5. A staff member can type `!quit` to leave and free their slot for someone else
6. A viewer can be a guest or staff, but not both at the same time

**Arcade Leaderboard:**
- When a Twitch guest uses the arcade machine in-game, the mod detects it automatically
- When they finish playing, a random score is generated and announced in chat
- If it beats the all-time high score, chat gets a special announcement
- Scores persist forever in `scores.json` — the leaderboard carries across streams
- Viewers can type `!arcade` to see the top 3 all-time scores

## Chat Commands

| Command | Description |
|---------|-------------|
| `!visit` | Join the queue to become a hotel guest |
| `!staff` | Claim a staff member (first come, first served) |
| `!quit` | Quit the hotel staff (frees up the slot for others) |
| `!queue` | See who's currently in the guest queue |
| `!position` | Check your position in the guest queue |
| `!arcade` | Show the all-time top 3 arcade high scores |

---

## Prerequisites

- [Hotel Architect](https://store.steampowered.com/app/1668580/Hotel_Architect/) on Steam
- [UE4SS](https://github.com/UE4SS-RE/RE-UE4SS/releases) (Unreal Engine modding framework)
- [Node.js](https://nodejs.org/) (LTS version)
- A Twitch account

---

## Installation

### Part 1 — UE4SS Setup

Built and tested against **UE4SS `v3.0.1-1181-g83330635`**, with the Hotel Architect build dated 28 September 2026.

1. Go to [github.com/UE4SS-RE/RE-UE4SS/releases](https://github.com/UE4SS-RE/RE-UE4SS/releases) and open the release tagged **`experimental-latest`** — the one marked "Pre-release".
2. Expand **Assets** and download `UE4SS_v3.x.x-####-########.zip`. Skip the one starting `zDEV-`; that's a debug build and it will slow your game down.
3. **Unblock the zip before extracting it.** Right-click the downloaded file → **Properties** → if there's an **Unblock** checkbox at the bottom of the General tab, tick it and click OK. Windows blocks DLLs downloaded from the internet, and a blocked loader fails silently with no error.
4. Extract the zip somewhere neutral, like your Desktop. Inside you'll find a `ue4ss` folder and a `dwmapi.dll` file.
5. Copy **both** of them into your Hotel Architect binaries folder:
   ```
   ...\Hotel Architect\HotelArchitect\Binaries\Win64\
   ```
   `Win64` should now contain a `ue4ss` folder and a `dwmapi.dll`, sitting alongside the game's own files. Copy the `ue4ss` folder itself — not its contents.

6. Open `Win64\ue4ss\UE4SS-settings.ini` and set:
   ```
   bUseUObjectArrayCache = true
   ```

If a future Hotel Architect update breaks the mod, a newer `experimental-latest` build is the first thing to try.

### Part 2 — Lua Mod Setup

1. The `Mods` folder already exists and holds UE4SS's own built-in mods. Create your folders alongside them — don't remove anything that's already in there:
   ```
   Win64\ue4ss\Mods\TwitchMod\Scripts\
   ```

2. Copy `main.lua` from this repo into the `Scripts` folder:
   ```
   Win64\ue4ss\Mods\TwitchMod\Scripts\main.lua
   ```

3. The bot will automatically create data files in the `TwitchMod` folder the first time it runs — you do not need to create these manually:
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

4. Enable the mod in **both** mod list files in `Win64\ue4ss\Mods\`. Current UE4SS builds ship a
   `mods.json` as well as a `mods.txt`, and they should agree with each other.

   In `mods.txt`, add this line underneath `BPModLoaderMod : 1`:
   ```
   TwitchMod : 1
   ```
   Leave `Keybinds : 1` at the bottom; the file's own comment says not to move it up.

   In `mods.json`, add this block directly **before** the `Keybinds` entry:
   ```json
       {
           "mod_name": "TwitchMod",
           "mod_enabled": true
       },
   ```
   Note the commas: your new block ends with `},` while the `Keybinds` block after it still ends
   with a plain `}` before the closing `]`.

5. **Update the path in `main.lua`** — open the file and change the `MOD_DIR` at the top to match your installation:
   ```lua
   local MOD_DIR = "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Hotel Architect\\HotelArchitect\\Binaries\\Win64\\ue4ss\\Mods\\TwitchMod\\"
   ```
   If your Steam library is on a different drive or folder, update this path accordingly.

### Part 3 — Twitch Bot Setup

1. Create a folder on your PC, e.g. `C:\TwitchBot\`

2. Copy `bot.js` from this repo into that folder

3. Open a command prompt in that folder (click the address bar in Explorer, type `cmd`, press Enter) and run:
   ```
   npm install tmi.js
   ```

4. **Get a Twitch OAuth token:**
   - Go to [twitchtokengenerator.com](https://twitchtokengenerator.com)
   - Log in with your Twitch account
   - Copy the **Access Token**

5. **Update the config at the top of `bot.js`:**
   ```javascript
   const TWITCH_CHANNEL = 'YOUR_CHANNEL_NAME'; // your Twitch username (lowercase)
   const BOT_USERNAME = 'YOUR_CHANNEL_NAME';   // same as above
   ```
   And update the password line:
   ```javascript
   password: 'oauth:YOUR_ACCESS_TOKEN_HERE'
   ```

6. **Update the `MOD_DIR` path in `bot.js`** to match your installation (same path as in `main.lua`):
   ```javascript
   const MOD_DIR = 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Hotel Architect\\HotelArchitect\\Binaries\\Win64\\ue4ss\\Mods\\TwitchMod\\';
   ```

---

## Running the Mod

Every time you stream:

1. **Start the bot** — open a command prompt in `C:\TwitchBot\` and run:
   ```
   node bot.js
   ```
2. **Start Hotel Architect** and load your save

That's it! The mod hooks load automatically with the game. Viewers can now type `!visit` or `!staff` in your chat.

**Order matters.** Start the bot first, then the game. And if you restart the bot mid-session, restart Hotel Architect too — the bot clears the shared text files on startup while the running game mod keeps its own place in them, so they fall out of sync and commands appear to stop working.

---

## Troubleshooting

**Nothing gets renamed, and the log repeats "Scan failed"**

The bot gives no hint about this one. It still connects to Twitch and answers commands, so the
setup looks fine until you notice nobody is being renamed.

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
*stable* release instead of `experimental-latest`. UE4SS never finishes starting up, so `main.lua`
never loads and no hooks are ever registered.

**Fix:** redo [Part 1](#part-1--ue4ss-setup) using the `experimental-latest` build.

The retrying stops on its own after `SecondsToScanBeforeGivingUp` seconds, 120 by default.

**The UE4SS console window doesn't appear**

Some builds start without a visible console. Everything still goes to the log:
```
...\Binaries\Win64\ue4ss\UE4SS.log
```
Open it in Notepad and search for `TwitchMod`. If the file's "Date modified" matches your last
launch, UE4SS is loading fine.

**Bot connects but `!visit` does nothing**
- Make sure the bot is running (`node bot.js`) and shows "Connected to #yourchannel"
- Check that the `MOD_DIR` path in `bot.js` is correct

**Guests aren't being renamed**
- Check `UE4SS.log` for `[TwitchMod] Loaded. Waiting for guests, staff, and arcade events...`
- Check that `TwitchMod` is enabled in **both** `mods.txt` and `mods.json`
- Check that the `MOD_DIR` path in `main.lua` is correct. It's a *second, separate copy* of the path you set in `bot.js` — updating one and forgetting the other produces exactly this symptom, because the bot writes to the real folder while the mod reads one that isn't there

**"Command not found" errors in UE4SS**
- Make sure `main.lua` is inside the `Scripts` subfolder, not directly in `TwitchMod`
- Make sure the filename is exactly `main.lua` and not `main.lua.txt` (Windows may hide the `.txt` extension)

---

## File Structure Reference

```
Hotel Architect\HotelArchitect\Binaries\Win64\
├── dwmapi.dll                     ← UE4SS loader
├── ue4ss\
│   ├── Mods\
│   │   ├── mods.txt               ← add "TwitchMod : 1" here
│   │   ├── mods.json              ← add the TwitchMod block here too
│   │   ├── ...                    ← UE4SS's built-in mods
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
│   │       └── staffquit.txt      ← staff quit requests (written by bot)
│   ├── UE4SS-settings.ini
│   └── UE4SS.log                  ← check here first when something goes wrong
│
C:\TwitchBot\
├── bot.js                         ← the Twitch bot
├── scores.json                    ← persistent all-time arcade leaderboard
├── package.json
├── package-lock.json
└── node_modules\
```

---

## Credits

Built with [UE4SS](https://github.com/UE4SS-RE/RE-UE4SS) and [tmi.js](https://github.com/tmijs/tmi.js).
