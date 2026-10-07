#!/usr/bin/env bash
# Builds Mods/HowToFishAimbot.dll with Mono's mcs.
# REFS must contain MelonLoader.dll (0.7.3, net472), 0Harmony.dll and the UnityEngine.*Module.dll files,
# e.g. copied from "How to Fish/MelonLoader/net35|net472" and "How to Fish/How to Fish_Data/Managed".
set -e
REFS="${REFS:-lib}"
mcs -target:library -sdk:4.7.2 -langversion:7 -optimize -out:Mods/HowToFishAimbot.dll \
  -r:"$REFS/MelonLoader.dll" -r:"$REFS/0Harmony.dll" \
  -r:"$REFS/UnityEngine.CoreModule.dll" -r:"$REFS/UnityEngine.IMGUIModule.dll" \
  -r:"$REFS/UnityEngine.PhysicsModule.dll" -r:"$REFS/UnityEngine.TextRenderingModule.dll" \
  -r:System.Core.dll AimbotMod.cs
