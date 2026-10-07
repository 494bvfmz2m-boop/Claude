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
    // Drives the "Advanced Mod Menu" (HowToFishModMenu.dll) from inside this menu, so all of its
    // features run with its own proven code. Its own Backspace panel is suppressed.
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

        public static void Patch(HarmonyLib.Harmony h)
        {
            if (_patched) return;
            _type = AppDomain.CurrentDomain.GetAssemblies()
                .Select(a => { try { return a.GetType("HowToFishModMenu.ModMenu", false); } catch { return null; } })
                .FirstOrDefault(t => t != null);
            if (_type == null) return;
            _patched = true;
            const BindingFlags F = BindingFlags.Instance | BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic;
            Hook(h, "KeyDown", nameof(KeyDownPrefix), null);
            Hook(h, "OnUpdate", nameof(BlockEdges), nameof(CaptureInstance));
            Hook(h, "OnGUI", nameof(SkipGui), null);
            MelonLogger.Msg("Found the Advanced Mod Menu: its features are now inside this menu.");
            _activate = _type.GetMethod("ActivateSelected", F);
            _valueText = _type.GetMethod("GetValueText", F);
            _isEnabled = _type.GetMethod("IsEnabled", F);
            _reset = _type.GetMethod("ResetEverything", F);
            _page = _type.GetField("_page", F);
            _index = _type.GetField("_selectedIndex", F);
            _status = _type.GetField("_status", F);
            _open = _type.GetField("_menuOpen", F);
        }

        private static void Hook(HarmonyLib.Harmony h, string method, string prefix, string postfix)
        {
            const BindingFlags F = BindingFlags.Instance | BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic;
            try
            {
                var target = _type.GetMethod(method, F);
                var pre = prefix != null ? new HarmonyMethod(typeof(OldMenu).GetMethod(prefix, BindingFlags.Static | BindingFlags.NonPublic)) : null;
                var post = postfix != null ? new HarmonyMethod(typeof(OldMenu).GetMethod(postfix, BindingFlags.Static | BindingFlags.NonPublic)) : null;
                h.Patch(target, pre, post);
            }
            catch (Exception e) { MelonLogger.Warning("Advanced Mod Menu hook " + method + " failed: " + e.Message); }
        }

        // Fallback when the OnUpdate hook can't be installed: find it in MelonLoader's list of loaded mods.
        public static void FindInstance()
        {
            if (Instance != null || _type == null) return;
            try
            {
                foreach (var m in MelonBase.RegisteredMelons)
                    if (m != null && _type.IsInstanceOfType(m)) { Instance = m; break; }
            }
            catch { }
        }

        // Its menu keys (Backspace, Up, Down, Right Shift) never reach it, so its own panel never opens.
        private static bool KeyDownPrefix(int vk, ref bool __result)
        {
            if (vk == 8 || vk == 38 || vk == 40 || vk == 161) { __result = false; return false; }
            return true;
        }

        private static bool SkipGui() { return false; }

        private static FieldInfo[] _wasDown;

        // Pretend its menu keys were already held, so it never sees a fresh press (works even if KeyDown got inlined).
        private static void BlockEdges(object __instance)
        {
            if (_wasDown == null)
                _wasDown = new[] { "_backWasDown", "_upWasDown", "_downWasDown", "_rshiftWasDown" }
                    .Select(n => _type.GetField(n, BindingFlags.Instance | BindingFlags.NonPublic)).Where(f => f != null).ToArray();
            foreach (var f in _wasDown) { try { f.SetValue(__instance, true); } catch { } }
            try { if (_open != null) _open.SetValue(__instance, false); } catch { }
        }

        private static void CaptureInstance(object __instance)
        {
            if (Instance != null) return;
            Instance = __instance;
            try { _open.SetValue(__instance, false); } catch { }
        }

        public static void TryBuild()
        {
            if (Attached) return;
            FindInstance();
            if (Instance == null) return;
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
                    cat.Items.Insert(insertAt++, new Bridged { Name = name, Desc = "From the Advanced Mod Menu (works when hosting AND when joining).", Kind = kind, Feature = feature, Page = page, Index = i });
                    added++;
                }
            }
            MelonLogger.Msg("Added " + added + " Advanced Mod Menu options.");
            Menu.OnOldMenuAttached();
        }

        public static void ResetAll()
        {
            if (Instance == null || _reset == null) return;
            try { _reset.Invoke(Instance, null); } catch { }
        }

        public static void Update()
        {
            if (Instance == null || _status == null) return;
            BlockEdges(Instance);
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
