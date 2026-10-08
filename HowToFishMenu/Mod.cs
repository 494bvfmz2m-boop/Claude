using System;
using MelonLoader;
using UnityEngine;

[assembly: MelonInfo(typeof(HowToFishMenu.Mod), "How to Fish Mod Menu", "2.0.0", "HowToFishMenu")]
[assembly: MelonGame(null, null)]
[assembly: HarmonyDontPatchAll]

namespace HowToFishMenu
{
    public class Mod : MelonMod
    {
        private bool _patched;
        private float _nextPatchTry;

        public override void OnInitializeMelon()
        {
            BepInHost.InstallResolver();
            Step("preferences", Menu.Init);
            Step("aimbot", Aimbot.Build);
            Step("visuals/esp/misc", Visuals.Build);
            Step("movement/teleport", Movement.Build);
            Step("weapons/player/fishing/world", Features.Build);
            Step("embedded mods", BepInHost.BuildMenu);
            Step("menu settings", Menu.AddSystemCategory);
            Step("order", OrderCategories);
            Step("start-off toggles", () =>
            {
                // These would surprise you on the next launch, so they always start off.
                foreach (var t in new[] { Movement.Fly, Movement.Noclip, Movement.Freecam, Features.FreezeCreatures, Features.CreatureMagnet })
                {
                    if (t == null) continue;
                    t.On = false;
                    t.Pref.Value = false;
                }
            });
            Step("visual init", Visuals.Init);
            Step("gravity", Movement.ApplyGravity);
            LoggerInstance.Msg("Loaded " + Menu.TotalEntries + " options. Press BACKSPACE to open the menu.");
        }

        private void Step(string name, Action a)
        {
            try { a(); }
            catch (Exception e) { LoggerInstance.Error("Startup step '" + name + "' failed: " + e); }
        }

        private static void OrderCategories()
        {
            string[] order = { "Aimbot", "Weapons", "Player", "Movement", "Teleport", "Fishing", "ESP", "Visuals", "World", "Mods", "Misc", "Menu" };
            Menu.Categories.Sort((a, b) => Array.IndexOf(order, a.Name).CompareTo(Array.IndexOf(order, b.Name)));
        }

        private void TryPatch()
        {
            if (_patched || Time.unscaledTime < _nextPatchTry) return;
            _nextPatchTry = Time.unscaledTime + 2f;
            if (!G.Ready || G.T("Creature") == null) return;
            _patched = true;
            try { OldMenu.Patch(HarmonyInstance); } catch (Exception e) { LoggerInstance.Warning("Old menu link failed: " + e); }
            if (Menu.ExperimentalOn) InstallExperimental();
            Menu.ExperimentalChanged = v => { if (v) InstallExperimental(); };
        }

        private bool _experimentalInstalled;

        // My own game hooks (weapons, damage, money, ...). Only installed once Experimental Options is turned on.
        private void InstallExperimental()
        {
            if (_experimentalInstalled || !_patched) return;
            _experimentalInstalled = true;
            try { Features.InstallPatches(HarmonyInstance); }
            catch (Exception e) { LoggerInstance.Warning("Patching failed: " + e); }
        }

        public override void OnUpdate()
        {
            Keys.Poll();
            TryPatch();
            Run(Menu.HandleInput);
            if (!_patched) return;
            Run(OldMenu.TryBuild);
            Run(OldMenu.Update);
            Run(Movement.Update);
            Run(Aimbot.Update);
            Run(Features.Update);
            Run(Visuals.Update);
        }

        public override void OnLateUpdate()
        {
            if (!_patched) return;
            Run(Movement.LateUpdate);
            Run(Aimbot.LateUpdate);
            Run(Visuals.LateUpdate);
            Menu.KeepCursorFree();
        }

        public override void OnGUI()
        {
            try
            {
                if (Event.current.type == EventType.Repaint)
                {
                    var cam = G.Cam;
                    if (_patched)
                    {
                        Visuals.OnGUI(cam);
                        Aimbot.OnGUI(cam);
                    }
                    Menu.DrawOverlay();
                }
                Menu.DrawMenu();
            }
            catch (Exception e) { LogOnce("GUI", e); }
        }

        public override void OnLateInitializeMelon()
        {
            Step("embedded BepInEx mods", BepInHost.Start);
        }

        public override void OnDeinitializeMelon()
        {
            OldMenu.Shutdown();
        }

        public override void OnSceneWasLoaded(int buildIndex, string sceneName)
        {
            G.ClearCaches();
            Tweak.ClearAll();
            Movement.OnSceneLoaded();
            Visuals.OnSceneLoaded();
        }

        private static readonly System.Collections.Generic.HashSet<string> Logged = new System.Collections.Generic.HashSet<string>();

        private static void LogOnce(string where, Exception e)
        {
            if (Logged.Add(where + e.GetType().Name)) MelonLogger.Warning(where + ": " + e);
        }

        private static void Run(Action a)
        {
            try { a(); }
            catch (Exception e) { LogOnce(a.Method.Name + a.Method.DeclaringType.Name, e); }
        }
    }
}
