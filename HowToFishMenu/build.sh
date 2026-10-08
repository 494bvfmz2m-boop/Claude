#!/usr/bin/env bash
# Builds Mods/HowToFishMenu.dll with Mono's mcs.
# REFS must contain MelonLoader.dll (0.7.3, net472), 0Harmony.dll and these UnityEngine.*Module.dll files
# (copy them from "How to Fish/MelonLoader/net35" and "How to Fish/How to Fish_Data/Managed").
# embedded/ holds the BepInEx mods built into the DLL (not in git):
#   BepInEx.dll (BepInEx 5.4.23 core), KRAKEN.dll (HowToFishCustomMenu.dll), FishMenu.dll, HowToFishCheats.dll
set -e
REFS="${REFS:-lib}"
R=""
for m in CoreModule IMGUIModule PhysicsModule TextRenderingModule UIModule ScreenCaptureModule ParticleSystemModule; do
  R="$R -r:$REFS/UnityEngine.$m.dll"
done
RES=""
for f in embedded/*.dll; do RES="$RES -resource:$f,Embedded.$(basename "$f")"; done
mcs -target:library -sdk:4.7.2 -langversion:7 -optimize -out:Mods/HowToFishMenu.dll \
  -r:"$REFS/MelonLoader.dll" -r:"$REFS/0Harmony.dll" -r:embedded/BepInEx.dll -r:$REFS/UnityEngine.dll $R -r:System.Core.dll $RES *.cs
