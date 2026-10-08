# How to Fish Mod Menu (MelonLoader 0.7.3)

About 140 options in 11 categories. Press **BACKSPACE** to open the menu.

## Install
1. Install MelonLoader 0.7.3 on How to Fish.
2. Copy `Mods/HowToFishMenu.dll` into `How to Fish\Mods\`.
3. **Delete** `HowToFishModMenu.dll`. The Advanced Mod Menu's code (by chadi7bark) is built into this DLL
   (`AdvancedEngine.cs`, decompiled from v0.4.46), so all of its features (GodMode, Keep Inventory, Auto-Perfect Reel, Guaranteed Rare,
   Infinite Money, Sell Price, Rig Casino, Unlock All Islands/Skins, Island/Friend teleports, Boss Health, ...) run with their original code.
   If it is still installed it gets switched off automatically.
4. **Remove** `HowToFishAimbot.dll` (its aimbot is built in here).

## Controls
| Key | Action |
|---|---|
| BACKSPACE | Open menu / back / close |
| ↑ ↓ | Move (PageUp/PageDown jump 8) |
| → / ENTER / RIGHT SHIFT | Open category, toggle, run, next value |
| ← | Previous value / back to categories |
| Mouse | Click rows (right-click = previous value) |
| V | Aimbot on/off (or hold, if Aim Key Mode = Hold) |
| F5 | ESP |
| F6 / F7 / F8 | Fly / Noclip / Freecam (WASD, SPACE up, CTRL down, SHIFT fast) |
| F9 | Teleport to crosshair |
| Mouse4 | Zoom (hold) |
| END | PANIC: turn everything off |

## Categories
- **Aimbot**: toggle on V, targets fish and monsters, aims at the head (head bone, or a fish's nose based on swim direction), Neck/Body bones, crosshair/distance/lowest-HP priority, bosses first, FOV, smoothing, prediction, visible-only, sticky target, silent aim, FOV circle, target marker/info, triggerbot (only fires while a gun is out).
- **Weapons**: infinite ammo, no reload, no recoil, no spread, rapid fire, damage multiplier, one-hit kill, full mag on equip.
- **Player**: god mode, never die, damage taken %, no drowning, infinite swim jumps, no sinking, infinite stamina, walk/swim speed, jump height, keep inventory, anti-AFK.
- **Movement**: fly, noclip, freecam (+speeds), infinite jump, jump boost, dash, gravity, game speed, third person, click teleport.
- **Teleport**: crosshair, up/forward/down, 3 save/load slots, spawn, nearest fish/monster, boss, friends, aimbot target, highest point.
- **Fishing**: fast reel, bite delay, instant bite, never lose a fish, no reeling needed, always rare, infinite bait, birds never steal, fish markers.
- **ESP**: fish/monster/boss/player/item ESP, full or corner boxes, names, distance, health bars, color by health, head dots, tracers, off-screen markers, range, radar.
- **Visuals**: FOV, zoom, fullbright, no fog, render distance, hide HUD, no screen shake, custom crosshair, FPS, coordinates, speedometer, clock.
- **World**: free shopping, add money, set money, freeze creatures, creature magnet, bring all creatures, kill all, count creatures.
- **Misc**: FPS limit, VSync, unlock cursor, panic, screenshot, debug dump, refresh, quit.
- **Menu**: opacity, size, color theme, position, notifications, watermark, active-mods list, save, reset all.

Options tagged `<HOST>` only fully work when you host or play solo, because a host decides money, damage and deaths for everyone else.

## Built-in BepInEx mods
The DLL also carries these BepInEx 5 mods inside it, with their original code, plus BepInEx 5.4.23's core for their
configs and logging. Nothing else needs installing:
- **KRAKEN v1.2.1** (INSERT, CTRL+INSERT; hotkeys F5-F11)
- **Fish Menu 2.1.1** (INSERT)
- **How to Fish Local Cheats 1.1.0** (F8)

Turn each one on/off in the **Mods** tab. KRAKEN and Fish Menu both open on INSERT, so turn one off if both pop up.
Their config files are in `How to Fish\UserData\BepInEx\config`. Each mod belongs to its original author.
Building needs those DLLs in `embedded/` (not in git), see `build.sh`.

## Extra Features switch
**Menu → Extra Features** (on by default) shows this menu's own options on top of the Advanced Mod Menu features.
Turn it off and restart the game if something acts weird.

## If something doesn't work
The **Status Panel** (bottom-right, on by default, toggle in Misc) shows what the mod detected:
game code, hooks, your player, the camera, loaded creatures, what you're holding, aimbot state, and whether the Advanced Mod Menu is linked.
Send a screenshot of it plus `How to Fish\MelonLoader\Latest.log`.

## Notes
- Settings save to `UserData/MelonPreferences.cfg` (`[HowToFishMenu]`). Fly, Noclip, Freecam, Freeze and Magnet always start off.
- Game classes are found at runtime. The MelonLoader console shows which hooks were patched and which weren't found in your game version.
- If something doesn't work, use **Misc → Dump Game Info to Console** and send the log.
