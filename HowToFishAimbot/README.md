# How to Fish Aimbot (MelonLoader 0.7.3)

Hold **V** to snap your aim onto the living creature closest to your crosshair. Let go of V to stop.

## Install
1. Install MelonLoader 0.7.3 on How to Fish (same as the Advanced Mod Menu).
2. Copy `Mods/HowToFishAimbot.dll` into `How to Fish\Mods\` (next to `HowToFishModMenu.dll`).
3. Start the game.

## How it works
- Targets: the game's `Creature` objects that are alive, within `AimFov` degrees of the crosshair and within `MaxDistance` meters. It never targets players, and it skips fish you are holding.
- It finds the game's own mouse-look angle fields automatically and writes to them, so the aim sticks. It also patches `Weapon.Shoot`, so each shot fires at the locked target.
- The first time you hold V, the MelonLoader console logs `Aim calibration: ...`. If both lists are empty, aim with the camera pitched a bit up or down and hold V again.

## Settings
These are in `How to Fish\UserData\MelonPreferences.cfg` under `[HowToFishAimbot]`. They appear after the first launch.

| Key | Default | Meaning |
|---|---|---|
| AimFov | 30 | Max degrees from crosshair to pick a target |
| MaxDistance | 250 | Max target distance (m) |
| Smoothing | 0 | 0 = instant snap; 10–20 = smooth |
| RequireLineOfSight | false | Ignore targets behind walls/terrain |
| ToggleMode | false | true = press V to toggle instead of holding |
| ShowIndicator | true | On-screen "AIMBOT: LOCKED" text |
