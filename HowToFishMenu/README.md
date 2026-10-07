# How to Fish Mod Menu (MelonLoader 0.7.3)

About 140 options in 11 categories. Press **BACKSPACE** to open the menu.

## Install
1. Install MelonLoader 0.7.3 on How to Fish.
2. Copy `Mods/HowToFishMenu.dll` into `How to Fish\Mods\`.
3. **Keep** `HowToFishModMenu.dll` (the Advanced Mod Menu) in the same folder. This menu links to it: all of its features
   (GodMode, Keep Inventory, Auto-Perfect Reel, Guaranteed Rare, Infinite Money, Sell Price, Rig Casino, Unlock All Islands,
   Unlock All Skins, Island/Friend teleports, Boss Health, ...) appear inside this menu, and its own panel stays hidden.
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

## If something doesn't work
The **Status Panel** (bottom-right, on by default, toggle in Misc) shows what the mod detected:
game code, hooks, your player, the camera, loaded creatures, what you're holding, aimbot state, and whether the Advanced Mod Menu is linked.
Send a screenshot of it plus `How to Fish\MelonLoader\Latest.log`.

## Notes
- Settings save to `UserData/MelonPreferences.cfg` (`[HowToFishMenu]`). Fly, Noclip, Freecam, Freeze and Magnet always start off.
- Game classes are found at runtime. The MelonLoader console shows which hooks were patched and which weren't found in your game version.
- If something doesn't work, use **Misc → Dump Game Info to Console** and send the log.
