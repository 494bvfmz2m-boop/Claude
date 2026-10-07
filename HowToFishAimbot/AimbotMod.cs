using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Runtime.InteropServices;
using HarmonyLib;
using MelonLoader;
using UnityEngine;

[assembly: MelonInfo(typeof(HowToFishAimbot.AimbotMod), "How to Fish Aimbot", "1.0.0", "HowToFishAimbot")]
[assembly: MelonGame(null, null)]

namespace HowToFishAimbot
{
    // Hold V to lock the camera onto the living creature closest to your crosshair.
    // Game types (Creature, Player, Weapon, ...) are resolved by reflection, so the mod
    // compiles without the game's Assembly-CSharp.dll.
    public class AimbotMod : MelonMod
    {
        [DllImport("user32.dll")]
        private static extern short GetAsyncKeyState(int vKey);

        private const int VK_V = 0x56;

        private static AimbotMod _instance;

        private MelonPreferences_Category _prefs;
        private MelonPreferences_Entry<float> _aimFov;
        private MelonPreferences_Entry<float> _maxDistance;
        private MelonPreferences_Entry<float> _smoothing;
        private MelonPreferences_Entry<bool> _requireLineOfSight;
        private MelonPreferences_Entry<bool> _toggleMode;
        private MelonPreferences_Entry<bool> _showIndicator;

        private Type _creatureType;
        private Type _playerType;
        private Type _weaponType;
        private Assembly _gameAssembly;
        private bool _resolved;
        private float _nextResolveTry;

        private readonly List<Component> _creatures = new List<Component>();
        private float _nextCreatureScan;

        private Component _localPlayer;
        private float _nextPlayerScan;

        private Component _target;
        private bool _active;
        private bool _keyWasDown;

        // Look-angle fields discovered on the local player's scripts (see Calibrate).
        private readonly List<AngleField> _pitchFields = new List<AngleField>();
        private readonly List<AngleField> _yawFields = new List<AngleField>();
        private bool _calibrated;
        private Component _calibratedFor;

        private Quaternion _desiredRotation;
        private bool _hasDesired;

        public override void OnInitializeMelon()
        {
            _instance = this;
            _prefs = MelonPreferences.CreateCategory("HowToFishAimbot");
            _aimFov = _prefs.CreateEntry("AimFov", 30f, description: "Max angle (degrees) from crosshair for a target to be picked");
            _maxDistance = _prefs.CreateEntry("MaxDistance", 250f, description: "Max target distance in meters");
            _smoothing = _prefs.CreateEntry("Smoothing", 0f, description: "0 = instant snap, higher = slower/smoother aim (try 10-20)");
            _requireLineOfSight = _prefs.CreateEntry("RequireLineOfSight", false, description: "Only target creatures not blocked by walls/terrain");
            _toggleMode = _prefs.CreateEntry("ToggleMode", false, description: "false = hold V, true = press V to toggle on/off");
            _showIndicator = _prefs.CreateEntry("ShowIndicator", true, description: "Show the small AIMBOT text on screen");
            LoggerInstance.Msg("Loaded. Hold V to aim at the nearest creature.");
        }

        // ---------- game type resolution ----------

        private void TryResolve()
        {
            if (_resolved || Time.unscaledTime < _nextResolveTry) return;
            _nextResolveTry = Time.unscaledTime + 2f;

            _gameAssembly = AppDomain.CurrentDomain.GetAssemblies()
                .FirstOrDefault(a => a.GetName().Name == "Assembly-CSharp");
            if (_gameAssembly == null) return;

            _creatureType = _gameAssembly.GetType("Creature");
            _playerType = _gameAssembly.GetType("Player");
            _weaponType = _gameAssembly.GetType("Weapon");
            if (_creatureType == null)
            {
                LoggerInstance.Warning("Creature type not found in Assembly-CSharp; aimbot disabled.");
                _resolved = true;
                return;
            }

            _resolved = true;
            PatchWeaponShoot();
            LoggerInstance.Msg("Game types resolved (Creature" + (_playerType != null ? ", Player" : "") + (_weaponType != null ? ", Weapon" : "") + ").");
        }

        private void PatchWeaponShoot()
        {
            if (_weaponType == null) return;
            var prefix = new HarmonyMethod(typeof(AimbotMod).GetMethod(nameof(ShootPrefix), BindingFlags.Static | BindingFlags.NonPublic));
            foreach (var m in _weaponType.GetMethods(BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly))
            {
                if (m.Name != "Shoot" || m.IsAbstract || m.ContainsGenericParameters) continue;
                try
                {
                    HarmonyInstance.Patch(m, prefix: prefix);
                    LoggerInstance.Msg("Patched Weapon." + m.Name + "(" + string.Join(", ", m.GetParameters().Select(p => p.ParameterType.Name).ToArray()) + ")");
                }
                catch (Exception e)
                {
                    LoggerInstance.Warning("Could not patch Weapon.Shoot: " + e.Message);
                }
            }
        }

        // Snap the camera onto the target right before a shot so the bullet ray uses the aimed direction.
        private static void ShootPrefix()
        {
            var self = _instance;
            if (self == null || !self._active || self._target == null) return;
            var cam = Camera.main;
            if (cam == null) return;
            Vector3 dir = self.AimPoint(self._target) - cam.transform.position;
            if (dir.sqrMagnitude < 0.0001f) return;
            Quaternion q = Quaternion.LookRotation(dir);
            self.ApplyRotation(cam, q, true);
        }

        // ---------- input ----------

        private bool IsAimKeyDown()
        {
            if (!Application.isFocused) return false;
            try { return (GetAsyncKeyState(VK_V) & 0x8000) != 0; }
            catch { return false; }
        }

        private void UpdateActiveState()
        {
            bool down = IsAimKeyDown();
            if (_toggleMode.Value)
            {
                if (down && !_keyWasDown) _active = !_active;
            }
            else
            {
                _active = down;
            }
            _keyWasDown = down;
        }

        // ---------- main loop ----------

        public override void OnUpdate()
        {
            TryResolve();
            UpdateActiveState();

            if (!_active || _creatureType == null)
            {
                _target = null;
                _hasDesired = false;
                return;
            }

            var cam = Camera.main;
            if (cam == null) { _hasDesired = false; return; }

            RefreshLocalPlayer();
            RefreshCreatures();

            if (!IsValidTarget(_target, cam, _aimFov.Value * 2f))
                _target = FindBestTarget(cam);

            if (_target == null) { _hasDesired = false; return; }

            Vector3 dir = AimPoint(_target) - cam.transform.position;
            if (dir.sqrMagnitude < 0.0001f) { _hasDesired = false; return; }

            Quaternion goal = Quaternion.LookRotation(dir);
            float smooth = _smoothing.Value;
            _desiredRotation = smooth <= 0f
                ? goal
                : Quaternion.Slerp(cam.transform.rotation, goal, 1f - Mathf.Exp(-Time.deltaTime * (60f / smooth)));
            _hasDesired = true;

            if (!_calibrated || _calibratedFor != _localPlayer) Calibrate(cam);
            ApplyRotation(cam, _desiredRotation, false);
        }

        public override void OnLateUpdate()
        {
            // Re-apply after the game's own camera scripts ran this frame.
            if (!_active || !_hasDesired) return;
            var cam = Camera.main;
            if (cam == null) return;
            ApplyRotation(cam, _desiredRotation, true);
        }

        public override void OnGUI()
        {
            if (!_showIndicator.Value || !_active) return;
            string text = _target != null ? "AIMBOT: LOCKED (" + CleanName(_target) + ")" : "AIMBOT: searching...";
            var style = new GUIStyle(GUI.skin.label) { fontSize = 16, fontStyle = FontStyle.Bold };
            style.normal.textColor = _target != null ? Color.green : Color.yellow;
            GUI.Label(new Rect(Screen.width / 2f - 150f, Screen.height / 2f + 40f, 300f, 30f), text, style);
        }

        public override void OnSceneWasLoaded(int buildIndex, string sceneName)
        {
            _creatures.Clear();
            _target = null;
            _localPlayer = null;
            _calibrated = false;
            _nextCreatureScan = 0f;
            _nextPlayerScan = 0f;
        }

        // ---------- targets ----------

        private void RefreshCreatures()
        {
            if (Time.unscaledTime < _nextCreatureScan) return;
            _nextCreatureScan = Time.unscaledTime + 0.5f;
            _creatures.Clear();
            foreach (var o in UnityEngine.Object.FindObjectsOfType(_creatureType))
            {
                var c = o as Component;
                if (c != null) _creatures.Add(c);
            }
        }

        private Component FindBestTarget(Camera cam)
        {
            Component best = null;
            float bestAngle = float.MaxValue;
            foreach (var c in _creatures)
            {
                if (!IsValidTarget(c, cam, _aimFov.Value)) continue;
                Vector3 dir = AimPoint(c) - cam.transform.position;
                float angle = Vector3.Angle(cam.transform.forward, dir);
                if (angle < bestAngle)
                {
                    bestAngle = angle;
                    best = c;
                }
            }
            return best;
        }

        private bool IsValidTarget(Component c, Camera cam, float maxAngle)
        {
            if (c == null || !c.gameObject.activeInHierarchy) return false;
            if (IsDead(c)) return false;
            if (_localPlayer != null && c.transform.IsChildOf(_localPlayer.transform.root)) return false;
            if (_playerType != null && c.GetComponentInParent(_playerType) != null) return false; // held/caught items

            Vector3 point = AimPoint(c);
            Vector3 dir = point - cam.transform.position;
            float dist = dir.magnitude;
            if (dist < 0.5f || dist > _maxDistance.Value) return false;
            if (Vector3.Angle(cam.transform.forward, dir) > maxAngle) return false;

            if (_requireLineOfSight.Value)
            {
                RaycastHit hit;
                if (Physics.Raycast(cam.transform.position, dir / dist, out hit, dist - 0.2f, ~0, QueryTriggerInteraction.Ignore))
                {
                    var t = hit.collider.transform;
                    bool isTarget = t.IsChildOf(c.transform) || c.transform.IsChildOf(t);
                    bool isSelf = _localPlayer != null && t.IsChildOf(_localPlayer.transform.root);
                    if (!isTarget && !isSelf) return false;
                }
            }
            return true;
        }

        private Vector3 AimPoint(Component c)
        {
            var col = c.GetComponentInChildren<Collider>();
            if (col != null && col.enabled) return col.bounds.center;
            var r = c.GetComponentInChildren<Renderer>();
            if (r != null) return r.bounds.center;
            return c.transform.position;
        }

        private static readonly Dictionary<Type, MemberInfo> DeadMembers = new Dictionary<Type, MemberInfo>();
        private static readonly Dictionary<Type, MemberInfo> HpMembers = new Dictionary<Type, MemberInfo>();

        private static bool IsDead(Component c)
        {
            try
            {
                object dead = ReadMember(c, DeadMembers, "IsDead", "_isDead", "isDead", "Dead");
                if (dead is bool && (bool)dead) return true;
                object hp = ReadMember(c, HpMembers, "Hp", "_hp", "Health", "_health", "_syncedHp");
                if (hp != null)
                {
                    double v = Convert.ToDouble(UnwrapSyncVar(hp));
                    if (v <= 0) return true;
                }
            }
            catch { }
            return false;
        }

        private static object ReadMember(object obj, Dictionary<Type, MemberInfo> cache, params string[] names)
        {
            Type t = obj.GetType();
            MemberInfo m;
            if (!cache.TryGetValue(t, out m))
            {
                const BindingFlags F = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.FlattenHierarchy;
                foreach (var n in names)
                {
                    var p = t.GetProperty(n, F);
                    if (p != null && p.GetIndexParameters().Length == 0 && p.CanRead) { m = p; break; }
                    var f = t.GetField(n, F);
                    if (f != null) { m = f; break; }
                }
                cache[t] = m;
            }
            if (m == null) return null;
            var pi = m as PropertyInfo;
            return pi != null ? pi.GetValue(obj, null) : ((FieldInfo)m).GetValue(obj);
        }

        // FishNet SyncVar<T> wraps the value in a .Value property.
        private static object UnwrapSyncVar(object o)
        {
            if (o == null || o.GetType().IsPrimitive) return o;
            var p = o.GetType().GetProperty("Value");
            return p != null ? p.GetValue(o, null) : o;
        }

        private static string CleanName(Component c)
        {
            return c == null ? "" : c.gameObject.name.Replace("(Clone)", "").Trim();
        }

        // ---------- local player + camera rotation ----------

        private void RefreshLocalPlayer()
        {
            if (_localPlayer != null && Time.unscaledTime < _nextPlayerScan) return;
            _nextPlayerScan = Time.unscaledTime + 3f;
            if (_playerType == null) return;

            Component found = null;
            var ownerProp = _playerType.GetProperty("IsOwner", BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.FlattenHierarchy);
            foreach (var o in UnityEngine.Object.FindObjectsOfType(_playerType))
            {
                var c = o as Component;
                if (c == null) continue;
                try
                {
                    if (ownerProp != null && (bool)ownerProp.GetValue(c, null)) { found = c; break; }
                }
                catch { }
            }
            if (found == null)
            {
                // Fallback: the Player whose hierarchy contains the main camera.
                var cam = Camera.main;
                if (cam != null) found = cam.GetComponentInParent(_playerType);
            }
            if (found != _localPlayer) _calibrated = false;
            _localPlayer = found;
        }

        private class AngleField
        {
            public object Owner;
            public FieldInfo Field;
            public int Component = -1; // -1 = float field, 0 = Vector2.x, 1 = Vector2.y
            public float Sign = 1f;

            public float Get()
            {
                object v = Field.GetValue(Owner);
                if (Component < 0) return (float)v;
                var vec = (Vector2)v;
                return Component == 0 ? vec.x : vec.y;
            }

            public void Set(float value)
            {
                if (Component < 0) { Field.SetValue(Owner, value); return; }
                var vec = (Vector2)Field.GetValue(Owner);
                if (Component == 0) vec.x = value; else vec.y = value;
                Field.SetValue(Owner, vec);
            }
        }

        private static readonly string[] AngleNameHints = { "rot", "pitch", "yaw", "look", "angle", "cam", "xr", "yr", "mouse" };

        // Find the game's own pitch/yaw fields by matching their values against the camera's current angles.
        // Writing those fields makes the aim "stick" instead of being overwritten by the game's mouse-look script.
        private void Calibrate(Camera cam)
        {
            Vector3 e = cam.transform.rotation.eulerAngles;
            float pitch = Mathf.DeltaAngle(0f, e.x);
            float yaw = e.y;
            // Need non-trivial angles, otherwise every zeroed field would match.
            if (Mathf.Abs(pitch) < 2f || Mathf.Abs(Mathf.DeltaAngle(0f, yaw)) < 2f) return;

            _pitchFields.Clear();
            _yawFields.Clear();

            var comps = new HashSet<Component>();
            if (_localPlayer != null)
                foreach (var c in _localPlayer.transform.root.GetComponentsInChildren<MonoBehaviour>(true)) comps.Add(c);
            foreach (var c in cam.GetComponentsInParent<MonoBehaviour>(true)) comps.Add(c);

            foreach (var comp in comps)
            {
                if (comp == null || comp.GetType().Assembly != _gameAssembly) continue;
                foreach (var f in comp.GetType().GetFields(BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic))
                {
                    string n = f.Name.ToLowerInvariant();
                    if (!AngleNameHints.Any(h => n.Contains(h))) continue;
                    if (n.Contains("speed") || n.Contains("sens") || n.Contains("min") || n.Contains("max") || n.Contains("clamp") || n.Contains("limit")) continue;

                    if (f.FieldType == typeof(float))
                        TryMatch(new AngleField { Owner = comp, Field = f }, pitch, yaw);
                    else if (f.FieldType == typeof(Vector2))
                    {
                        TryMatch(new AngleField { Owner = comp, Field = f, Component = 0 }, pitch, yaw);
                        TryMatch(new AngleField { Owner = comp, Field = f, Component = 1 }, pitch, yaw);
                    }
                }
            }

            _calibrated = true;
            _calibratedFor = _localPlayer;
            LoggerInstance.Msg("Aim calibration: pitch fields [" + Describe(_pitchFields) + "], yaw fields [" + Describe(_yawFields) + "]");
        }

        private void TryMatch(AngleField af, float pitch, float yaw)
        {
            float v;
            try { v = af.Get(); } catch { return; }
            bool isPitch = false, isYaw = false;
            if (Mathf.Abs(v - pitch) < 0.5f) { isPitch = true; af.Sign = 1f; }
            else if (Mathf.Abs(v + pitch) < 0.5f) { isPitch = true; af.Sign = -1f; }
            if (Mathf.Abs(Mathf.DeltaAngle(v, yaw)) < 0.5f) isYaw = true;
            if (isPitch && isYaw) return; // ambiguous
            if (isPitch) _pitchFields.Add(af);
            else if (isYaw) _yawFields.Add(af);
        }

        private static string Describe(List<AngleField> list)
        {
            return string.Join(", ", list.Select(a => a.Owner.GetType().Name + "." + a.Field.Name + (a.Component == 0 ? ".x" : a.Component == 1 ? ".y" : "") + (a.Sign < 0 ? " (inverted)" : "")).ToArray());
        }

        private void ApplyRotation(Camera cam, Quaternion q, bool setTransforms)
        {
            Vector3 e = q.eulerAngles;
            float pitch = Mathf.DeltaAngle(0f, e.x);
            float yaw = e.y;

            foreach (var f in _pitchFields)
            {
                try { f.Set(pitch * f.Sign); } catch { }
            }
            foreach (var f in _yawFields)
            {
                try
                {
                    float cur = f.Get();
                    f.Set(cur + Mathf.DeltaAngle(cur, yaw)); // keep unbounded yaw accumulators continuous
                }
                catch { }
            }

            if (!setTransforms) return;

            // Turn the player body (yaw) if it is the camera's parent, then point the camera exactly.
            if (_localPlayer != null && cam.transform.IsChildOf(_localPlayer.transform))
            {
                var body = _localPlayer.transform;
                var rb = body.GetComponent<Rigidbody>();
                Quaternion bodyRot = Quaternion.Euler(0f, yaw, 0f);
                if (rb != null) rb.rotation = bodyRot;
                body.rotation = bodyRot;
            }
            cam.transform.rotation = q;
        }
    }
}
