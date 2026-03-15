const tmi = require('tmi.js');
const fs = require('fs');

// --- CONFIG ---
const TWITCH_CHANNEL = 'YOUR_CHANNEL_NAME'; // your Twitch username (lowercase)
const BOT_USERNAME = 'YOUR_CHANNEL_NAME';   // same as above
const MOD_DIR = 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Hotel Architect\\HotelArchitect\\Binaries\\Win64\\ue4ss\\Mods\\TwitchMod\\';
const POLL_INTERVAL = 1500; // ms between file checks
const SCORES_FILE = './scores.json'; // persistent across streams — NOT cleared on startup
// --------------

// --- CHAT MESSAGES ---
// You can edit these to customize what the bot says in Twitch chat.
// Use {user} for the viewer's name and {pos} for queue position.
const MESSAGES = {
    // !visit — viewer joins the guest queue
    VISIT_JOINED:            "{user} joined the guest queue at position {pos}! 🎟️",
    VISIT_ALREADY_IN_QUEUE:  "{user} you're already in the queue at position {pos}!",
    VISIT_ALREADY_CHECKED_IN:"{user} you're already checked in at the hotel!",
    VISIT_IS_STAFF:          "{user} you're already part of the hotel staff! You can't also be a guest.",

    // !staff — viewer claims a staff slot
    STAFF_APPLYING:          "{user} applying for a job at the hotel... 🧑‍💼",
    STAFF_NO_OPENINGS:       "{user} sorry, no job openings currently! Try again after new hires.",
    STAFF_ALREADY_HIRED:     "{user} you're already working at the hotel!",
    STAFF_IS_GUEST:          "{user} you're already a guest (or in the guest queue)! You can't also be staff.",
    STAFF_QUIT:              "{user} has quit the hotel staff! 👋",
    STAFF_NOT_STAFF:         "{user} you're not on the hotel staff!",

    // Announcements — triggered by the game
    GUEST_CHECKED_IN:        "{user} you just checked into the hotel! 🏨",
    GUEST_CHECKED_OUT:       "{user} has checked out of the hotel! Thanks for your stay! 🧳",
    STAFF_HIRED:             "{user} you've been hired as hotel staff! 🧑‍💼",

    // Arcade — passive detection when a guest plays the arcade machine
    ARCADE_SCORE:            "{user} just scored {pos} on the arcade machine! 🕹️🏆",
    ARCADE_NEW_HIGH_SCORE:   "🚨 NEW ALL-TIME HIGH SCORE! {user} just set the record with {pos}! 🕹️👑",
    ARCADE_PERSONAL_BEST:    "{user} just scored {pos} — a new personal best! 🕹️🔥",
    ARCADE_LEADERBOARD:      "🕹️ All-Time Arcade Top 3: {user}",
    ARCADE_NO_SCORES:        "🕹️ No arcade scores yet! Be the first — check in with !visit and find the arcade!",

    // !queue
    QUEUE_EMPTY:             "The guest queue is empty! Type !visit to get in.",
    QUEUE_LIST:              "Guest queue ({pos}): {user}",  // {pos} = count, {user} = name list

    // !position
    POSITION_IN_QUEUE:       "{user} you're at position {pos} in the guest queue.",
    POSITION_NOT_IN_QUEUE:   "{user} you're not in any queue. Type !visit or !staff to join!",
};
// --- END CHAT MESSAGES ---

// --- File paths (derived from MOD_DIR) ---
const QUEUE_FILE = MOD_DIR + 'twitchqueue.txt';
const ASSIGNED_FILE = MOD_DIR + 'assigned.txt';
const CHECKEDOUT_FILE = MOD_DIR + 'checkedout.txt';
const STAFF_QUEUE_FILE = MOD_DIR + 'staffqueue.txt';
const STAFF_ASSIGNED_FILE = MOD_DIR + 'staffassigned.txt';
const STAFF_SLOTS_FILE = MOD_DIR + 'staffslots.txt';
const ARCADE_DONE_FILE = MOD_DIR + 'arcadedone.txt';
const STAFF_QUIT_FILE = MOD_DIR + 'staffquit.txt';

// Clear all files on startup for a fresh stream
[QUEUE_FILE, ASSIGNED_FILE, CHECKEDOUT_FILE, STAFF_QUEUE_FILE, STAFF_ASSIGNED_FILE, STAFF_SLOTS_FILE, ARCADE_DONE_FILE, STAFF_QUIT_FILE].forEach(f => {
    fs.writeFileSync(f, '', 'utf8');
});

// --- Persistent arcade scores (survives between streams) ---
// Structure: { "Username": bestScore, ... }
let arcadeScores = {};
try {
    arcadeScores = JSON.parse(fs.readFileSync(SCORES_FILE, 'utf8'));
    console.log(`[TwitchBot] Loaded ${Object.keys(arcadeScores).length} arcade score(s) from ${SCORES_FILE}`);
} catch (e) {
    arcadeScores = {};
    console.log('[TwitchBot] No existing scores file — starting fresh leaderboard');
}

function saveScores() {
    fs.writeFileSync(SCORES_FILE, JSON.stringify(arcadeScores, null, 2), 'utf8');
}

function getAllTimeHighScore() {
    let best = 0;
    for (const score of Object.values(arcadeScores)) {
        if (score > best) best = score;
    }
    return best;
}

function getTop3() {
    return Object.entries(arcadeScores)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);
}

// --- Helper: format a message template ---
function msg(template, user, pos) {
    return template.replace('{user}', '@' + user).replace('{pos}', pos || '');
}

// --- In-memory state ---
const queue = [];              // guest queue
const assignedSet = new Set(); // lowercase names currently checked in as guests
const checkedOutSet = new Set();
const staffSet = new Set();    // lowercase names assigned as staff
let pendingStaffApps = 0;      // applications sent to Lua but not yet confirmed

// Track how many lines we've already processed in each file
let assignedOffset = 0;
let checkedOutOffset = 0;
let staffAssignedOffset = 0;
let arcadeDoneOffset = 0;

const client = new tmi.Client({
    identity: {
        username: BOT_USERNAME,
        password: 'oauth:YOUR_ACCESS_TOKEN_HERE' // get from twitchtokengenerator.com // or follow https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/
    },
    channels: [TWITCH_CHANNEL]
});

client.connect();

client.on('connected', () => {
    console.log(`[TwitchBot] Connected to #${TWITCH_CHANNEL}`);
});

// --- Read open staff slots from Lua ---
function getOpenStaffSlots() {
    try {
        const content = fs.readFileSync(STAFF_SLOTS_FILE, 'utf8').trim();
        return parseInt(content, 10) || 0;
    } catch (e) {
        return 0;
    }
}

// --- Poll assigned.txt for new check-ins (written by Lua) ---
function pollAssigned() {
    try {
        const content = fs.readFileSync(ASSIGNED_FILE, 'utf8');
        const lines = content.split('\n').map(l => l.trim()).filter(l => l !== '');
        if (lines.length > assignedOffset) {
            const newNames = lines.slice(assignedOffset);
            newNames.forEach(name => {
                const lower = name.toLowerCase();
                assignedSet.add(lower);
                const idx = queue.findIndex(q => q.toLowerCase() === lower);
                if (idx !== -1) queue.splice(idx, 1);
                say(TWITCH_CHANNEL, msg(MESSAGES.GUEST_CHECKED_IN, name));
                console.log(`[TwitchBot] ${name} checked in`);
            });
            assignedOffset = lines.length;
        }
    } catch (e) { /* file not ready yet */ }
}

// --- Poll checkedout.txt for checkouts (written by Lua) ---
function pollCheckedOut() {
    try {
        const content = fs.readFileSync(CHECKEDOUT_FILE, 'utf8');
        const lines = content.split('\n').map(l => l.trim()).filter(l => l !== '');
        if (lines.length > checkedOutOffset) {
            const newNames = lines.slice(checkedOutOffset);
            newNames.forEach(name => {
                const lower = name.toLowerCase();
                assignedSet.delete(lower);
                checkedOutSet.add(lower);
                say(TWITCH_CHANNEL, msg(MESSAGES.GUEST_CHECKED_OUT, name));
                console.log(`[TwitchBot] ${name} checked out`);
            });
            checkedOutOffset = lines.length;
        }
    } catch (e) { /* file not ready yet */ }
}

// --- Poll staffassigned.txt for new staff assignments (written by Lua) ---
function pollStaffAssigned() {
    try {
        const content = fs.readFileSync(STAFF_ASSIGNED_FILE, 'utf8');
        const lines = content.split('\n').map(l => l.trim()).filter(l => l !== '');
        if (lines.length > staffAssignedOffset) {
            const newEntries = lines.slice(staffAssignedOffset);
            newEntries.forEach(name => {
                const lower = name.toLowerCase();
                staffSet.add(lower);
                pendingStaffApps = Math.max(0, pendingStaffApps - 1);
                say(TWITCH_CHANNEL, msg(MESSAGES.STAFF_HIRED, name));
                console.log(`[TwitchBot] ${name} hired as staff`);
            });
            staffAssignedOffset = lines.length;
        }
    } catch (e) { /* file not ready yet */ }
}

// --- Poll arcadedone.txt for completed arcade sessions (passively detected by Lua) ---
function pollArcadeDone() {
    try {
        const content = fs.readFileSync(ARCADE_DONE_FILE, 'utf8');
        const lines = content.split('\n').map(l => l.trim()).filter(l => l !== '');
        if (lines.length > arcadeDoneOffset) {
            const newNames = lines.slice(arcadeDoneOffset);
            newNames.forEach(name => {
                const previousHighScore = getAllTimeHighScore();
                const score = Math.floor(Math.random() * 999000) + 1000;
                const formatted = score.toLocaleString();

                // Check if this is a personal best
                const prevBest = arcadeScores[name];
                const isPersonalBest = !prevBest || score > prevBest;

                // Update persistent scores
                if (isPersonalBest) {
                    arcadeScores[name] = score;
                    saveScores();
                }

                // Announce: new all-time high > personal best > regular score
                if (score > previousHighScore) {
                    say(TWITCH_CHANNEL, msg(MESSAGES.ARCADE_NEW_HIGH_SCORE, name, formatted));
                } else if (isPersonalBest) {
                    say(TWITCH_CHANNEL, msg(MESSAGES.ARCADE_PERSONAL_BEST, name, formatted));
                } else {
                    say(TWITCH_CHANNEL, msg(MESSAGES.ARCADE_SCORE, name, formatted));
                }
                console.log(`[TwitchBot] ${name} finished arcade with score ${formatted}${isPersonalBest ? ' (NEW PB!)' : ''}`);
            });
            arcadeDoneOffset = lines.length;
        }
    } catch (e) { /* file not ready yet */ }
}

setInterval(() => {
    pollAssigned();
    pollCheckedOut();
    pollStaffAssigned();
    pollArcadeDone();
}, POLL_INTERVAL);

// --- Helper: check if user is in any staff or guest role ---
function isInStaffSystem(usernameLower) {
    return staffSet.has(usernameLower);
}

function isInGuestSystem(usernameLower) {
    return assignedSet.has(usernameLower) || queue.some(q => q.toLowerCase() === usernameLower);
}

// --- Helper: safe wrapper for client.say to prevent unhandled rejections ---
function say(channel, text) {
    client.say(channel, text).catch(err => {
        console.error(`[TwitchBot] Failed to send message: ${err.message}`);
    });
}

// --- Chat commands ---
client.on('message', (channel, tags, message, self) => {
    if (self) return; // ignore the bot's own messages
    const cmd = message.trim().toLowerCase();
    const username = tags['display-name'] || tags.username;
    const usernameLower = username.toLowerCase();

    // !visit command
    if (cmd === '!visit') {
        if (isInStaffSystem(usernameLower)) {
            say(channel, msg(MESSAGES.VISIT_IS_STAFF, username));
            return;
        }

        const inQueue = queue.some(q => q.toLowerCase() === usernameLower);

        if (inQueue) {
            const pos = queue.findIndex(q => q.toLowerCase() === usernameLower) + 1;
            say(channel, msg(MESSAGES.VISIT_ALREADY_IN_QUEUE, username, pos));
            return;
        }

        if (assignedSet.has(usernameLower)) {
            say(channel, msg(MESSAGES.VISIT_ALREADY_CHECKED_IN, username));
            return;
        }

        checkedOutSet.delete(usernameLower);
        queue.push(username);
        fs.appendFileSync(QUEUE_FILE, username + '\n', 'utf8');
        say(channel, msg(MESSAGES.VISIT_JOINED, username, queue.length));
        console.log(`[TwitchBot] Added ${username} to guest queue (position ${queue.length})`);
        return;
    }

    // !staff command
    if (cmd === '!staff') {
        if (isInGuestSystem(usernameLower)) {
            say(channel, msg(MESSAGES.STAFF_IS_GUEST, username));
            return;
        }

        if (staffSet.has(usernameLower)) {
            say(channel, msg(MESSAGES.STAFF_ALREADY_HIRED, username));
            return;
        }

        const openSlots = getOpenStaffSlots() - pendingStaffApps;
        if (openSlots <= 0) {
            say(channel, msg(MESSAGES.STAFF_NO_OPENINGS, username));
            return;
        }

        pendingStaffApps++;
        fs.appendFileSync(STAFF_QUEUE_FILE, username + '\n', 'utf8');
        say(channel, msg(MESSAGES.STAFF_APPLYING, username));
        console.log(`[TwitchBot] ${username} applying for staff`);
        return;
    }

    // !quit command — leave the staff
    if (cmd === '!quit') {
        if (!staffSet.has(usernameLower)) {
            say(channel, msg(MESSAGES.STAFF_NOT_STAFF, username));
            return;
        }

        staffSet.delete(usernameLower);
        fs.appendFileSync(STAFF_QUIT_FILE, username + '\n', 'utf8');
        say(channel, msg(MESSAGES.STAFF_QUIT, username));
        console.log(`[TwitchBot] ${username} quit staff`);
        return;
    }

    // !queue command
    if (cmd === '!queue') {
        if (queue.length === 0) {
            say(channel, MESSAGES.QUEUE_EMPTY);
        } else {
            const preview = queue.slice(0, 5).join(', ');
            const more = queue.length > 5 ? ` (+${queue.length - 5} more)` : '';
            say(channel, msg(MESSAGES.QUEUE_LIST, preview + more, queue.length));
        }
        return;
    }

    // !position command
    if (cmd === '!position') {
        const guestPos = queue.findIndex(q => q.toLowerCase() === usernameLower);
        if (guestPos !== -1) {
            say(channel, msg(MESSAGES.POSITION_IN_QUEUE, username, guestPos + 1));
        } else {
            say(channel, msg(MESSAGES.POSITION_NOT_IN_QUEUE, username));
        }
        return;
    }

    // !arcade command — show all-time top 3 leaderboard
    if (cmd === '!arcade') {
        const top3 = getTop3();
        if (top3.length === 0) {
            say(channel, MESSAGES.ARCADE_NO_SCORES);
        } else {
            const board = top3.map(([name, score], i) => `#${i + 1} ${name} (${score.toLocaleString()})`).join(' | ');
            say(channel, msg(MESSAGES.ARCADE_LEADERBOARD, board));
        }
        return;
    }
});
