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
3. If all staff are already claimed: "Sorry, no job openings currently!"
4. When the streamer hires new staff, a slot opens up and viewers can race to claim it
5. A viewer can be a guest or staff, but not both at the same time

**Arcade Leaderboard:**
- When a Twitch guest naturally wanders to the arcade machine in-game, the mod detects it
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

1. Download the latest **UE4SS** release from [github.com/UE4SS-RE/RE-UE4SS/releases](https://github.com/UE4SS-RE/RE-UE4SS/releases)
2. Extract it into your Hotel Architect binaries folder:
   ```
   ...\Hotel Architect\HotelArchitect\Binaries\Win64\
   ```
   You should now have a `ue4ss` folder inside `Win64`.

3. Open `Win64\ue4ss\UE4SS-settings.ini` and set:
   ```
   bUseUObjectArrayCache = true
   ```

### Part 2 — Lua Mod Setup

1. Create this folder structure inside the `ue4ss` folder:
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

4. Open `Win64\ue4ss\Mods\mods.txt` and make sure these are enabled:
   ```
   LuaConsole : 1
   TwitchMod : 1
   ```

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
   const TWITCH_CHANNEL = 'your_channel_name'; // your Twitch username (lowercase)
   const BOT_USERNAME = 'your_channel_name';   // same as above
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

---

## Troubleshooting

**Bot connects but `!visit` does nothing**
- Make sure the bot is running (`node bot.js`) and shows "Connected to #yourchannel"
- Check that the `MOD_DIR` path in `bot.js` is correct

**Guests aren't being renamed**
- Check the UE4SS console for `[TwitchMod] Loaded. Waiting for guests, staff, and arcade events...`
- Check that the `MOD_DIR` path in `main.lua` is correct

**"Command not found" errors in UE4SS**
- Make sure `main.lua` is inside the `Scripts` subfolder, not directly in `TwitchMod`
- Make sure the filename is exactly `main.lua` and not `main.lua.txt` (Windows may hide the `.txt` extension)

---

## File Structure Reference

```
Hotel Architect\HotelArchitect\Binaries\Win64\
├── ue4ss\
│   ├── Mods\
│   │   ├── mods.txt               ← add "TwitchMod : 1" here
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
│   └── UE4SS-settings.ini
│
C:\TwitchBot\
├── bot.js                         ← the Twitch bot
├── scores.json                    ← persistent all-time arcade leaderboard
├── package.json
└── node_modules\
```

---

## Credits

Built with [UE4SS](https://github.com/UE4SS-RE/RE-UE4SS) and [tmi.js](https://github.com/tmijs/tmi.js).
