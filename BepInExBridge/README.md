# BepInEx Bridge (MelonLoader 0.7.3)

Runs BepInEx 5 plugins inside MelonLoader, without installing BepInEx's own loader.
It loads the real `BepInEx.dll` from `How to Fish\BepInEx\core`, sets up BepInEx's paths, config files and logging
(BepInEx log lines show up in the MelonLoader console), then starts every plugin in `How to Fish\BepInEx\plugins`
the same way BepInEx's chainloader does (as components on a `BepInEx_Manager` object, in dependency order).
The plugin DLLs themselves are not changed.

## Install
```
How to Fish\
  Mods\BepInExBridge.dll            <- this mod (MelonLoader)
  BepInEx\core\BepInEx.dll          <- from BepInEx 5.4.x (plus the other files in core\)
  BepInEx\plugins\<plugin folders>  <- the BepInEx plugins you want
```
Delete BepInEx's own loader files from the game folder if they are there: `winhttp.dll`, `doorstop_config.ini`
(and `.doorstop_version`). Otherwise BepInEx starts too and every plugin loads twice.

Plugin config files are written to `How to Fish\BepInEx\config\` as usual.

## Build
```
mcs -target:library -sdk:4.7.2 -langversion:7 -optimize -out:Mods/BepInExBridge.dll \
  -r:MelonLoader.dll -r:0Harmony.dll -r:BepInEx.dll -r:UnityEngine.CoreModule.dll -r:UnityEngine.dll -r:System.Core.dll BepInExBridge.cs
```
