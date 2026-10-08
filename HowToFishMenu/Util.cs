using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Runtime.InteropServices;
using UnityEngine;

namespace HowToFishMenu
{
    // Raw Windows key state, so input works no matter which Unity input system the game uses.
    internal static class Keys
    {
        [DllImport("user32.dll")] private static extern short GetAsyncKeyState(int vKey);
        [DllImport("user32.dll")] private static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extra);

        public const int Backspace = 0x08, Enter = 0x0D, Shift = 0x10, Ctrl = 0x11, Escape = 0x1B, Space = 0x20,
            PageUp = 0x21, PageDown = 0x22, End = 0x23, Left = 0x25, Up = 0x26, Right = 0x27, Down = 0x28,
            Insert = 0x2D, Delete = 0x2E, A = 0x41, D = 0x44, E = 0x45, Q = 0x51, S = 0x53, V = 0x56, W = 0x57,
            F5 = 0x74, F6 = 0x75, F7 = 0x76, F8 = 0x77, F9 = 0x78, F10 = 0x79, RShift = 0xA1, LShift = 0xA0,
            Mouse4 = 0x05, Mouse5 = 0x06, MouseRight = 0x02;

        private static readonly bool[] Prev = new bool[256];
        private static readonly bool[] Cur = new bool[256];
        private static int _frame = -1;

        public static void Poll()
        {
            if (_frame == Time.frameCount) return;
            _frame = Time.frameCount;
            bool focused = Application.isFocused;
            for (int i = 1; i < 256; i++)
            {
                Prev[i] = Cur[i];
                bool d = false;
                if (focused) { try { d = (GetAsyncKeyState(i) & 0x8000) != 0; } catch { } }
                Cur[i] = d;
            }
        }

        public static bool Held(int vk) { return Cur[vk]; }
        public static bool Pressed(int vk) { return Cur[vk] && !Prev[vk]; }

        public static void MoveMouse(int dx, int dy)
        {
            try { mouse_event(0x0001, unchecked((uint)dx), unchecked((uint)dy), 0, UIntPtr.Zero); } catch { }
        }

        public static void Click()
        {
            try
            {
                mouse_event(0x0002, 0, 0, 0, UIntPtr.Zero);
                mouse_event(0x0004, 0, 0, 0, UIntPtr.Zero);
            }
            catch { }
        }
    }

    internal static class Draw
    {
        private static Texture2D _tex;
        private static GUIStyle _label;

        public static Texture2D Tex
        {
            get
            {
                if (_tex == null)
                {
                    _tex = new Texture2D(1, 1);
                    _tex.SetPixel(0, 0, Color.white);
                    _tex.Apply();
                    UnityEngine.Object.DontDestroyOnLoad(_tex);
                }
                return _tex;
            }
        }

        public static void Rect(Rect r, Color c)
        {
            var old = GUI.color;
            GUI.color = c;
            GUI.DrawTexture(r, Tex);
            GUI.color = old;
        }

        public static void Box(Rect r, Color c, float t = 1.5f)
        {
            Rect(new Rect(r.x, r.y, r.width, t), c);
            Rect(new Rect(r.x, r.yMax - t, r.width, t), c);
            Rect(new Rect(r.x, r.y, t, r.height), c);
            Rect(new Rect(r.xMax - t, r.y, t, r.height), c);
        }

        public static void Line(Vector2 a, Vector2 b, Color c, float width = 1.5f)
        {
            float len = Vector2.Distance(a, b);
            if (len < 0.5f) return;
            float angle = Mathf.Atan2(b.y - a.y, b.x - a.x) * Mathf.Rad2Deg;
            var m = GUI.matrix;
            GUIUtility.RotateAroundPivot(angle, a);
            Rect(new Rect(a.x, a.y - width / 2f, len, width), c);
            GUI.matrix = m;
        }

        public static void Circle(Vector2 center, float radius, Color c, int segments = 48)
        {
            Vector2 prev = center + new Vector2(radius, 0);
            for (int i = 1; i <= segments; i++)
            {
                float a = i * Mathf.PI * 2f / segments;
                Vector2 p = center + new Vector2(Mathf.Cos(a) * radius, Mathf.Sin(a) * radius);
                Line(prev, p, c, 1f);
                prev = p;
            }
        }

        public static void Text(Vector2 pos, string text, Color c, bool centered = true, int size = 12)
        {
            if (_label == null) _label = new GUIStyle(GUI.skin.label) { fontStyle = FontStyle.Bold, wordWrap = false };
            _label.fontSize = size;
            var content = new GUIContent(text);
            Vector2 sz = _label.CalcSize(content);
            var r = new Rect(centered ? pos.x - sz.x / 2f : pos.x, pos.y, sz.x, sz.y);
            _label.normal.textColor = new Color(0, 0, 0, c.a * 0.9f);
            GUI.Label(new Rect(r.x + 1, r.y + 1, r.width, r.height), content, _label);
            _label.normal.textColor = c;
            GUI.Label(r, content, _label);
        }

        // Screen-space rect around renderers' bounds; false if behind camera.
        public static bool ScreenBox(Camera cam, Bounds b, out Rect rect)
        {
            rect = new Rect();
            Vector3 c = b.center, e = b.extents;
            float minX = float.MaxValue, minY = float.MaxValue, maxX = float.MinValue, maxY = float.MinValue;
            for (int i = 0; i < 8; i++)
            {
                Vector3 p = c + new Vector3((i & 1) == 0 ? -e.x : e.x, (i & 2) == 0 ? -e.y : e.y, (i & 4) == 0 ? -e.z : e.z);
                Vector3 s = cam.WorldToScreenPoint(p);
                if (s.z <= 0.05f) return false;
                s.y = Screen.height - s.y;
                minX = Mathf.Min(minX, s.x); maxX = Mathf.Max(maxX, s.x);
                minY = Mathf.Min(minY, s.y); maxY = Mathf.Max(maxY, s.y);
            }
            rect = new Rect(minX, minY, maxX - minX, maxY - minY);
            return true;
        }

        public static bool ToScreen(Camera cam, Vector3 world, out Vector2 screen)
        {
            Vector3 s = cam.WorldToScreenPoint(world);
            screen = new Vector2(s.x, Screen.height - s.y);
            return s.z > 0.05f;
        }
    }

    // Reflection access to the game's Assembly-CSharp (we don't compile against it).
    internal static class G
    {
        public const BindingFlags All = BindingFlags.Instance | BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.FlattenHierarchy;
        public const BindingFlags Inst = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic;

        public static Assembly Asm;
        private static readonly Dictionary<string, Type> Types = new Dictionary<string, Type>();

        public static bool Ready
        {
            get
            {
                if (Asm != null) return true;
                Asm = AppDomain.CurrentDomain.GetAssemblies().FirstOrDefault(a => a.GetName().Name == "Assembly-CSharp");
                return Asm != null;
            }
        }

        public static Type T(string name)
        {
            if (!Ready) return null;
            Type t;
            if (!Types.TryGetValue(name, out t))
            {
                t = Asm.GetType(name);
                Types[name] = t;
            }
            return t;
        }

        private class Cache { public float Time; public List<Component> Items = new List<Component>(); }
        private static readonly Dictionary<string, Cache> Found = new Dictionary<string, Cache>();

        // All live instances of a game type, refreshed at most every `maxAge` seconds.
        public static List<Component> Find(string typeName, float maxAge = 0.75f)
        {
            Cache c;
            if (!Found.TryGetValue(typeName, out c)) { c = new Cache { Time = -999f }; Found[typeName] = c; }
            if (Time.unscaledTime - c.Time < maxAge)
            {
                c.Items.RemoveAll(x => x == null);
                return c.Items;
            }
            c.Time = Time.unscaledTime;
            c.Items.Clear();
            var t = T(typeName);
            if (t == null) return c.Items;
            foreach (var o in UnityEngine.Object.FindObjectsOfType(t))
            {
                var comp = o as Component;
                if (comp != null) c.Items.Add(comp);
            }
            return c.Items;
        }

        public static void ClearCaches()
        {
            Found.Clear();
            _local = null;
        }

        private static Component _local;
        private static float _localTime = -999f;

        public static Component LocalPlayer
        {
            get
            {
                if (_local != null && Time.unscaledTime - _localTime < 3f) return _local;
                _localTime = Time.unscaledTime;
                _local = null;
                var pt = T("Player");
                if (pt == null) return null;
                foreach (var p in Find("Player", 0f))
                {
                    object owner = Get(p, "IsOwner");
                    if (owner is bool && (bool)owner) { _local = p; break; }
                }
                if (_local == null && Camera.main != null) _local = Camera.main.GetComponentInParent(pt);
                return _local;
            }
        }

        // Like the game's own lookup: on the object, its children, then its parents.
        public static Component Comp(Component from, string typeName)
        {
            var t = T(typeName);
            if (from == null || t == null) return null;
            try
            {
                return from.GetComponent(t) ?? from.GetComponentInChildren(t) ?? from.GetComponentInParent(t);
            }
            catch { return null; }
        }

        private static readonly string[] PlayerParts = { "PlayerMovement", "PlayerVitals", "PlayerDying", "PlayerInventory", "PlayerScreenShake", "PlayerCamera", "PlayerUI", "PlayerToolMovement" };

        // Every game script that belongs to the local player (its own object tree plus its parts found like the game does).
        public static List<Component> LocalParts()
        {
            var list = new List<Component>();
            var lp = LocalPlayer;
            if (lp == null) return list;
            foreach (var mb in lp.GetComponentsInChildren<MonoBehaviour>(true))
                if (mb != null && mb.GetType().Assembly == Asm) list.Add(mb);
            foreach (var n in PlayerParts)
            {
                var c = Comp(lp, n);
                if (c != null && !list.Contains(c)) list.Add(c);
            }
            var pc = PlayerCam;
            if (pc != null && !list.Contains(pc)) list.Add(pc);
            return list;
        }

        // The transform that physically moves (PlayerMovement's object, which carries the Rigidbody).
        private static Transform _body;
        private static int _bodyFrame = -1;

        public static Transform Body
        {
            get
            {
                if (_bodyFrame == Time.frameCount && _body != null) return _body;
                _bodyFrame = Time.frameCount;
                _body = FindBody();
                return _body;
            }
        }

        private static Transform FindBody()
        {
            var lp = LocalPlayer;
            if (lp == null) return null;
            var rb = lp.GetComponent<Rigidbody>() ?? lp.GetComponentInChildren<Rigidbody>();
            if (rb != null && rb.GetComponentInParent(T("Player")) == lp) return rb.transform;
            return lp.transform;
        }

        public static float ViewYaw()
        {
            var cam = Cam;
            if (cam == null) return LocalRoot != null ? LocalRoot.eulerAngles.y : 0f;
            Vector3 f = cam.transform.forward;
            return Mathf.Atan2(f.x, f.z) * Mathf.Rad2Deg;
        }

        private static bool _teleportWarned;

        // The game's own teleport: Player.LocalTeleport(Vector3 pos, float rot, bool).
        public static bool LocalTeleport(Vector3 pos)
        {
            var lp = LocalPlayer;
            if (lp == null) return false;
            var m = lp.GetType().GetMethods(All).FirstOrDefault(x => x.Name == "LocalTeleport" && x.GetParameters().Length == 3);
            if (m == null) return false;
            try { m.Invoke(lp, new object[] { pos, ViewYaw(), true }); return true; }
            catch (Exception e)
            {
                if (!_teleportWarned) { _teleportWarned = true; MelonLoader.MelonLogger.Warning("LocalTeleport failed: " + (e.InnerException ?? e).Message); }
                return false;
            }
        }

        // Tell the host where we are (needed when you joined someone else's game), like the game's friend teleport does.
        public static void SendPosition(Vector3 pos)
        {
            var lp = LocalPlayer;
            var server = Singleton("Server");
            if (lp == null || server == null) return;
            float yaw = ViewYaw();
            foreach (var m in server.GetType().GetMethods(All))
            {
                if (m.Name != "UpdatePlayerPosRot" && !m.Name.StartsWith("RpcWriter___UpdatePlayerPosRot")) continue;
                var ps = m.GetParameters();
                if (ps.Length != 6) continue;
                try
                {
                    object channel = ps[5].ParameterType.IsEnum ? Enum.Parse(ps[5].ParameterType, "Reliable") : null;
                    m.Invoke(server, new object[] { lp, pos, new Vector2(0f, yaw), false, true, channel });
                    return;
                }
                catch { }
            }
        }

        // The game's PlayerCamera script (Player.Camera), which drives the view.
        public static Component PlayerCam
        {
            get { return Get(LocalPlayer, "Camera") as Component; }
        }

        private static Camera _cam;
        private static int _camFrame = -1;

        // The camera the player actually sees through. Camera.main can be null in this game.
        public static Camera Cam
        {
            get
            {
                if (_camFrame == Time.frameCount && _cam != null) return _cam;
                _camFrame = Time.frameCount;
                _cam = null;
                var pc = PlayerCam;
                if (pc != null)
                {
                    _cam = pc as Camera ?? pc.GetComponent<Camera>() ?? pc.GetComponentInChildren<Camera>() ?? pc.GetComponentInParent<Camera>();
                    if (_cam != null && (!_cam.enabled || !_cam.gameObject.activeInHierarchy)) _cam = null;
                }
                if (_cam == null) _cam = Camera.main;
                if (_cam == null)
                {
                    float best = float.MinValue;
                    foreach (var c in Camera.allCameras)
                        if (c != null && c.enabled && c.targetTexture == null && c.depth > best) { best = c.depth; _cam = c; }
                }
                return _cam;
            }
        }

        // Player.Inventory.SyncedCurItem.<sub>  (sub = "Weapon" or "FishingRod")
        public static object Held(string sub)
        {
            object inv = Get(LocalPlayer, "Inventory");
            object item = Get(inv, "SyncedCurItem");
            return item == null ? null : Get(item, sub);
        }

        public static double AmmoPerMag(object weapon)
        {
            double per = Num(Get(Get(weapon, "Attachments"), "AmmoPerMag"));
            if (double.IsNaN(per)) per = Num(Get(weapon, "AmmoPerMag"));
            return per;
        }

        public static Transform LocalRoot
        {
            get
            {
                var p = LocalPlayer;
                return p != null ? p.transform : null;
            }
        }

        public static bool IsLocal(Component c)
        {
            if (c == null) return false;
            var root = LocalRoot;
            if (root != null && (c.transform == root || c.transform.IsChildOf(root))) return true;
            var body = Body;
            return body != null && body != root && c.transform.IsChildOf(body);
        }

        public static bool IsServer
        {
            get
            {
                var p = LocalPlayer;
                if (p == null) return true;
                object s = Get(p, "IsServerInitialized") ?? Get(p, "IsServerStarted") ?? Get(p, "IsServer");
                object off = Get(p, "IsOffline");
                return (s is bool && (bool)s) || (off is bool && (bool)off);
            }
        }

        private static readonly Dictionary<string, MemberInfo> Members = new Dictionary<string, MemberInfo>();

        public static MemberInfo Member(Type t, string name)
        {
            string key = t.FullName + "::" + name;
            MemberInfo m;
            if (Members.TryGetValue(key, out m)) return m;
            for (var cur = t; cur != null && m == null; cur = cur.BaseType)
            {
                var f = cur.GetField(name, All | BindingFlags.DeclaredOnly);
                if (f != null) { m = f; break; }
                var p = cur.GetProperty(name, All | BindingFlags.DeclaredOnly);
                if (p != null && p.GetIndexParameters().Length == 0) m = p;
            }
            Members[key] = m;
            return m;
        }

        public static object Get(object obj, string name)
        {
            if (obj == null) return null;
            try
            {
                var m = Member(obj is Type ? (Type)obj : obj.GetType(), name);
                object target = obj is Type ? null : obj;
                var f = m as FieldInfo;
                if (f != null) return f.GetValue(target);
                var p = m as PropertyInfo;
                if (p != null && p.CanRead) return p.GetValue(target, null);
            }
            catch { }
            return null;
        }

        public static bool Set(object obj, string name, object value)
        {
            if (obj == null) return false;
            try
            {
                var m = Member(obj.GetType(), name);
                var f = m as FieldInfo;
                if (f != null) { f.SetValue(obj, Convert(value, f.FieldType)); return true; }
                var p = m as PropertyInfo;
                if (p != null && p.CanWrite) { p.SetValue(obj, Convert(value, p.PropertyType), null); return true; }
            }
            catch { }
            return false;
        }

        public static object Convert(object value, Type to)
        {
            if (value == null || to.IsInstanceOfType(value)) return value;
            if (to.IsPrimitive || to == typeof(decimal)) return System.Convert.ChangeType(value, to);
            return value;
        }

        // FishNet SyncVar<T> keeps its value in .Value.
        public static object Unwrap(object o)
        {
            if (o == null || o.GetType().IsPrimitive) return o;
            var p = o.GetType().GetProperty("Value");
            return p != null ? p.GetValue(o, null) : o;
        }

        public static double Num(object o, double fallback = double.NaN)
        {
            o = Unwrap(o);
            if (o == null) return fallback;
            try { return System.Convert.ToDouble(o); } catch { return fallback; }
        }

        public static object Call(object obj, string method, params object[] args)
        {
            if (obj == null) return null;
            var t = obj is Type ? (Type)obj : obj.GetType();
            foreach (var m in t.GetMethods(All))
            {
                if (m.Name != method) continue;
                var ps = m.GetParameters();
                if (ps.Length != args.Length) continue;
                try
                {
                    var conv = new object[args.Length];
                    for (int i = 0; i < args.Length; i++) conv[i] = Convert(args[i], ps[i].ParameterType);
                    return m.Invoke(obj is Type ? null : obj, conv);
                }
                catch { }
            }
            return null;
        }

        public static Component Singleton(string typeName)
        {
            var t = T(typeName);
            if (t == null) return null;
            var inst = Get(t, "Instance") as Component;
            if (inst != null) return inst;
            var list = Find(typeName, 2f);
            return list.Count > 0 ? list[0] : null;
        }

        public static bool IsDead(Component c)
        {
            object d = Get(c, "IsDead");
            if (d is bool && (bool)d) return true;
            double hp = Num(Get(c, "Hp"));
            return !double.IsNaN(hp) && hp <= 0;
        }

        public static string Name(Component c)
        {
            return c == null ? "" : c.gameObject.name.Replace("(Clone)", "").Trim();
        }

        private static readonly Dictionary<int, Renderer[]> Renderers = new Dictionary<int, Renderer[]>();

        public static bool Bounds(Component c, out Bounds b)
        {
            b = new Bounds(c.transform.position, Vector3.one);
            Renderer[] rs;
            int id = c.GetInstanceID();
            if (!Renderers.TryGetValue(id, out rs) || rs.Any(r => r == null))
            {
                rs = c.GetComponentsInChildren<Renderer>().Where(r => !(r is ParticleSystemRenderer)).ToArray();
                Renderers[id] = rs;
            }
            bool any = false;
            foreach (var r in rs)
            {
                if (r == null || !r.enabled) continue;
                if (!any) { b = r.bounds; any = true; } else b.Encapsulate(r.bounds);
            }
            return any;
        }

        public static Vector3 Center(Component c)
        {
            Bounds b;
            if (Bounds(c, out b)) return b.center;
            var col = c.GetComponentInChildren<Collider>();
            return col != null ? col.bounds.center : c.transform.position;
        }
    }
}
