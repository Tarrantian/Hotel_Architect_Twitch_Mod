local MOD_DIR = "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Hotel Architect\\HotelArchitect\\Binaries\\Win64\\ue4ss\\Mods\\TwitchMod\\"
local QUEUE_FILE = MOD_DIR .. "twitchqueue.txt"
local ASSIGNED_FILE = MOD_DIR .. "assigned.txt"
local CHECKEDOUT_FILE = MOD_DIR .. "checkedout.txt"
local STAFF_QUEUE_FILE = MOD_DIR .. "staffqueue.txt"
local STAFF_ASSIGNED_FILE = MOD_DIR .. "staffassigned.txt"

local ARCADE_DONE_FILE = MOD_DIR .. "arcadedone.txt"
local STAFF_QUIT_FILE = MOD_DIR .. "staffquit.txt"

local STAFF_POLL_INTERVAL = 3000 -- ms between staff queue checks
local ARCADE_CHECK_INTERVAL = 2000 -- ms between arcade detection checks

-- Random placeholder names for staff reset between streams
local PLACEHOLDER_NAMES = {
    "Gerald", "Beatrice", "Mortimer", "Prudence", "Humphrey",
    "Mildred", "Archibald", "Gertrude", "Reginald", "Edith",
    "Cornelius", "Bernadette", "Percival", "Henrietta", "Barnaby",
    "Winifred", "Clarence", "Dorothea", "Aloysius", "Millicent",
    "Bartholomew", "Eugenia", "Thaddeus", "Cordelia", "Ignatius",
    "Josephine", "Leopold", "Rosalind", "Ferdinand", "Clementine",
}

-- Maps CharacterIdentifier -> twitchName for checked-in guests
local activeGuests = {}

-- Track how far through the queue file we've consumed
local queueIndex = 0

-- Staff: track which staff have been renamed (by GetFullName key)
local renamedStaff = {}
local staffQueueIndex = 0
local staffQuitIndex = 0

-- Arcade: track Twitch guests currently playing arcade (by name)
local guestsAtArcade = {}

local function readLines(path)
    local file = io.open(path, "r")
    if not file then return {} end
    local lines = {}
    for line in file:lines() do
        if line and line ~= "" then table.insert(lines, line) end
    end
    file:close()
    return lines
end

local function appendLine(path, line)
    local file = io.open(path, "a")
    if not file then return end
    file:write(line .. "\n")
    file:close()
end

local function nextInQueue()
    local lines = readLines(QUEUE_FILE)
    local nextIndex = queueIndex + 1
    if nextIndex > #lines then return nil end
    queueIndex = nextIndex
    return lines[nextIndex]
end

local function nextInStaffQueue()
    local lines = readLines(STAFF_QUEUE_FILE)
    local nextIndex = staffQueueIndex + 1
    if nextIndex > #lines then return nil end
    staffQueueIndex = nextIndex
    return lines[nextIndex]
end

-- Count how many staff slots are unclaimed
local function countOpenStaffSlots()
    local chars = FindAllOf("HaStaffCharacter")
    if not chars then return 0 end
    local open = 0
    for _, s in ipairs(chars) do
        local key = s:GetFullName()
        if not renamedStaff[key] then
            open = open + 1
        end
    end
    return open
end

-- Scan all staff and rename any unclaimed ones from the staff queue
local function assignStaffNames()
    local chars = FindAllOf("HaStaffCharacter")
    if not chars then return end
    for _, s in ipairs(chars) do
        local key = s:GetFullName()
        if not renamedStaff[key] then
            local twitchName = nextInStaffQueue()
            if not twitchName then return end
            local oldFirst = s.CharacterData.FirstName:ToString()
            local oldLast = s.CharacterData.LastName:ToString()
            s.CharacterData.FirstName = FText(twitchName)
            s.CharacterData.LastName = FText("")
            renamedStaff[key] = twitchName
            appendLine(STAFF_ASSIGNED_FILE, twitchName)
            print("[TwitchMod] Staff renamed '" .. oldFirst .. " " .. oldLast .. "' -> '" .. twitchName .. "'")
        end
    end
end

-- Write current open slot count to a file so the bot can read it
local function updateOpenSlots()
    local open = countOpenStaffSlots()
    local file = io.open(MOD_DIR .. "staffslots.txt", "w")
    if file then
        file:write(tostring(open))
        file:close()
    end
end

-- Process staff quit requests (written by bot)
local function processStaffQuits()
    local lines = readLines(STAFF_QUIT_FILE)
    while staffQuitIndex < #lines do
        staffQuitIndex = staffQuitIndex + 1
        local quitName = lines[staffQuitIndex]
        -- Find the staff member with this Twitch name and rename to placeholder
        for key, twitchName in pairs(renamedStaff) do
            if twitchName == quitName then
                -- Find the actual character and rename it
                local chars = FindAllOf("HaStaffCharacter")
                if chars then
                    for _, s in ipairs(chars) do
                        if s:GetFullName() == key then
                            local placeholder = PLACEHOLDER_NAMES[(math.random(#PLACEHOLDER_NAMES))]
                            s.CharacterData.FirstName = FText(placeholder)
                            s.CharacterData.LastName = FText("")
                            print("[TwitchMod] Staff '" .. quitName .. "' quit, renamed to '" .. placeholder .. "'")
                            break
                        end
                    end
                end
                renamedStaff[key] = nil
                break
            end
        end
    end
end

-- === GUEST HOOKS ===

RegisterHook("/Script/HotelArchitect.HaBookingManager:CheckinGuest", function(self, guestCharacter)
    local guest = guestCharacter:Get()
    if not guest then return end
    local twitchName = nextInQueue()
    if not twitchName then
        print("[TwitchMod] Queue empty.")
        return
    end
    local id = guest.CharacterIdentifier:ToString()
    activeGuests[id] = twitchName
    guest.CharacterData.FirstName = FText(twitchName)
    guest.CharacterData.LastName = FText("")
    appendLine(ASSIGNED_FILE, twitchName)
    print("[TwitchMod] Assigned '" .. twitchName .. "' to guest " .. id)
end)

RegisterHook("/Script/HotelArchitect.HaBookingManager:CheckoutGuest", function(self, guestCharacter)
    local guest = guestCharacter:Get()
    if not guest then return end
    local id = guest.CharacterIdentifier:ToString()
    local twitchName = activeGuests[id]
    if twitchName then
        activeGuests[id] = nil
        appendLine(CHECKEDOUT_FILE, twitchName)
        print("[TwitchMod] Checked out '" .. twitchName .. "'")
    end
end)

-- === STAFF HOOKS ===

-- When a new staff member is hired, assign from queue
RegisterHook("/Script/HotelArchitect.HaHireStaffInputMode:SpawnCharacter", function(self)
    print("[TwitchMod] New staff hired! Checking staff queue...")
    assignStaffNames()
    updateOpenSlots()
end)

-- Periodically check for new staff queue entries and assign them
LoopAsync(STAFF_POLL_INTERVAL, function()
    processStaffQuits()
    assignStaffNames()
    updateOpenSlots()
    return false -- keep looping
end)

-- === ARCADE DETECTION (polling bIsStarted on ArcadeMachineProgram_C) ===
-- Build a set of active Twitch guest names from activeGuests map
local function getTwitchGuestNames()
    local names = {}
    for _, twitchName in pairs(activeGuests) do
        names[twitchName] = true
    end
    return names
end

-- Find Twitch guests currently playing the arcade (bIsStarted == true)
local function findTwitchGuestsPlayingArcade()
    local playing = {}
    local progs = FindAllOf("HaCharacterProgram")
    if not progs then return playing end
    local twitchNames = getTwitchGuestNames()

    for _, p in ipairs(progs) do
        pcall(function()
            if p:GetFullName():find("Arcade") and p.bIsStarted and not p.bIsFinished then
                local name = p.Character.CharacterData.FirstName:ToString()
                if twitchNames[name] then
                    playing[name] = true
                end
            end
        end)
    end
    return playing
end

-- Compare snapshots: detect who started and who stopped playing
local function checkArcade()
    local currentlyPlaying = findTwitchGuestsPlayingArcade()

    -- Detect new arcade sessions
    for name, _ in pairs(currentlyPlaying) do
        if not guestsAtArcade[name] then
            guestsAtArcade[name] = true
            print("[TwitchMod] Detected " .. name .. " playing arcade!")
        end
    end

    -- Detect finished sessions (were playing, no longer are)
    for name, _ in pairs(guestsAtArcade) do
        if not currentlyPlaying[name] then
            guestsAtArcade[name] = nil
            appendLine(ARCADE_DONE_FILE, name)
            print("[TwitchMod] " .. name .. " finished arcade, reporting score")
        end
    end
end

LoopAsync(ARCADE_CHECK_INTERVAL, function()
    checkArcade()
    return false
end)

-- === STARTUP: Reset existing staff names to placeholders ===
-- Prevents stale Twitch names from a previous stream showing up in-game.
-- These staff remain "unclaimed" (not in renamedStaff) so viewers can claim them with !staff.
local function resetExistingStaffNames()
    local chars = FindAllOf("HaStaffCharacter")
    if not chars then return end
    local count = 0
    for _, s in ipairs(chars) do
        local placeholder = PLACEHOLDER_NAMES[(count % #PLACEHOLDER_NAMES) + 1]
        s.CharacterData.FirstName = FText(placeholder)
        s.CharacterData.LastName = FText("")
        count = count + 1
    end
    if count > 0 then
        print("[TwitchMod] Reset " .. count .. " existing staff to placeholder names")
    end
    updateOpenSlots()
end

resetExistingStaffNames()

print("[TwitchMod] Loaded. Waiting for guests, staff, and arcade events...")

