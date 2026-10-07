using System;
using MelonLoader;
using UnityEngine;

[assembly: MelonInfo(typeof(HowToFishMenu.Mod), "How to Fish Mod Menu", "2.0.0", "HowToFishMenu")]
[assembly: MelonGame(null, null)]

namespace HowToFishMenu
{
    public class Mod : MelonMod
    {
        private bool _patched;
        private float _nextPatchTry;

        public override void OnInitializeMelon()
        {
            Menu.Init();
            Aimbot.Build();
            Visuals.Build(); // ESP, Visuals, Misc
            Movement.Build(); // Movement, Teleport
            Features.Build(); // Weapons, Player, Fishing, World
            Menu.AddSystemCategory();
            OrderCategories();
            // These would surprise you on the next launch, so they always start off.
            foreach (var t in new[] { Movement.Fly, Movement.Noclip, Movement.Freecam, Features.FreezeCreatures, Features.CreatureMagnet })
            {
                t.On = false;
                t.Pref.Value = false;
            }
            Visuals.Init();
            Movement.ApplyGravity();
            LoggerInstance.Msg("Loaded " + Menu.TotalEntries + " options. Press BACKSPACE to open the menu.");
        }

        private static void OrderCategories()
        {
            string[] order = { "Aimbot", "Weapons", "Player", "Movement", "Teleport", "Fishing", "ESP", "Visuals", "World", "Misc", "Menu" };
            Menu.Categories.Sort((a, b) => Array.IndexOf(order, a.Name).CompareTo(Array.IndexOf(order, b.Name)));
        }

        private void TryPatch()
        {
            if (_patched || Time.unscaledTime < _nextPatchTry) return;
            _nextPatchTry = Time.unscaledTime + 2f;
            if (!G.Ready || G.T("Creature") == null) return;
            _patched = true;
            try { Features.InstallPatches(HarmonyInstance); }
            catch (Exception e) { LoggerInstance.Warning("Patching failed: " + e); }
        }

        public override void OnUpdate()
        {
            Keys.Poll();
            TryPatch();
            Run(Menu.HandleInput);
            if (!_patched) return;
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
                    var cam = Camera.main;
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

        public override void OnSceneWasLoaded(int buildIndex, string sceneName)
        {
            G.ClearCaches();
            Look.Reset();
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
