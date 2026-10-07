using System;
using System.Collections.Generic;
using System.Linq;
using MelonLoader;
using UnityEngine;

namespace HowToFishMenu
{
    internal static class Visuals
    {
        // Visuals
        public static Toggle Fullbright, NoFog, HideHud, NoShake, Crosshair, FpsCounter, Coords, Speedometer, Clock, ZoomEnabled;
        public static Choice FovChoice, ZoomLevel, RenderDist, CrosshairStyle, CrosshairSize;
        // ESP
        public static Toggle Esp, Boxes, Names, Distance, Health, Tracers, HeadDots, FishEsp, MonsterEsp, BossEsp, PlayerEsp, ItemEsp, Radar, Offscreen, HealthColor;
        public static Choice EspRange, TracerOrigin, RadarRange, BoxStyle;
        // Misc
        public static Toggle VSync, UnlockCursor, StatusPanel;
        public static Choice FpsLimit;

        private static float? _gameFov;
        private static bool _lightSaved;
        private static UnityEngine.Rendering.AmbientMode _ambMode;
        private static Color _ambLight;
        private static float _ambIntensity;
        private static bool _fogSaved, _fog;
        private static float? _farClip;
        private static readonly List<Behaviour> HiddenCanvases = new List<Behaviour>();

        private static float _fps, _fpsTimer;
        private static int _fpsFrames;
        private static Vector3 _lastPos;
        private static float _speed;

        public static void Build()
        {
            Menu.BeginCategory("ESP");
            Esp = Menu.AddToggle("ESP", "Master switch for all ESP below.", false, null, null, Keys.F5, "F5");
            FishEsp = Menu.AddToggle("Fish ESP", "Show fish.", true);
            MonsterEsp = Menu.AddToggle("Monster ESP", "Show non-fish creatures.", true);
            BossEsp = Menu.AddToggle("Boss ESP", "Highlight bosses in red with a BOSS tag.", true);
            PlayerEsp = Menu.AddToggle("Player ESP", "Show other players.", true);
            ItemEsp = Menu.AddToggle("Item ESP", "Show dropped items lying in the world.", false);
            Boxes = Menu.AddToggle("Boxes", "Box around each target.", true);
            BoxStyle = Menu.AddChoice("Box Style", "Full box or corners only.", new float[] { 0, 1 }, 1, labels: new[] { "Full", "Corners" });
            Names = Menu.AddToggle("Names", "Show names.", true);
            Distance = Menu.AddToggle("Distance", "Show distance in meters.", true);
            Health = Menu.AddToggle("Health Bars", "Health bar beside each creature.", true);
            HealthColor = Menu.AddToggle("Color by Health", "Green = healthy, red = almost dead.", false);
            HeadDots = Menu.AddToggle("Head Dots", "Dot on the aimbot's head point.", false);
            Tracers = Menu.AddToggle("Tracers", "Lines from your screen to every target.", false);
            TracerOrigin = Menu.AddChoice("Tracer Origin", "Where tracers start.", new float[] { 0, 1, 2 }, 0, labels: new[] { "Bottom", "Center", "Top" });
            Offscreen = Menu.AddToggle("Off-screen Arrows", "Edge markers for targets behind you.", true);
            EspRange = Menu.AddChoice("ESP Range", "Max ESP distance.", new[] { 300f, 500f, 1000f, 100f, 200f }, 0, "0", "m");
            Radar = Menu.AddToggle("Radar", "Mini radar in the top-left.", false);
            RadarRange = Menu.AddChoice("Radar Range", "Radar radius.", new[] { 75f, 150f, 300f, 40f }, 0, "0", "m");

            Menu.BeginCategory("Visuals");
            FovChoice = Menu.AddChoice("Field of View", "Camera FOV (Game = don't change).", new[] { 0f, 70f, 80f, 90f, 100f, 110f, 120f, 130f, 60f }, 0, "0", "", v => { if (v == 0f) RestoreFov(); });
            FovChoice.Labels = FovChoice.Values.Select(v => v == 0f ? "Game" : v.ToString("0")).ToArray();
            ZoomEnabled = Menu.AddToggle("Zoom [Mouse4]", "Hold mouse side-button (Mouse4) to zoom.", true);
            ZoomLevel = Menu.AddChoice("Zoom Level", "Zoom amount.", new[] { 3f, 2f, 5f, 8f }, 0, "0", "x");
            Fullbright = Menu.AddToggle("Fullbright", "Everything is fully lit, even at night / deep water.", false, v => { if (!v) RestoreLight(); });
            NoFog = Menu.AddToggle("No Fog", "Removes fog (see much further underwater).", false, v => { if (!v) RestoreFog(); });
            RenderDist = Menu.AddChoice("Render Distance", "Camera far clip distance.", new[] { 0f, 1000f, 2000f, 5000f }, 0, "0", "m", v => { if (v == 0f) RestoreClip(); });
            RenderDist.Labels = new[] { "Game", "1000m", "2000m", "5000m" };
            HideHud = Menu.AddToggle("Hide HUD", "Hides the game interface (great for screenshots).", false, v => { if (!v) ShowHud(); });
            NoShake = Menu.AddToggle("No Screen Shake", "Removes camera shake.", false);
            Crosshair = Menu.AddToggle("Custom Crosshair", "Draws a crosshair in the screen center.", false);
            CrosshairStyle = Menu.AddChoice("Crosshair Style", "Crosshair shape.", new float[] { 0, 1, 2 }, 0, labels: new[] { "Cross", "Dot", "Circle" });
            CrosshairSize = Menu.AddChoice("Crosshair Size", "Crosshair size.", new[] { 8f, 5f, 12f, 16f }, 0, "0");
            FpsCounter = Menu.AddToggle("FPS Counter", "Frames per second.", false);
            Coords = Menu.AddToggle("Coordinates", "Your world position.", false);
            Speedometer = Menu.AddToggle("Speedometer", "Your current speed.", false);
            Clock = Menu.AddToggle("Clock", "Real-world time.", false);

            Menu.BeginCategory("Misc");
            FpsLimit = Menu.AddChoice("FPS Limit", "Max frame rate (Game = don't change).", new[] { 0f, 60f, 120f, 144f, 240f, 999f, 30f }, 0, "0", "", v => Application.targetFrameRate = v == 0f ? -1 : (int)v);
            FpsLimit.Labels = new[] { "Game", "60", "120", "144", "240", "Unlimited", "30" };
            VSync = Menu.AddToggle("VSync Off", "Turns off vertical sync.", false, v => QualitySettings.vSyncCount = v ? 0 : 1);
            UnlockCursor = Menu.AddToggle("Unlock Cursor", "Keeps the mouse cursor free.", false);
            StatusPanel = Menu.AddToggle("Status Panel", "Shows what the mod detected (player, camera, creatures, weapon, hooks). Screenshot this if something doesn't work.", true);
            Menu.AddButton("PANIC (turn everything off)", "Instantly disables every mod.", Menu.PanicOff, null, Keys.End, "END");
            Menu.AddButton("Take Screenshot", "Saves a screenshot next to the game exe.", () =>
            {
                string f = "HowToFish_" + DateTime.Now.ToString("yyyyMMdd_HHmmss") + ".png";
                ScreenCapture.CaptureScreenshot(f);
                Menu.Toast("Saved " + f);
            });
            Menu.AddButton("Dump Game Info to Console", "Logs your player's scripts and fields to the MelonLoader console (for troubleshooting).", DumpInfo);
            Menu.AddButton("Refresh Game Objects", "Re-scan creatures/players if something looks stale.", () => { G.ClearCaches(); Look.Reset(); Menu.Toast("Refreshed."); });
            Menu.AddButton("Quit Game", "Closes the game immediately.", Application.Quit);
        }

        public static void Init()
        {
            if (FpsLimit.Value != 0f) Application.targetFrameRate = (int)FpsLimit.Value;
            if (VSync.On) QualitySettings.vSyncCount = 0;
        }

        // ---------- per frame ----------

        public static void Update()
        {
            _fpsFrames++;
            _fpsTimer += Time.unscaledDeltaTime;
            if (_fpsTimer >= 0.5f) { _fps = _fpsFrames / _fpsTimer; _fpsFrames = 0; _fpsTimer = 0; }

            var root = G.LocalRoot;
            if (root != null && Time.deltaTime > 0)
            {
                _speed = Mathf.Lerp(_speed, (root.position - _lastPos).magnitude / Time.deltaTime, 0.2f);
                _lastPos = root.position;
            }

            if (HideHud.On)
                foreach (var ui in G.Find("PlayerUI", 2f))
                {
                    G.Call(ui, "ToggleMainCanvas", false);
                    foreach (var canvas in ui.GetComponentsInChildren<Canvas>(true))
                        if (canvas.enabled) { canvas.enabled = false; HiddenCanvases.Add(canvas); }
                }
        }

        public static void LateUpdate()
        {
            var cam = G.Cam;
            if (cam == null) return;

            ApplyCameraFov();

            if (RenderDist.Value != 0f)
            {
                if (!_farClip.HasValue) _farClip = cam.farClipPlane;
                cam.farClipPlane = RenderDist.Value;
            }

            if (Fullbright.On)
            {
                if (!_lightSaved) { _ambMode = RenderSettings.ambientMode; _ambLight = RenderSettings.ambientLight; _ambIntensity = RenderSettings.ambientIntensity; _lightSaved = true; }
                RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Flat;
                RenderSettings.ambientLight = Color.white;
                RenderSettings.ambientIntensity = 1.5f;
            }
            if (NoFog.On)
            {
                if (!_fogSaved) { _fog = RenderSettings.fog; _fogSaved = true; }
                RenderSettings.fog = false;
            }
            if (UnlockCursor.On) { Cursor.lockState = CursorLockMode.None; Cursor.visible = true; }
        }

        private static Component _fovPc;
        private static float _fovApplied;
        private static float? _pcOrigFov;

        // FOV goes through the game's PlayerCamera (_origFov + SetFov) so the game keeps it; zoom is applied on top.
        public static void ApplyCameraFov()
        {
            var cam = G.Cam;
            if (cam == null) return;
            var pc = G.PlayerCam;
            float want = FovChoice.Value;
            if (pc != null && (pc != _fovPc || want != _fovApplied))
            {
                if (pc != _fovPc) _pcOrigFov = null;
                if (!_pcOrigFov.HasValue) { double o = G.Num(G.Get(pc, "_origFov")); if (!double.IsNaN(o)) _pcOrigFov = (float)o; }
                float target = want != 0f ? want : (_pcOrigFov ?? 0f);
                if (target > 0f)
                {
                    G.Set(pc, "_origFov", target);
                    if (G.Call(pc, "SetFov") == null) G.Call(pc, "SetFOV", target);
                }
                _fovPc = pc; _fovApplied = want;
            }

            bool zoom = ZoomEnabled.On && Keys.Held(Keys.Mouse4) && !Menu.Open;
            if (FovChoice.Value != 0f || zoom)
            {
                if (!_gameFov.HasValue) _gameFov = cam.fieldOfView;
                float baseFov = FovChoice.Value != 0f ? FovChoice.Value : _gameFov.Value;
                cam.fieldOfView = zoom ? baseFov / ZoomLevel.Value : baseFov;
            }
            else RestoreFov();
        }

        private static void RestoreFov()
        {
            var cam = G.Cam;
            if (_gameFov.HasValue && cam != null) cam.fieldOfView = _gameFov.Value;
            _gameFov = null;
        }

        private static void RestoreClip()
        {
            var cam = G.Cam;
            if (_farClip.HasValue && cam != null) cam.farClipPlane = _farClip.Value;
            _farClip = null;
        }

        private static void RestoreLight()
        {
            if (!_lightSaved) return;
            RenderSettings.ambientMode = _ambMode; RenderSettings.ambientLight = _ambLight; RenderSettings.ambientIntensity = _ambIntensity;
            _lightSaved = false;
        }

        private static void RestoreFog()
        {
            if (!_fogSaved) return;
            RenderSettings.fog = _fog;
            _fogSaved = false;
        }

        private static void ShowHud()
        {
            foreach (var ui in G.Find("PlayerUI", 0f)) G.Call(ui, "ToggleMainCanvas", true);
            foreach (var c in HiddenCanvases) if (c != null) c.enabled = true;
            HiddenCanvases.Clear();
        }

        public static void OnSceneLoaded()
        {
            _gameFov = null; _farClip = null; _lightSaved = false; _fogSaved = false;
            HiddenCanvases.Clear();
        }

        // ---------- drawing ----------

        public static void OnGUI(Camera cam)
        {
            var center = new Vector2(Screen.width / 2f, Screen.height / 2f);
            if (cam != null && Esp.On) DrawEsp(cam);
            if (cam != null && Radar.On) DrawRadar(cam);

            if (Crosshair.On)
            {
                float s = CrosshairSize.Value;
                var c = Menu.Accent;
                if (CrosshairStyle.Index == 0)
                {
                    Draw.Rect(new Rect(center.x - s, center.y - 1, s * 2, 2), c);
                    Draw.Rect(new Rect(center.x - 1, center.y - s, 2, s * 2), c);
                }
                else if (CrosshairStyle.Index == 1) Draw.Rect(new Rect(center.x - s / 3f, center.y - s / 3f, s / 1.5f, s / 1.5f), c);
                else Draw.Circle(center, s, c, 24);
            }

            if (StatusPanel.On) DrawStatus(cam);

            float y = Radar.On ? 226f : 26f;
            var info = new List<string>();
            if (FpsCounter.On) info.Add("FPS " + _fps.ToString("0"));
            var root = G.LocalRoot;
            if (Coords.On && root != null) info.Add("XYZ " + root.position.x.ToString("0") + " " + root.position.y.ToString("0") + " " + root.position.z.ToString("0"));
            if (Speedometer.On) info.Add("Speed " + _speed.ToString("0.0") + " m/s");
            if (Clock.On) info.Add(DateTime.Now.ToString("HH:mm:ss"));
            foreach (var line in info) { Draw.Text(new Vector2(10, y), line, Color.white, false, 13); y += 18f; }
        }

        private static void DrawStatus(Camera cam)
        {
            var lp = G.LocalPlayer;
            var pc = G.PlayerCam;
            string[] lines =
            {
                "MOD STATUS (Misc > Status Panel to hide)",
                "Game code: " + (G.Ready && G.T("Creature") != null ? "found" : "NOT FOUND"),
                "Hooks installed: " + Features.PatchCount,
                "Your player: " + (lp != null ? G.Name(lp) : "not found (load into the world)"),
                "Camera: " + (cam != null ? cam.name + (pc != null ? " (PlayerCamera)" : " (fallback)") : "NONE"),
                "Creatures loaded: " + G.Find("Creature").Count,
                "Holding: " + (G.Held("Weapon") != null ? "weapon" : G.Held("FishingRod") != null ? "fishing rod" : "nothing/other"),
                "Aimbot: " + Aimbot.Status,
                "Advanced Mod Menu: " + (OldMenu.Attached ? "linked" : "not installed")
            };
            float w = 330f, h = lines.Length * 16f + 10f;
            var r = new Rect(Screen.width - w - 10f, Screen.height - h - 60f, w, h);
            Draw.Rect(r, new Color(0, 0, 0, 0.6f));
            for (int i = 0; i < lines.Length; i++)
                Draw.Text(new Vector2(r.x + 8, r.y + 5 + i * 16f), lines[i], i == 0 ? Menu.Accent : Color.white, false, 12);
        }

        private class EspTarget { public Component C; public string Label; public Color Color; public bool Creature; public bool Boss; }

        private static void DrawEsp(Camera cam)
        {
            var targets = new List<EspTarget>();
            var bossType = G.T("Boss");
            var playerType = G.T("Player");
            foreach (var c in G.Find("Creature"))
            {
                if (c == null || !c.gameObject.activeInHierarchy || G.IsDead(c)) continue;
                if (playerType != null && c.GetComponentInParent(playerType) != null) continue;
                bool boss = bossType != null && (c.GetComponent(bossType) != null || c.GetComponentInParent(bossType) != null);
                bool fish = !boss && Aimbot.IsFish(c);
                if (boss ? !(BossEsp.On || MonsterEsp.On) : fish ? !FishEsp.On : !MonsterEsp.On) continue;
                targets.Add(new EspTarget { C = c, Label = G.Name(c), Creature = true, Boss = boss && BossEsp.On,
                    Color = boss && BossEsp.On ? new Color(1f, 0.15f, 0.15f) : fish ? new Color(0.3f, 0.8f, 1f) : new Color(1f, 0.6f, 0.15f) });
            }
            if (PlayerEsp.On)
                foreach (var p in G.Find("Player"))
                    if (p != null && p != G.LocalPlayer && p.gameObject.activeInHierarchy)
                        targets.Add(new EspTarget { C = p, Label = G.Name(p), Color = new Color(0.4f, 1f, 0.4f) });
            if (ItemEsp.On)
                foreach (var it in G.Find("Item", 1.5f))
                    if (it != null && it.gameObject.activeInHierarchy && (playerType == null || it.GetComponentInParent(playerType) == null))
                        targets.Add(new EspTarget { C = it, Label = G.Name(it), Color = new Color(1f, 1f, 0.4f) });

            Vector2 origin = new Vector2(Screen.width / 2f, TracerOrigin.Index == 0 ? Screen.height : TracerOrigin.Index == 1 ? Screen.height / 2f : 0f);
            Vector3 camPos = cam.transform.position;

            foreach (var t in targets)
            {
                float dist = Vector3.Distance(camPos, t.C.transform.position);
                if (dist > EspRange.Value) continue;
                Color col = t.Color;
                double hp = double.NaN, max = double.NaN;
                if (t.Creature)
                {
                    hp = G.Num(G.Get(t.C, "Hp"));
                    max = G.Num(G.Get(t.C, "MaxHp"));
                    if (double.IsNaN(max) && !double.IsNaN(hp)) max = Math.Max(hp, 1);
                    if (HealthColor.On && !double.IsNaN(hp) && max > 0) col = Color.Lerp(Color.red, Color.green, (float)(hp / max));
                }
                if (t.C == Aimbot.Target) col = Color.magenta;

                Bounds b;
                Rect r;
                bool onScreen = G.Bounds(t.C, out b) ? Draw.ScreenBox(cam, b, out r) : BoxFromPoint(cam, t.C.transform.position, out r);
                if (!onScreen || r.xMax < 0 || r.x > Screen.width || r.yMax < 0 || r.y > Screen.height)
                {
                    if (Offscreen.On) DrawEdge(cam, t.C.transform.position, col);
                    continue;
                }

                if (Boxes.On)
                {
                    if (BoxStyle.Index == 0) Draw.Box(r, col);
                    else Corners(r, col);
                }
                if (Tracers.On) Draw.Line(origin, new Vector2(r.center.x, r.yMax), new Color(col.r, col.g, col.b, 0.6f), 1f);
                if (HeadDots.On && t.Creature)
                {
                    Vector2 hs;
                    if (Draw.ToScreen(cam, Aimbot.HeadPoint(t.C, 0), out hs)) Draw.Rect(new Rect(hs.x - 2.5f, hs.y - 2.5f, 5, 5), Color.red);
                }
                if (Health.On && t.Creature && !double.IsNaN(hp) && max > 0)
                {
                    float frac = Mathf.Clamp01((float)(hp / max));
                    var bar = new Rect(r.x - 6, r.y, 3, r.height);
                    Draw.Rect(bar, new Color(0, 0, 0, 0.6f));
                    Draw.Rect(new Rect(bar.x, bar.yMax - bar.height * frac, 3, bar.height * frac), Color.Lerp(Color.red, Color.green, frac));
                }
                string label = "";
                if (Names.On) label = (t.Boss ? "[BOSS] " : "") + t.Label;
                if (Distance.On) label += (label.Length > 0 ? " " : "") + "[" + dist.ToString("0") + "m]";
                if (label.Length > 0) Draw.Text(new Vector2(r.center.x, r.y - 16), label, col, true, 11);
            }
        }

        private static bool BoxFromPoint(Camera cam, Vector3 p, out Rect r)
        {
            Vector2 s;
            r = new Rect();
            if (!Draw.ToScreen(cam, p, out s)) return false;
            r = new Rect(s.x - 10, s.y - 10, 20, 20);
            return true;
        }

        private static void Corners(Rect r, Color c)
        {
            float w = r.width / 4f, h = r.height / 4f, t = 1.5f;
            Draw.Rect(new Rect(r.x, r.y, w, t), c); Draw.Rect(new Rect(r.x, r.y, t, h), c);
            Draw.Rect(new Rect(r.xMax - w, r.y, w, t), c); Draw.Rect(new Rect(r.xMax - t, r.y, t, h), c);
            Draw.Rect(new Rect(r.x, r.yMax - t, w, t), c); Draw.Rect(new Rect(r.x, r.yMax - h, t, h), c);
            Draw.Rect(new Rect(r.xMax - w, r.yMax - t, w, t), c); Draw.Rect(new Rect(r.xMax - t, r.yMax - h, t, h), c);
        }

        private static void DrawEdge(Camera cam, Vector3 world, Color c)
        {
            Vector3 local = cam.transform.InverseTransformPoint(world);
            Vector2 dir = new Vector2(local.x, -local.y);
            if (dir.sqrMagnitude < 0.0001f) dir = new Vector2(0, 1);
            dir.Normalize();
            var center = new Vector2(Screen.width / 2f, Screen.height / 2f);
            float radius = Mathf.Min(Screen.width, Screen.height) * 0.42f;
            Vector2 p = center + dir * radius;
            Draw.Rect(new Rect(p.x - 4, p.y - 4, 8, 8), new Color(c.r, c.g, c.b, 0.85f));
        }

        private static void DrawRadar(Camera cam)
        {
            var rect = new Rect(10, 26, 190, 190);
            Draw.Rect(rect, new Color(0, 0, 0, 0.55f));
            Draw.Box(rect, Menu.Accent, 1f);
            var c = rect.center;
            Draw.Rect(new Rect(c.x - 0.5f, rect.y, 1, rect.height), new Color(1, 1, 1, 0.15f));
            Draw.Rect(new Rect(rect.x, c.y - 0.5f, rect.width, 1), new Color(1, 1, 1, 0.15f));
            Draw.Rect(new Rect(c.x - 3, c.y - 3, 6, 6), Color.white);

            float yaw = cam.transform.eulerAngles.y * Mathf.Deg2Rad;
            Vector3 me = cam.transform.position;
            float scale = (rect.width / 2f) / RadarRange.Value;
            Action<Vector3, Color, float> dot = (pos, col, size) =>
            {
                Vector3 d = pos - me;
                float x = d.x * Mathf.Cos(yaw) - d.z * Mathf.Sin(yaw);
                float z = d.x * Mathf.Sin(yaw) + d.z * Mathf.Cos(yaw);
                var p = new Vector2(c.x + x * scale, c.y - z * scale);
                if (!rect.Contains(p)) return;
                Draw.Rect(new Rect(p.x - size / 2f, p.y - size / 2f, size, size), col);
            };
            var bossType = G.T("Boss");
            foreach (var cr in G.Find("Creature"))
            {
                if (cr == null || G.IsDead(cr) || !cr.gameObject.activeInHierarchy) continue;
                bool boss = bossType != null && cr.GetComponentInParent(bossType) != null;
                dot(cr.transform.position, boss ? Color.red : Aimbot.IsFish(cr) ? new Color(0.3f, 0.8f, 1f) : new Color(1f, 0.6f, 0.15f), boss ? 7f : 4f);
            }
            foreach (var p in G.Find("Player"))
                if (p != null && p != G.LocalPlayer) dot(p.transform.position, Color.green, 6f);
        }

        private static void DumpInfo()
        {
            var root = G.LocalRoot;
            if (root == null) { Menu.Toast("Local player not found."); return; }
            MelonLogger.Msg("===== Local player: " + root.name + " =====");
            foreach (var mb in root.GetComponentsInChildren<MonoBehaviour>(true))
            {
                if (mb == null || mb.GetType().Assembly != G.Asm) continue;
                var fields = mb.GetType().GetFields(G.Inst).Where(f => f.FieldType.IsPrimitive || f.FieldType == typeof(Vector2) || f.FieldType == typeof(Vector3));
                MelonLogger.Msg(mb.GetType().Name + " @ " + mb.gameObject.name + ": " + string.Join(", ", fields.Select(f => { object v; try { v = f.GetValue(mb); } catch { v = "?"; } return f.Name + "=" + v; }).ToArray()));
            }
            var cam = G.Cam;
            MelonLogger.Msg("Camera: " + (cam != null ? cam.name + " parent=" + (cam.transform.parent != null ? cam.transform.parent.name : "none") : "none"));
            MelonLogger.Msg("Creatures: " + G.Find("Creature", 0f).Count + ", Players: " + G.Find("Player", 0f).Count + ", Weapons: " + G.Find("Weapon", 0f).Count + ", Server: " + G.IsServer);
            Menu.Toast("Dumped to MelonLoader console.");
        }
    }
}
