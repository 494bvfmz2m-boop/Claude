using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using MelonLoader;
using UnityEngine;

namespace HowToFishMenu
{
    internal static class Aimbot
    {
        public static Toggle Enabled, VisibleOnly, Sticky, Silent, DrawFov, TargetMarker, BossesFirst, Triggerbot, TargetInfo, IncludeFish, IncludeMonsters;
        public static Choice Mode, Part, Priority, Fov, Smooth, MaxDist, Prediction, TriggerDelay;

        public static Component Target;
        public static string Status = "off";
        public static bool Active;

        private static Quaternion _desired;
        private static bool _hasDesired;
        private static float _nextTrigger;

        // Target velocity tracking for prediction.
        private static Vector3 _lastPos;
        private static float _lastPosTime;
        private static Vector3 _velocity;
        private static Component _velFor;

        public static void Build()
        {
            Menu.BeginCategory("Aimbot");
            Enabled = Menu.AddToggle("Aimbot", "Locks your aim onto the best creature (fish included). Press V to turn on/off.", false, null, null, Keys.V, "V");
            Mode = Menu.AddChoice("Aim Key Mode", "Toggle = press V on/off. Hold = only aims while V is held.", new float[] { 0, 1 }, 0, labels: new[] { "Toggle", "Hold" },
                changed: v => { Enabled.Key = v == 0 ? Keys.V : 0; });
            Enabled.Key = Mode.Index == 0 ? Keys.V : 0;
            Part = Menu.AddChoice("Aim Bone", "Head = headshots (head bone, or the nose of a fish). Body = center mass.", new float[] { 0, 1, 2 }, 0, labels: new[] { "Head", "Neck", "Body" });
            Priority = Menu.AddChoice("Target Priority", "How the next target is picked.", new float[] { 0, 1, 2 }, 0, labels: new[] { "Crosshair", "Distance", "Lowest HP" });
            Fov = Menu.AddChoice("Aim FOV", "Max degrees from crosshair a target can be.", new[] { 15f, 30f, 45f, 60f, 90f, 180f, 5f, 10f }, 1, "0", "°");
            Smooth = Menu.AddChoice("Smoothing", "0 = instant snap. Higher = slower, legit-looking aim.", new[] { 0f, 2f, 5f, 10f, 20f, 35f }, 0, "0");
            MaxDist = Menu.AddChoice("Max Distance", "Ignore targets further than this.", new[] { 300f, 500f, 1000f, 50f, 100f, 200f }, 0, "0", "m");
            Prediction = Menu.AddChoice("Prediction", "Leads moving targets. Higher = more lead (use for slow bullets/harpoons).", new[] { 0f, 0.05f, 0.1f, 0.2f, 0.35f, 0.5f }, 0, "0.00", "s");
            IncludeFish = Menu.AddToggle("Target Fish", "Aimbot/triggerbot also lock onto fish.", true);
            IncludeMonsters = Menu.AddToggle("Target Monsters", "Aimbot/triggerbot lock onto non-fish creatures and bosses.", true);
            BossesFirst = Menu.AddToggle("Bosses First", "Always prefer a boss when one is in range.", true);
            VisibleOnly = Menu.AddToggle("Visible Only", "Skip targets behind walls/terrain (water surfaces are ignored).", false);
            Sticky = Menu.AddToggle("Sticky Target", "Stay on the same target until it dies or leaves range.", true);
            Silent = Menu.AddToggle("Silent Aim", "Shots go to the target's head, but your camera doesn't move.", false);
            DrawFov = Menu.AddToggle("Draw FOV Circle", "Shows the aim FOV on screen.", true);
            TargetMarker = Menu.AddToggle("Target Marker", "Marks the locked target and its aim point.", true);
            TargetInfo = Menu.AddToggle("Target Info", "Shows locked target's name, HP and distance under the crosshair.", true);
            Triggerbot = Menu.AddToggle("Triggerbot", "Fires automatically when your crosshair is on a target.", false);
            TriggerDelay = Menu.AddChoice("Triggerbot Delay", "Time between automatic shots.", new[] { 0.1f, 0.05f, 0.2f, 0.35f, 0.5f }, 0, "0.00", "s");
        }

        // ---------- per frame ----------

        public static void Update()
        {
            Active = Enabled.On && Mode.Index == 0 || Mode.Index == 1 && Keys.Held(Keys.V);
            var cam = G.Cam;
            if (cam == null) { Status = "no camera found"; _hasDesired = false; Target = null; return; }
            if (Menu.Open) { Status = "paused (menu open)"; _hasDesired = false; Target = null; return; }

            if (!Active)
            {
                Status = "off (press V)";
                Target = null;
                _hasDesired = false;
                RunTriggerbot(cam);
                return;
            }

            if (!Sticky.On || !Valid(Target, cam, Fov.Value * 1.5f)) Target = Pick(cam);
            if (Target == null)
            {
                int n = G.Find("Creature").Count;
                Status = n == 0 ? "on - no creatures loaded" : "on - no target in FOV (" + n + " creatures)";
                _hasDesired = false; RunTriggerbot(cam); return;
            }
            Status = "LOCKED " + G.Name(Target);

            TrackVelocity(Target);
            Vector3 dir = AimPoint(Target) - cam.transform.position;
            Quaternion goal = Quaternion.LookRotation(dir);
            _desired = Smooth.Value <= 0f ? goal : Quaternion.Slerp(cam.transform.rotation, goal, 1f - Mathf.Exp(-Time.deltaTime * 60f / Smooth.Value));
            _hasDesired = !Silent.On;

            if (_hasDesired)
            {
                Look.Calibrate(cam);
                Look.Apply(cam, _desired, false);
            }
            RunTriggerbot(cam);
        }

        public static void LateUpdate()
        {
            if (!_hasDesired || !Active || Target == null) return;
            var cam = G.Cam;
            if (cam != null) Look.Apply(cam, _desired, true);
        }

        private static void RunTriggerbot(Camera cam)
        {
            if (!Triggerbot.On || cam == null || Menu.Open || Time.unscaledTime < _nextTrigger || !HoldingWeapon()) return;
            bool onTarget = false;

            if (Target != null && Active && !Silent.On)
            {
                float a = Vector3.Angle(cam.transform.forward, AimPoint(Target) - cam.transform.position);
                onTarget = a < 1.5f;
            }
            if (!onTarget)
            {
                RaycastHit hit;
                var ct = G.T("Creature");
                if (ct != null && Physics.Raycast(cam.transform.position, cam.transform.forward, out hit, MaxDist.Value, ~0, QueryTriggerInteraction.Collide))
                {
                    var c = hit.collider.GetComponentInParent(ct);
                    onTarget = c != null && !G.IsDead(c) && Allowed(c);
                }
            }
            if (onTarget || (Silent.On && Active && Target != null))
            {
                Keys.Click();
                _nextTrigger = Time.unscaledTime + TriggerDelay.Value;
            }
        }

        // ---------- targeting ----------

        private static bool IsBoss(Component c)
        {
            var bt = G.T("Boss");
            return bt != null && (c.GetComponent(bt) != null || c.GetComponentInParent(bt) != null);
        }

        // Fish = a creature that lives in water. Uses the game's own flags when present, otherwise name hints.
        public static bool IsFish(Component c)
        {
            foreach (var n in new[] { "IsFish", "_isFish", "isFish", "IsWaterCreature", "_isUnderwater", "IsUnderwater" })
            {
                object v = G.Get(c, n);
                if (v is bool) return (bool)v;
            }
            if (IsBoss(c)) return false;
            string name = G.Name(c).ToLowerInvariant();
            foreach (var land in new[] { "crab", "bird", "gull", "seagull", "monkey", "spider", "zombie", "golem", "skeleton", "bear", "wolf", "pirate" })
                if (name.Contains(land)) return false;
            return true;
        }

        public static bool Allowed(Component c)
        {
            bool fish = IsFish(c);
            return fish ? IncludeFish.On : IncludeMonsters.On;
        }

        public static bool Valid(Component c, Camera cam, float maxAngle)
        {
            if (c == null || !c.gameObject.activeInHierarchy || G.IsDead(c)) return false;
            if (G.IsLocal(c)) return false;
            var pt = G.T("Player");
            if (pt != null && c.GetComponentInParent(pt) != null) return false; // held / caught
            if (!Allowed(c)) return false;

            Vector3 point = AimPoint(c);
            Vector3 dir = point - cam.transform.position;
            float dist = dir.magnitude;
            if (dist < 0.3f || dist > MaxDist.Value) return false;
            if (Vector3.Angle(cam.transform.forward, dir) > maxAngle) return false;
            if (VisibleOnly.On && !Visible(cam.transform.position, point, c)) return false;
            return true;
        }

        public static bool Visible(Vector3 from, Vector3 to, Component c)
        {
            Vector3 d = to - from;
            float dist = d.magnitude;
            var hits = Physics.RaycastAll(from, d / dist, dist - 0.1f, ~0, QueryTriggerInteraction.Ignore);
            var root = G.LocalRoot;
            foreach (var h in hits)
            {
                var t = h.collider.transform;
                if (t.IsChildOf(c.transform) || c.transform.IsChildOf(t)) continue;
                if (root != null && t.IsChildOf(root)) continue;
                string n = t.gameObject.name.ToLowerInvariant();
                if (n.Contains("water") || n.Contains("ocean") || n.Contains("sea")) continue;
                return false;
            }
            return true;
        }

        private static Component Pick(Camera cam)
        {
            Component best = null;
            float bestScore = float.MaxValue;
            bool bestBoss = false;
            foreach (var c in G.Find("Creature"))
            {
                if (!Valid(c, cam, Fov.Value)) continue;
                Vector3 dir = AimPoint(c) - cam.transform.position;
                float score;
                if (Priority.Index == 1) score = dir.magnitude;
                else if (Priority.Index == 2) { double hp = G.Num(G.Get(c, "Hp"), 1e9); score = (float)hp; }
                else score = Vector3.Angle(cam.transform.forward, dir);

                bool boss = BossesFirst.On && IsBoss(c);
                if (bestBoss && !boss) continue;
                if ((boss && !bestBoss) || score < bestScore)
                {
                    best = c; bestScore = score; bestBoss = boss;
                }
            }
            return best;
        }

        private static void TrackVelocity(Component c)
        {
            var rb = c.GetComponentInChildren<Rigidbody>();
            if (rb != null && !rb.isKinematic) { _velocity = rb.velocity; _velFor = c; return; }
            Vector3 p = c.transform.position;
            if (_velFor == c && Time.time > _lastPosTime)
                _velocity = Vector3.Lerp(_velocity, (p - _lastPos) / (Time.time - _lastPosTime), 0.5f);
            else _velocity = Vector3.zero;
            _velFor = c; _lastPos = p; _lastPosTime = Time.time;
        }

        // ---------- head finding ----------

        private static readonly Dictionary<int, Transform> HeadCache = new Dictionary<int, Transform>();
        private static readonly string[] HeadNames = { "head", "skull", "face", "jaw", "mouth", "eye" };
        private static readonly string[] NeckNames = { "neck", "spine2", "spine_02", "chest", "upperchest" };

        private static Transform FindBone(Component c, string[] names)
        {
            Transform best = null;
            int bestRank = int.MaxValue;
            foreach (var t in c.GetComponentsInChildren<Transform>())
            {
                string n = t.name.ToLowerInvariant();
                for (int i = 0; i < names.Length; i++)
                {
                    if (!n.Contains(names[i]) || n.Contains("end") || n.Contains("top")) continue;
                    if (i < bestRank) { best = t; bestRank = i; }
                }
            }
            return best;
        }

        public static Vector3 AimPoint(Component c)
        {
            Vector3 p = HeadPoint(c, Part.Index);
            if (Prediction.Value > 0f && _velFor == c)
            {
                var cam = G.Cam;
                float dist = cam != null ? Vector3.Distance(cam.transform.position, p) : 0f;
                p += _velocity * Prediction.Value * Mathf.Clamp(dist / 30f, 0.25f, 3f);
            }
            return p;
        }

        public static Vector3 HeadPoint(Component c, int part)
        {
            Bounds b;
            bool hasBounds = G.Bounds(c, out b);
            if (part == 2) return hasBounds ? b.center : c.transform.position;

            int key = c.GetInstanceID() * 4 + part;
            Transform bone;
            if (!HeadCache.TryGetValue(key, out bone) || (bone == null && HeadCache.Count > 4000))
            {
                bone = FindBone(c, part == 0 ? HeadNames : NeckNames);
                if (part == 1 && bone == null) bone = FindBone(c, HeadNames);
                HeadCache[key] = bone;
            }
            if (bone != null) return bone.position;
            if (!hasBounds) return c.transform.position;

            // No bones: fish are long along one local axis and swim head-first, so the head is the front tip.
            Vector3 ext = b.extents;
            Vector3 axis = c.transform.forward;
            float along = Extent(axis, ext);
            foreach (var a in new[] { c.transform.right, c.transform.up })
            {
                float e = Extent(a, ext);
                if (e > along * 1.15f) { axis = a; along = e; }
            }
            bool elongated = along > Mathf.Min(ext.y, Mathf.Min(ext.x, ext.z)) * 1.4f && Mathf.Abs(axis.y) < 0.8f;
            if (elongated)
            {
                Vector3 vel = _velFor == c ? _velocity : Vector3.zero;
                if (vel.sqrMagnitude > 0.04f) { if (Vector3.Dot(axis, vel) < 0) axis = -axis; }
                else if (Vector3.Dot(axis, c.transform.forward) < -0.1f) axis = -axis;
                return b.center + axis * along * (part == 0 ? 0.72f : 0.45f);
            }
            return b.center + Vector3.up * ext.y * (part == 0 ? 0.75f : 0.45f);
        }

        private static float Extent(Vector3 dir, Vector3 ext)
        {
            return Mathf.Abs(dir.x) * ext.x + Mathf.Abs(dir.y) * ext.y + Mathf.Abs(dir.z) * ext.z;
        }

        // Only auto-fire while a gun is out, never while holding the rod / items.
        private static bool HoldingWeapon()
        {
            return G.Held("Weapon") != null;
        }

        // ---------- silent aim / shot redirection (Harmony prefix on Weapon.Shoot) ----------

        private static Quaternion _shotRestore;
        private static bool _restoreAfterShot;

        public static void BeforeShot()
        {
            _restoreAfterShot = false;
            if (!Active || Target == null) return;
            var cam = G.Cam;
            if (cam == null) return;
            Vector3 dir = AimPoint(Target) - cam.transform.position;
            if (dir.sqrMagnitude < 0.0001f) return;
            _shotRestore = cam.transform.rotation;
            _restoreAfterShot = Silent.On;
            cam.transform.rotation = Quaternion.LookRotation(dir);
        }

        public static void AfterShot()
        {
            if (!_restoreAfterShot) return;
            var cam = G.Cam;
            if (cam != null) cam.transform.rotation = _shotRestore;
            _restoreAfterShot = false;
        }

        // ---------- drawing ----------

        public static void OnGUI(Camera cam)
        {
            var center = new Vector2(Screen.width / 2f, Screen.height / 2f);
            if (DrawFov.On && (Enabled.On || Mode.Index == 1) && cam != null)
            {
                float r = Mathf.Tan(Mathf.Min(Fov.Value, 89f) * Mathf.Deg2Rad) / Mathf.Tan(cam.fieldOfView * 0.5f * Mathf.Deg2Rad) * Screen.height / 2f;
                if (Fov.Value < 90f) Draw.Circle(center, r, Active ? new Color(Menu.Accent.r, Menu.Accent.g, Menu.Accent.b, 0.8f) : new Color(1, 1, 1, 0.35f));
            }
            if (Active && Target == null) Draw.Text(center + new Vector2(0, 30), "AIMBOT: " + Status, new Color(1f, 0.85f, 0.3f), true, 13);
            if (Target == null || cam == null) return;

            Vector2 s;
            if (TargetMarker.On && Draw.ToScreen(cam, AimPoint(Target), out s))
            {
                Draw.Rect(new Rect(s.x - 3, s.y - 3, 6, 6), Color.red);
                Draw.Line(center, s, new Color(1, 0.2f, 0.2f, 0.6f), 1f);
            }
            if (TargetInfo.On)
            {
                double hp = G.Num(G.Get(Target, "Hp"));
                double max = G.Num(G.Get(Target, "MaxHp"));
                string hpText = double.IsNaN(hp) ? "" : "  HP " + hp.ToString("0") + (double.IsNaN(max) ? "" : "/" + max.ToString("0"));
                float dist = Vector3.Distance(cam.transform.position, Target.transform.position);
                Draw.Text(center + new Vector2(0, 30), "LOCKED: " + G.Name(Target) + hpText + "  " + dist.ToString("0") + "m" + (IsBoss(Target) ? "  [BOSS]" : ""), new Color(1f, 0.35f, 0.35f), true, 14);
            }
        }
    }

    // Writes aim into the game's own mouse-look fields (found by matching their values to the camera angles),
    // so the aim sticks instead of being overwritten by the game's look script next frame.
    internal static class Look
    {
        private class AngleField
        {
            public object Owner; public FieldInfo Field; public int Comp = -1; public float Sign = 1f;
            public float Get()
            {
                object v = Field.GetValue(Owner);
                if (Comp < 0) return (float)v;
                var vec = (Vector2)v; return Comp == 0 ? vec.x : vec.y;
            }
            public void Set(float value)
            {
                if (Comp < 0) { Field.SetValue(Owner, value); return; }
                var vec = (Vector2)Field.GetValue(Owner);
                if (Comp == 0) vec.x = value; else vec.y = value;
                Field.SetValue(Owner, vec);
            }
        }

        private static readonly List<AngleField> Pitch = new List<AngleField>();
        private static readonly List<AngleField> Yaw = new List<AngleField>();
        private static Component _for;
        private static bool _done;
        private static readonly string[] Hints = { "rot", "pitch", "yaw", "look", "angle", "cam", "xr", "yr", "mouse" };

        public static void Reset() { _done = false; _for = null; Pitch.Clear(); Yaw.Clear(); }

        public static void Calibrate(Camera cam)
        {
            var lp = G.LocalPlayer;
            if (_done && _for == lp) return;
            Vector3 e = cam.transform.rotation.eulerAngles;
            float pitch = Mathf.DeltaAngle(0f, e.x), yaw = e.y;
            if (Mathf.Abs(pitch) < 2f || Mathf.Abs(Mathf.DeltaAngle(0f, yaw)) < 2f) return;

            Pitch.Clear(); Yaw.Clear();
            var comps = new HashSet<Component>();
            if (lp != null) foreach (var c in lp.transform.root.GetComponentsInChildren<MonoBehaviour>(true)) comps.Add(c);
            foreach (var c in cam.GetComponentsInParent<MonoBehaviour>(true)) comps.Add(c);
            var pc = G.PlayerCam;
            if (pc != null) foreach (var c in pc.GetComponentsInParent<MonoBehaviour>(true)) comps.Add(c);

            foreach (var comp in comps)
            {
                if (comp == null || comp.GetType().Assembly != G.Asm) continue;
                foreach (var f in comp.GetType().GetFields(G.Inst))
                {
                    string n = f.Name.ToLowerInvariant();
                    bool lookScript = comp.GetType().Name == "PlayerCamera" || comp.GetType().Name == "PlayerMovement";
                    if (!lookScript && !Hints.Any(h => n.Contains(h))) continue;
                    if (n.Contains("speed") || n.Contains("sens") || n.Contains("min") || n.Contains("max") || n.Contains("clamp") || n.Contains("limit")) continue;
                    if (f.FieldType == typeof(float)) Match(new AngleField { Owner = comp, Field = f }, pitch, yaw);
                    else if (f.FieldType == typeof(Vector2))
                    {
                        Match(new AngleField { Owner = comp, Field = f, Comp = 0 }, pitch, yaw);
                        Match(new AngleField { Owner = comp, Field = f, Comp = 1 }, pitch, yaw);
                    }
                }
            }
            _done = true; _for = lp;
            MelonLogger.Msg("Aim calibration: pitch [" + string.Join(", ", Pitch.Select(a => a.Field.Name).ToArray()) + "] yaw [" + string.Join(", ", Yaw.Select(a => a.Field.Name).ToArray()) + "]");
        }

        private static void Match(AngleField af, float pitch, float yaw)
        {
            float v;
            try { v = af.Get(); } catch { return; }
            bool p = false, y = false;
            if (Mathf.Abs(v - pitch) < 0.5f) { p = true; af.Sign = 1f; }
            else if (Mathf.Abs(v + pitch) < 0.5f) { p = true; af.Sign = -1f; }
            if (Mathf.Abs(Mathf.DeltaAngle(v, yaw)) < 0.5f) y = true;
            if (p && y) return;
            if (p) Pitch.Add(af); else if (y) Yaw.Add(af);
        }

        public static void Apply(Camera cam, Quaternion q, bool setTransforms)
        {
            Vector3 e = q.eulerAngles;
            float pitch = Mathf.DeltaAngle(0f, e.x), yaw = e.y;
            foreach (var f in Pitch) { try { f.Set(pitch * f.Sign); } catch { } }
            foreach (var f in Yaw) { try { float cur = f.Get(); f.Set(cur + Mathf.DeltaAngle(cur, yaw)); } catch { } }
            if (!setTransforms) return;

            var root = G.Body;
            if (root != null && !Movement.FreecamOn)
            {
                Quaternion body = Quaternion.Euler(0f, yaw, 0f);
                var rb = root.GetComponent<Rigidbody>();
                if (rb != null) rb.rotation = body;
                root.rotation = body;
            }
            cam.transform.rotation = q;
        }
    }
}
