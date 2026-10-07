#!/usr/bin/env bash
# Builds Mods/HowToFishMenu.dll with Mono's mcs.
# REFS must contain MelonLoader.dll (0.7.3, net35/net472), 0Harmony.dll and these UnityEngine.*Module.dll files
# (copy them from "How to Fish/MelonLoader/net35" and "How to Fish/How to Fish_Data/Managed").
set -e
REFS="${REFS:-lib}"
R=""
for m in CoreModule IMGUIModule PhysicsModule TextRenderingModule UIModule ScreenCaptureModule ParticleSystemModule; do
  R="$R -r:$REFS/UnityEngine.$m.dll"
done
mcs -target:library -sdk:4.7.2 -langversion:7 -optimize -out:Mods/HowToFishMenu.dll \
  -r:"$REFS/MelonLoader.dll" -r:"$REFS/0Harmony.dll" $R -r:System.Core.dll *.cs
