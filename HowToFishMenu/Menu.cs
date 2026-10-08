using System;
using System.Collections.Generic;
using System.Linq;
using MelonLoader;
using UnityEngine;

namespace HowToFishMenu
{
    internal abstract class Entry
    {
        public string Name;
        public string Desc;
        public string Tag; // e.g. "HOST" = only fully works when you host / play solo
        public bool Hidden; // hidden when the Advanced Mod Menu provides the same feature
        public bool Experimental; // only shown (and only active) when Experimental Options is on
        public int Key; // optional hotkey (virtual-key code)
        public string KeyName;
        public abstract string ValueText { get; }
        public virtual void Activate() { }
        public virtual void Step(int dir) { Activate(); }
        public virtual void Reset() { }
    }

    internal class Toggle : Entry
    {
        public bool On;
        public bool Default;
        public Action<bool> Changed;
        public MelonPreferences_Entry<bool> Pref;

        public override string ValueText { get { return On ? "ON" : "OFF"; } }
        public override void Activate() { Set(!On); }
        public override void Step(int dir) { Set(dir > 0); }
        public override void Reset() { Set(Default); }

        public void Set(bool value)
        {
            if (On == value) return;
            On = value;
            if (Pref != null) Pref.Value = value;
            if (Changed != null) { try { Changed(value); } catch (Exception e) { MelonLogger.Warning(Name + ": " + e.Message); } }
            Menu.Toast(Name + (value ? " ON" : " OFF"));
        }
    }

    internal class Choice : Entry
    {
        public float[] Values;
        public string[] Labels;
        public int Index;
        public int DefaultIndex;
        public string Format = "0.##";
        public string Suffix = "";
        public Action<float> Changed;
        public MelonPreferences_Entry<int> Pref;

        public float Value { get { return Values[Index]; } }
        public override string ValueText { get { return Labels != null ? Labels[Index] : Values[Index].ToString(Format) + Suffix; } }
        public override void Activate() { Step(1); }
        public override void Reset() { SetIndex(DefaultIndex); }

        public override void Step(int dir)
        {
            SetIndex(((Index + dir) % Values.Length + Values.Length) % Values.Length);
            Menu.Toast(Name + ": " + ValueText);
        }

        public void SetIndex(int i)
        {
            Index = Mathf.Clamp(i, 0, Values.Length - 1);
            if (Pref != null) Pref.Value = Index;
            if (Changed != null) { try { Changed(Value); } catch (Exception e) { MelonLogger.Warning(Name + ": " + e.Message); } }
        }
    }

    internal class Button : Entry
    {
        public Action Run;
        public override string ValueText { get { return ""; } }
        public override void Activate()
        {
            try { Run(); }
            catch (Exception e) { Menu.Toast(Name + " failed: " + e.Message); MelonLogger.Warning(Name + ": " + e); }
        }
    }

    internal class Category
    {
        public string Name;
        public readonly List<Entry> Items = new List<Entry>();
        public List<Entry> Visible { get { return Items.Where(e => !e.Hidden && (!e.Experimental || Menu.ExperimentalOn)).ToList(); } }
    }

    internal static class Menu
    {
        public static readonly List<Category> Categories = new List<Category>();
        public static bool Open;
        private static int _cat;
        private static int _row;
        private static Vector2 _scroll;
        private static Category _building;
        private static MelonPreferences_Category _prefs;

        private static readonly List<KeyValuePair<string, float>> Toasts = new List<KeyValuePair<string, float>>();

        public static Choice Opacity, Scale, Theme, MenuX;
        public static Toggle Notifications, Watermark, KeybindList, Experimental;
        public static bool ExperimentalOn { get { return Experimental != null && Experimental.On; } }
        public static Action<bool> ExperimentalChanged;

        // Everything added between these calls is experimental.
        private static bool _markExperimental;
        public static void BeginExperimental() { _markExperimental = true; }
        public static void EndExperimental() { _markExperimental = false; }

        public static void MarkExperimental(params Entry[] entries)
        {
            foreach (var e in entries) if (e != null) e.Experimental = true;
        }

        private static CursorLockMode _savedLock;
        private static bool _savedVisible;

        private static readonly Color[] Themes =
        {
            new Color(0.10f, 0.75f, 0.95f), new Color(0.35f, 0.95f, 0.45f), new Color(1f, 0.45f, 0.25f),
            new Color(0.85f, 0.35f, 1f), new Color(1f, 0.85f, 0.2f), new Color(1f, 0.3f, 0.45f)
        };
        private static readonly string[] ThemeNames = { "Ocean", "Lime", "Ember", "Violet", "Gold", "Coral" };

        public static Color Accent { get { return Themes[Theme != null ? Theme.Index : 0]; } }

        public static void Init()
        {
            _prefs = MelonPreferences.CreateCategory("HowToFishMenu", "How to Fish Menu");
        }

        public static void BeginCategory(string name)
        {
            _building = new Category { Name = name };
            Categories.Add(_building);
        }

        private static string PrefKey(string name)
        {
            return _building.Name + "_" + new string(name.Where(char.IsLetterOrDigit).ToArray());
        }

        public static Toggle AddToggle(string name, string desc, bool def = false, Action<bool> changed = null, string tag = null, int key = 0, string keyName = null)
        {
            var t = new Toggle { Name = name, Desc = desc, Default = def, Changed = changed, Tag = tag, Key = key, KeyName = keyName };
            t.Pref = _prefs.CreateEntry(PrefKey(name), def);
            t.Experimental = _markExperimental;
            _building.Items.Add(t);
            if (t.Pref.Value) { t.On = true; }
            return t;
        }

        public static Choice AddChoice(string name, string desc, float[] values, int defIndex, string fmt = "0.##", string suffix = "", Action<float> changed = null, string tag = null, string[] labels = null)
        {
            var c = new Choice { Name = name, Desc = desc, Values = values, DefaultIndex = defIndex, Format = fmt, Suffix = suffix, Changed = changed, Tag = tag, Labels = labels };
            c.Pref = _prefs.CreateEntry(PrefKey(name), defIndex);
            c.Index = Mathf.Clamp(c.Pref.Value, 0, values.Length - 1);
            c.Experimental = _markExperimental;
            _building.Items.Add(c);
            return c;
        }

        public static Button AddButton(string name, string desc, Action run, string tag = null, int key = 0, string keyName = null)
        {
            var b = new Button { Name = name, Desc = desc, Run = run, Tag = tag, Key = key, KeyName = keyName };
            b.Experimental = _markExperimental;
            _building.Items.Add(b);
            return b;
        }

        public static void AddSystemCategory()
        {
            BeginCategory("Menu");
            Opacity = AddChoice("Menu Opacity", "Background opacity of this menu.", new[] { 0.95f, 0.85f, 0.7f, 0.5f }, 0, "0%");
            Scale = AddChoice("Menu Size", "Scale of the menu.", new[] { 1f, 1.15f, 1.3f, 0.85f }, 0, "0.##", "x");
            Theme = AddChoice("Menu Color", "Accent color.", new float[] { 0, 1, 2, 3, 4, 5 }, 0, labels: ThemeNames);
            MenuX = AddChoice("Menu Position", "Where the menu sits on screen.", new float[] { 0, 1, 2 }, 0, labels: new[] { "Left", "Center", "Right" });
            Experimental = AddToggle("Extra Features", "This menu's own extra options (on top of the Advanced Mod Menu features). Turn off and restart the game if something acts weird.", true, v =>
            {
                if (!v)
                    foreach (var c in Categories)
                        foreach (var e in c.Items)
                            if (e.Experimental) e.Reset();
                if (ExperimentalChanged != null) ExperimentalChanged(v);
            });
            Notifications = AddToggle("Notifications", "Small pop-up messages when something changes.", true);
            Watermark = AddToggle("Watermark", "Small menu name in the top-left corner.", true);
            KeybindList = AddToggle("Active Mods List", "List of enabled mods on the right side of the screen.", true);
            AddButton("Save Settings", "Write all settings to UserData/MelonPreferences.cfg now.", () => { MelonPreferences.Save(); Toast("Settings saved."); });
            AddButton("Reset All Mods", "Turn every mod off and every value back to default.", ResetAll);
        }

        public static void ResetAll()
        {
            foreach (var c in Categories)
                foreach (var e in c.Items)
                    if (c.Name != "Menu") e.Reset();
            OldMenu.ResetAll();
            Toast("All mods reset.");
        }

        public static void PanicOff()
        {
            foreach (var c in Categories)
                foreach (var e in c.Items)
                {
                    var t = e as Toggle;
                    if (t != null && c.Name != "Menu") t.Set(false);
                }
            OldMenu.ResetAll();
            Open = false;
            Toast("PANIC: everything turned off.");
        }

        public static void Toast(string msg)
        {
            if (Notifications != null && !Notifications.On) return;
            Toasts.Add(new KeyValuePair<string, float>(msg, Time.unscaledTime + 2.5f));
            if (Toasts.Count > 6) Toasts.RemoveAt(0);
        }

        public static int TotalEntries { get { return Categories.Sum(c => c.Visible.Count); } }

        public static bool IsOn(Entry e)
        {
            var t = e as Toggle;
            if (t != null) return t.On;
            var b = e as OldMenu.Bridged;
            return b != null && b.On;
        }

        private static readonly string[] ReplacedByOldMenu =
        {
            "God Mode", "Keep Inventory", "No Drowning", "Never Lose a Fish", "Infinite Bait", "Birds Never Steal", "Always Rare Variant",
            "Bite Delay", "Fast Reel", "Infinite Ammo", "No Reload", "No Recoil", "No Spread", "Damage Multiplier", "One-Hit Kill",
            "Free Shopping", "Hide HUD", "No Screen Shake", "Teleport to Friend"
        };

        public static void OnOldMenuAttached()
        {
            foreach (var c in Categories)
                foreach (var e in c.Items)
                {
                    if (e is OldMenu.Bridged || Array.IndexOf(ReplacedByOldMenu, e.Name) < 0) continue;
                    e.Hidden = true;
                    e.Reset();
                }
        }

        // ---------- input ----------

        public static void HandleInput()
        {
            if (Keys.Pressed(Keys.Backspace))
            {
                if (!Open) SetOpen(true);
                else if (_row >= 0 && _inside) _inside = false;
                else SetOpen(false);
            }

            // Hotkeys for toggles work with the menu closed.
            foreach (var c in Categories)
                foreach (var e in c.Items)
                {
                    if (e.Key != 0 && !e.Hidden && (!e.Experimental || ExperimentalOn) && Keys.Pressed(e.Key) && !(Open && IsNavKey(e.Key))) e.Activate();
                }

            if (!Open) return;

            if (!_inside)
            {
                if (Keys.Pressed(Keys.Up)) _cat = (_cat + Categories.Count - 1) % Categories.Count;
                if (Keys.Pressed(Keys.Down)) _cat = (_cat + 1) % Categories.Count;
                if (Keys.Pressed(Keys.Right) || Keys.Pressed(Keys.Enter) || Keys.Pressed(Keys.RShift)) { _inside = true; _row = 0; _scroll = Vector2.zero; }
                return;
            }

            var items = Categories[_cat].Visible;
            if (items.Count == 0) { _inside = false; return; }
            _row = Mathf.Clamp(_row, 0, items.Count - 1);
            if (Keys.Pressed(Keys.Up)) { _row = (_row + items.Count - 1) % items.Count; ScrollToRow(); }
            if (Keys.Pressed(Keys.Down)) { _row = (_row + 1) % items.Count; ScrollToRow(); }
            if (Keys.Pressed(Keys.PageUp)) { _row = Mathf.Max(0, _row - 8); ScrollToRow(); }
            if (Keys.Pressed(Keys.PageDown)) { _row = Mathf.Min(items.Count - 1, _row + 8); ScrollToRow(); }
            if (Keys.Pressed(Keys.Enter) || Keys.Pressed(Keys.RShift)) items[_row].Activate();
            if (Keys.Pressed(Keys.Right)) items[_row].Step(1);
            if (Keys.Pressed(Keys.Left))
            {
                if (items[_row] is Button || items[_row] is OldMenu.Bridged) _inside = false;
                else items[_row].Step(-1);
            }
        }

        private static bool IsNavKey(int k)
        {
            return k == Keys.Up || k == Keys.Down || k == Keys.Left || k == Keys.Right || k == Keys.Enter || k == Keys.RShift;
        }

        private static bool _inside;
        private const float RowH = 24f;

        private static void ScrollToRow()
        {
            float y = _row * RowH;
            float view = 440f;
            if (y < _scroll.y) _scroll.y = y;
            if (y + RowH > _scroll.y + view) _scroll.y = y + RowH - view;
        }

        private static void SetOpen(bool open)
        {
            Open = open;
            if (open)
            {
                _savedLock = Cursor.lockState;
                _savedVisible = Cursor.visible;
            }
            else
            {
                Cursor.lockState = _savedLock;
                Cursor.visible = _savedVisible;
                MelonPreferences.Save();
            }
        }

        public static void KeepCursorFree()
        {
            if (!Open) return;
            Cursor.lockState = CursorLockMode.None;
            Cursor.visible = true;
        }

        // ---------- drawing ----------

        private static GUIStyle _title, _row_, _small, _value;

        private static void Styles()
        {
            if (_title != null) return;
            _title = new GUIStyle(GUI.skin.label) { fontSize = 18, fontStyle = FontStyle.Bold, alignment = TextAnchor.MiddleLeft };
            _row_ = new GUIStyle(GUI.skin.label) { fontSize = 14, alignment = TextAnchor.MiddleLeft, wordWrap = false };
            _small = new GUIStyle(GUI.skin.label) { fontSize = 12, wordWrap = true };
            _value = new GUIStyle(GUI.skin.label) { fontSize = 14, fontStyle = FontStyle.Bold, alignment = TextAnchor.MiddleRight };
        }

        public static void DrawOverlay()
        {
            Styles();
            if (Watermark != null && Watermark.On)
                Draw.Text(new Vector2(10, 6), "HOW TO FISH MENU  |  BACKSPACE", Accent, false, 13);

            // Toasts
            float ty = Screen.height - 40f;
            for (int i = Toasts.Count - 1; i >= 0; i--)
            {
                if (Time.unscaledTime > Toasts[i].Value) { Toasts.RemoveAt(i); continue; }
                Draw.Text(new Vector2(Screen.width / 2f, ty), Toasts[i].Key, Color.white, true, 14);
                ty -= 20f;
            }

            if (KeybindList != null && KeybindList.On && !Open)
            {
                float y = 40f;
                foreach (var c in Categories)
                {
                    if (c.Name == "Menu") continue;
                    foreach (var e in c.Items)
                    {
                        if (e.Hidden || !IsOn(e)) continue;
                        Draw.Text(new Vector2(Screen.width - 12f - 200f, y), e.Name + (e.KeyName != null ? " [" + e.KeyName + "]" : ""), Accent, false, 12);
                        y += 16f;
                        if (y > Screen.height * 0.6f) return;
                    }
                }
            }
        }

        public static void DrawMenu()
        {
            if (!Open) return;
            Styles();
            float s = Scale.Value;
            var oldMatrix = GUI.matrix;
            GUI.matrix = Matrix4x4.TRS(Vector3.zero, Quaternion.identity, new Vector3(s, s, 1f));

            float w = 640f, h = 560f;
            float sw = Screen.width / s, sh = Screen.height / s;
            float x = MenuX.Index == 0 ? 30f : MenuX.Index == 1 ? (sw - w) / 2f : sw - w - 30f;
            float y = Mathf.Max(20f, (sh - h) / 2f);
            var bg = new Color(0.05f, 0.06f, 0.08f, Opacity.Value);
            Draw.Rect(new Rect(x, y, w, h), bg);
            Draw.Rect(new Rect(x, y, w, 3f), Accent);

            _title.normal.textColor = Accent;
            GUI.Label(new Rect(x + 14, y + 8, w, 28), "HOW TO FISH // MOD MENU", _title);
            _small.normal.textColor = new Color(0.7f, 0.7f, 0.75f);
            GUI.Label(new Rect(x + 14, y + 34, w - 28, 18), TotalEntries + " options   |   ↑↓ move   → / ENTER select   ← back   BACKSPACE close", _small);

            // Category column
            float cx = x + 10, cy = y + 62;
            for (int i = 0; i < Categories.Count; i++)
            {
                var r = new Rect(cx, cy + i * 30f, 140f, 26f);
                bool sel = i == _cat;
                Draw.Rect(r, sel ? new Color(Accent.r, Accent.g, Accent.b, _inside ? 0.25f : 0.5f) : new Color(1, 1, 1, 0.04f));
                _row_.normal.textColor = sel ? Color.white : new Color(0.8f, 0.8f, 0.85f);
                GUI.Label(new Rect(r.x + 10, r.y, r.width - 10, r.height), Categories[i].Name.ToUpperInvariant() + "  (" + Categories[i].Visible.Count + ")", _row_);
                if (Event.current.type == EventType.MouseDown && r.Contains(Event.current.mousePosition))
                {
                    _cat = i; _inside = true; _row = 0; _scroll = Vector2.zero;
                    Event.current.Use();
                }
            }

            // Items
            var items = Categories[_cat].Visible;
            float ix = x + 160f, iy = y + 62f, iw = w - 170f, ih = 440f;
            _scroll = GUI.BeginScrollView(new Rect(ix, iy, iw, ih), _scroll, new Rect(0, 0, iw - 20f, items.Count * RowH));
            for (int i = 0; i < items.Count; i++)
            {
                var e = items[i];
                var r = new Rect(0, i * RowH, iw - 20f, RowH - 2f);
                bool sel = _inside && i == _row;
                Draw.Rect(r, sel ? new Color(Accent.r, Accent.g, Accent.b, 0.45f) : new Color(1, 1, 1, i % 2 == 0 ? 0.035f : 0.015f));
                _row_.normal.textColor = Color.white;
                string label = e.Name + (e.Tag != null ? "  <" + e.Tag + ">" : "") + (e.KeyName != null ? "  [" + e.KeyName + "]" : "");
                GUI.Label(new Rect(r.x + 8, r.y, r.width - 100, r.height), label, _row_);
                var bridged = e as OldMenu.Bridged;
                bool isToggle = e is Toggle || (bridged != null && bridged.Kind == "Toggle");
                bool isButton = e is Button || (bridged != null && bridged.Kind == "Action");
                bool isChoice = e is Choice || (bridged != null && bridged.Kind == "Value");
                _value.normal.textColor = isToggle ? (IsOn(e) ? new Color(0.3f, 1f, 0.45f) : new Color(1f, 0.4f, 0.4f)) : Accent;
                GUI.Label(new Rect(r.xMax - 110, r.y, 102, r.height), isButton ? "[ RUN ]" : (isChoice ? "< " + e.ValueText + " >" : e.ValueText), _value);

                if (Event.current.type == EventType.MouseDown && r.Contains(Event.current.mousePosition))
                {
                    _inside = true; _row = i;
                    if (Event.current.button == 1) e.Step(-1); else e.Activate();
                    Event.current.Use();
                }
            }
            GUI.EndScrollView();

            // Description
            string desc = _inside && _row < items.Count ? items[_row].Desc : "Pick a category.";
            if (_inside && _row < items.Count && items[_row].Tag == "HOST") desc += "  (Full effect only when you host or play solo.)";
            _small.normal.textColor = new Color(0.85f, 0.85f, 0.9f);
            GUI.Label(new Rect(x + 14, y + h - 52, w - 28, 44), desc, _small);

            GUI.matrix = oldMatrix;
        }
    }
}
