using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using HarmonyLib;
using MelonLoader;
using UnityEngine;

namespace HowToFishMenu
{
    // Drives the embedded Advanced Mod Menu engine (Advanced/AdvancedEngine.cs) from inside this menu, so all of its
    // features run with their original code.
    internal static class OldMenu
    {
        public static object Instance;
        public static bool Attached;
        private static Type _type;
        private static bool _patched;
        private static MethodInfo _activate, _valueText, _isEnabled, _reset;
        private static FieldInfo _page, _index, _status, _open;
        private static string _lastStatus;

        // Old-menu names whose feature this menu already has a better version of.
        private static readonly HashSet<string> Skip = new HashSet<string> { "Field of View" };

        // Old page -> this menu's category.
        private static readonly Dictionary<string, string> PageToCategory = new Dictionary<string, string>
        {
            { "Angler", "Player" }, { "Fishing", "Fishing" }, { "Arsenal", "Weapons" }, { "Island", "World" }, { "System", "Visuals" }
        };

        public static Advanced.AdvancedEngine Engine;
        public static bool ExternalFound;

        // Starts the embedded Advanced Mod Menu engine (its exact feature code), and fully silences the separate
        // HowToFishModMenu.dll if it is still installed so nothing runs twice.
        public static void Patch(HarmonyLib.Harmony h)
        {
            if (_patched) return;
            _patched = true;
            const BindingFlags F = BindingFlags.Instance | BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic;

            var external = AppDomain.CurrentDomain.GetAssemblies()
                .Select(a => { try { return a.GetType("HowToFishModMenu.ModMenu", false); } catch { return null; } })
                .FirstOrDefault(t => t != null);
            if (external != null)
            {
                ExternalFound = true;
                Silence(h, external, "KeyDown", nameof(KeyDownPrefix));
                Silence(h, external, "OnUpdate", nameof(Skip0));
                Silence(h, external, "OnGUI", nameof(Skip0));
                MelonLogger.Warning("HowToFishModMenu.dll is still installed. Its features are built into this menu now, so it was switched off. You can delete it.");
            }

            try
            {
                Engine = new Advanced.AdvancedEngine();
                Engine.Init();
            }
            catch (Exception e) { MelonLogger.Error("Advanced engine failed to start: " + e); return; }

            _type = typeof(Advanced.AdvancedEngine);
            Instance = Engine;
            _activate = _type.GetMethod("ActivateSelected", F);
            _valueText = _type.GetMethod("GetValueText", F);
            _isEnabled = _type.GetMethod("IsEnabled", F);
            _reset = _type.GetMethod("ResetEverything", F);
            _page = _type.GetField("_page", F);
            _index = _type.GetField("_selectedIndex", F);
            _status = _type.GetField("_status", F);
            _open = _type.GetField("_menuOpen", F);
        }

        private static void Silence(HarmonyLib.Harmony h, Type t, string method, string prefix)
        {
            const BindingFlags F = BindingFlags.Instance | BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic;
            try { h.Patch(t.GetMethod(method, F), new HarmonyMethod(typeof(OldMenu).GetMethod(prefix, BindingFlags.Static | BindingFlags.NonPublic))); }
            catch (Exception e) { MelonLogger.Warning("Could not switch off HowToFishModMenu." + method + ": " + e.Message); }
        }

        private static bool Skip0() { return false; }

        // Its menu keys (Backspace, Up, Down, Right Shift) never reach it.
        private static bool KeyDownPrefix(int vk, ref bool __result)
        {
            if (vk == 8 || vk == 38 || vk == 40 || vk == 161) { __result = false; return false; }
            return true;
        }

        public static void Shutdown()
        {
            if (Engine != null) { try { Engine.Shutdown(); } catch { } }
        }

        public static void TryBuild()
        {
            if (Attached || Instance == null) return;
            Attached = true;
            const BindingFlags F = BindingFlags.Instance | BindingFlags.NonPublic | BindingFlags.Public;
            var pageType = _type.GetNestedType("Page", BindingFlags.NonPublic | BindingFlags.Public);
            int added = 0;
            foreach (var kv in PageToCategory)
            {
                var field = _type.GetField("_" + kv.Key.ToLowerInvariant() + "Entries", F);
                var arr = field != null ? field.GetValue(Instance) as Array : null;
                var cat = Menu.Categories.FirstOrDefault(c => c.Name == kv.Value);
                if (arr == null || cat == null || pageType == null) continue;
                object page = Enum.Parse(pageType, kv.Key);
                int insertAt = 0;
                for (int i = 0; i < arr.Length; i++)
                {
                    object entry = arr.GetValue(i);
                    string name = (string)entry.GetType().GetField("Name").GetValue(entry);
                    string kind = entry.GetType().GetField("Kind").GetValue(entry).ToString();
                    object feature = entry.GetType().GetField("Feature").GetValue(entry);
                    if (Skip.Contains(name) || kind == "Unavailable" || kind == "Category") continue;
                    cat.Items.Insert(insertAt++, new Bridged { Name = name, Desc = "Advanced Mod Menu feature (original code; works when hosting AND when joining).", Kind = kind, Feature = feature, Page = page, Index = i });
                    added++;
                }
            }
            MelonLogger.Msg("Added " + added + " Advanced Mod Menu options.");
            Menu.OnOldMenuAttached();
        }

        private static bool _logged;
        private static void LogOnce(Exception e)
        {
            if (_logged) return;
            _logged = true;
            MelonLogger.Warning("Advanced engine error: " + e);
        }

        public static void ResetAll()
        {
            if (Instance == null || _reset == null) return;
            try { _reset.Invoke(Instance, null); } catch { }
        }

        public static void Update()
        {
            if (Engine == null) return;
            try { Engine.Tick(); } catch (Exception e) { LogOnce(e); }
            try
            {
                if (_open != null && (bool)_open.GetValue(Instance)) _open.SetValue(Instance, false);
                string s = (string)_status.GetValue(Instance);
                if (s != _lastStatus)
                {
                    if (_lastStatus != null && !string.IsNullOrEmpty(s) && s != "BACKSPACE to open.") Menu.Toast(s);
                    _lastStatus = s;
                }
            }
            catch { }
        }

        internal class Bridged : Entry
        {
            public string Kind;
            public object Feature, Page;
            public int Index;

            public bool On
            {
                get { try { return Kind == "Toggle" && (bool)_isEnabled.Invoke(null, new[] { Feature }); } catch { return false; } }
            }

            public override string ValueText
            {
                get
                {
                    try
                    {
                        if (Kind == "Toggle") return On ? "ON" : "OFF";
                        if (Kind == "Value") return ((string)_valueText.Invoke(Instance, new[] { Feature })).Trim();
                    }
                    catch { }
                    return "";
                }
            }

            public override void Activate()
            {
                try
                {
                    _page.SetValue(Instance, Page);
                    _index.SetValue(Instance, Index);
                    _activate.Invoke(Instance, null);
                }
                catch (Exception e) { Menu.Toast(Name + " failed: " + (e.InnerException ?? e).Message); }
            }

            public override void Step(int dir) { Activate(); }

            public override void Reset() { if (Kind == "Toggle" && On) Activate(); }
        }
    }
}
