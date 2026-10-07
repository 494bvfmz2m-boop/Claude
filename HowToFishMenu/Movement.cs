using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace HowToFishMenu
{
    internal static class Movement
    {
        public static Toggle Fly, Noclip, Freecam, InfJump, ThirdPerson, AirStrafeBoost, ClickTp;
        public static Choice FlySpeed, FreecamSpeed, Gravity, GameSpeed, JumpBoost, ThirdDist;
        public static bool FreecamOn { get { return Freecam != null && Freecam.On; } }

        private static readonly Vector3?[] Slots = new Vector3?[3];
        private static Vector3? _spawn;
        private static int _friendIndex;

        private static Rigidbody _rb;
        private static bool _rbKinematic, _rbGravity;
        private static CharacterController _cc;
        private static readonly List<Collider> _disabledColliders = new List<Collider>();
        private static bool _frozen;

        private static Vector3 _freecamPos;
        private static Vector3 _cameraOffsetApplied;
        private static Vector3 _defaultGravity;
        private static bool _gravitySaved;

        public static void Build()
        {
            Menu.BeginCategory("Movement");
            Fly = Menu.AddToggle("Fly", "WASD to move, SPACE up, CTRL down, SHIFT = faster.", false, v => { if (!v && !Noclip.On && !Freecam.On) Unfreeze(); }, null, Keys.F6, "F6");
            FlySpeed = Menu.AddChoice("Fly Speed", "Fly / noclip speed.", new[] { 15f, 25f, 40f, 60f, 100f, 5f, 10f }, 0, "0", "m/s");
            Noclip = Menu.AddToggle("Noclip", "Fly through walls and terrain.", false, v => { if (!v) { RestoreColliders(); if (!Fly.On && !Freecam.On) Unfreeze(); } }, null, Keys.F7, "F7");
            Freecam = Menu.AddToggle("Freecam", "Detach the camera and fly it around. Your body stays put.", false, v =>
            {
                var cam = G.Cam;
                if (v && cam != null) _freecamPos = cam.transform.position;
                if (!v && !Fly.On && !Noclip.On) Unfreeze();
            }, null, Keys.F8, "F8");
            FreecamSpeed = Menu.AddChoice("Freecam Speed", "Freecam move speed.", new[] { 20f, 40f, 80f, 5f, 10f }, 0, "0", "m/s");
            InfJump = Menu.AddToggle("Infinite Jump", "Jump again in mid-air with SPACE.", false);
            JumpBoost = Menu.AddChoice("Jump Boost", "Extra upward push for each jump (works with Infinite Jump).", new[] { 0f, 5f, 10f, 20f, 35f }, 0, "0");
            AirStrafeBoost = Menu.AddToggle("Dash [Q]", "Press Q to dash forward.", false);
            Gravity = Menu.AddChoice("Gravity", "World gravity multiplier (affects everything you simulate).", new[] { 1f, 0.75f, 0.5f, 0.25f, 0.1f, 1.5f, 2f }, 0, "0.##", "x", v => ApplyGravity());
            GameSpeed = Menu.AddChoice("Game Speed", "Time scale. Clients may desync from host.", new[] { 1f, 1.25f, 1.5f, 2f, 3f, 0.5f, 0.25f }, 0, "0.##", "x", v => Time.timeScale = v, "HOST");
            ThirdPerson = Menu.AddToggle("Third Person", "Camera behind your character.", false);
            ThirdDist = Menu.AddChoice("Third Person Distance", "Camera distance in third person.", new[] { 4f, 2.5f, 6f, 10f }, 0, "0.#", "m");
            ClickTp = Menu.AddToggle("Click Teleport", "Hold CTRL + right mouse to teleport where you look.", false);

            Menu.BeginCategory("Teleport");
            Menu.AddButton("Teleport to Crosshair", "Teleport to the spot you are looking at.", TeleportToCrosshair, null, Keys.F9, "F9");
            Menu.AddButton("Teleport Up 15m", "Jump straight up 15 meters.", () => TeleportBy(Vector3.up * 15f));
            Menu.AddButton("Teleport Forward 20m", "Move 20 meters forward.", () => { var c = G.Cam; if (c != null) TeleportBy(Flat(c.transform.forward) * 20f); });
            Menu.AddButton("Teleport Down 5m", "Drop 5 meters (good for getting under things).", () => TeleportBy(Vector3.down * 5f));
            for (int i = 0; i < 3; i++)
            {
                int slot = i;
                Menu.AddButton("Save Position " + (i + 1), "Remember where you are.", () => { var r = G.Body; if (r != null) { Slots[slot] = r.position; Menu.Toast("Saved position " + (slot + 1)); } });
                Menu.AddButton("Load Position " + (i + 1), "Teleport to the saved position.", () => { if (Slots[slot].HasValue) TeleportTo(Slots[slot].Value); else Menu.Toast("Slot " + (slot + 1) + " is empty."); });
            }
            Menu.AddButton("Teleport to Spawn", "Back to where you first spawned on this island.", () => { if (_spawn.HasValue) TeleportTo(_spawn.Value); });
            Menu.AddButton("Teleport to Nearest Fish", "Teleport next to the closest living fish.", () => TeleportToCreature(true));
            Menu.AddButton("Teleport to Nearest Monster", "Teleport next to the closest living non-fish creature.", () => TeleportToCreature(false));
            Menu.AddButton("Teleport to Boss", "Teleport next to the boss (if one is spawned).", TeleportToBoss);
            Menu.AddButton("Teleport to Friend", "Cycles through the other players in your session.", TeleportToFriend);
            Menu.AddButton("Teleport to Aimbot Target", "Teleport next to the creature the aimbot is locked on.", () => { if (Aimbot.Target != null) TeleportNear(Aimbot.Target.transform.position); else Menu.Toast("No aimbot target."); });
            Menu.AddButton("Teleport to Highest Point", "Teleport on top of the tallest thing below you (raycast from sky).", () =>
            {
                var r = G.Body; if (r == null) return;
                RaycastHit h;
                if (Physics.Raycast(r.position + Vector3.up * 500f, Vector3.down, out h, 1000f, ~0, QueryTriggerInteraction.Ignore)) TeleportTo(h.point + Vector3.up * 1.5f);
            });
        }

        private static Vector3 Flat(Vector3 v) { v.y = 0; return v.sqrMagnitude > 0.0001f ? v.normalized : Vector3.forward; }

        // ---------- teleport ----------

        public static void TeleportTo(Vector3 pos)
        {
            var root = G.Body;
            if (root == null) { Menu.Toast("Local player not found."); return; }
            var cc = root.GetComponent<CharacterController>();
            bool ccWas = cc != null && cc.enabled;
            if (cc != null) cc.enabled = false;
            var rb = root.GetComponent<Rigidbody>();
            if (rb != null) { rb.position = pos; rb.velocity = Vector3.zero; }
            root.position = pos;
            if (cc != null) cc.enabled = ccWas;
            if (FreecamOn) _freecamPos = pos + Vector3.up * 1.6f;
            Physics.SyncTransforms();
        }

        public static void TeleportBy(Vector3 delta)
        {
            var r = G.Body;
            if (r != null) TeleportTo(r.position + delta);
        }

        public static void TeleportNear(Vector3 target)
        {
            var r = G.Body;
            Vector3 from = r != null ? r.position : target;
            Vector3 dir = from - target; dir.y = 0;
            dir = dir.sqrMagnitude > 0.01f ? dir.normalized : Vector3.back;
            TeleportTo(target + dir * 4f + Vector3.up * 1.5f);
        }

        private static void TeleportToCrosshair()
        {
            var cam = G.Cam;
            if (cam == null) return;
            RaycastHit h;
            var root = G.Body;
            var hits = Physics.RaycastAll(cam.transform.position, cam.transform.forward, 2000f, ~0, QueryTriggerInteraction.Ignore)
                .Where(x => root == null || !x.collider.transform.IsChildOf(root)).OrderBy(x => x.distance).ToArray();
            if (hits.Length == 0) { Menu.Toast("Nothing under the crosshair."); return; }
            h = hits[0];
            TeleportTo(h.point + h.normal * 0.6f + Vector3.up * 1.0f);
        }

        private static void TeleportToCreature(bool fish)
        {
            var root = G.Body;
            if (root == null) return;
            Component best = null; float bestD = float.MaxValue;
            foreach (var c in G.Find("Creature"))
            {
                if (c == null || G.IsDead(c) || !c.gameObject.activeInHierarchy || Aimbot.IsFish(c) != fish) continue;
                float d = Vector3.Distance(root.position, c.transform.position);
                if (d < bestD && d > 2f) { best = c; bestD = d; }
            }
            if (best != null) TeleportNear(best.transform.position); else Menu.Toast("None found.");
        }

        private static void TeleportToBoss()
        {
            var boss = G.Find("Boss").FirstOrDefault(b => b != null && b.gameObject.activeInHierarchy);
            if (boss != null) TeleportNear(boss.transform.position); else Menu.Toast("No boss spawned.");
        }

        private static void TeleportToFriend()
        {
            var others = G.Find("Player", 0f).Where(p => p != null && p != G.LocalPlayer).ToList();
            if (others.Count == 0) { Menu.Toast("No other players."); return; }
            _friendIndex = (_friendIndex + 1) % others.Count;
            TeleportNear(others[_friendIndex].transform.position);
            Menu.Toast("Teleported to " + G.Name(others[_friendIndex]));
        }

        // ---------- per frame ----------

        public static void OnSceneLoaded()
        {
            _spawn = null;
            _rb = null; _cc = null; _frozen = false;
            _disabledColliders.Clear();
            _cameraOffsetApplied = Vector3.zero;
            if (Freecam != null && Freecam.On) Freecam.Set(false);
        }

        public static void Update()
        {
            var root = G.Body;
            if (root == null) return;
            if (!_spawn.HasValue) _spawn = root.position;

            // Undo last frame's third-person offset before the game positions the camera again.
            var cam = G.Cam;
            if (cam != null && _cameraOffsetApplied != Vector3.zero)
            {
                cam.transform.position -= _cameraOffsetApplied;
                _cameraOffsetApplied = Vector3.zero;
            }

            bool flying = Fly.On || Noclip.On;
            if (flying || Freecam.On) Freeze(root);

            if (Noclip.On) DisableColliders(root);

            if (flying && !Freecam.On && !Menu.Open && cam != null)
            {
                Vector3 move = InputDir(cam.transform);
                float speed = FlySpeed.Value * (Keys.Held(Keys.LShift) ? 2.5f : 1f);
                Vector3 p = root.position + move * speed * Time.unscaledDeltaTime;
                if (_rb != null) { _rb.position = p; _rb.velocity = Vector3.zero; }
                root.position = p;
            }

            var rb = root.GetComponent<Rigidbody>();
            if (!flying && !Freecam.On && !Menu.Open && rb != null && !rb.isKinematic)
            {
                if (InfJump.On && Keys.Pressed(Keys.Space))
                {
                    var v = rb.velocity; v.y = Mathf.Max(v.y, 0f) + 6f + JumpBoost.Value; rb.velocity = v;
                }
                else if (JumpBoost.Value > 0 && Keys.Pressed(Keys.Space) && Grounded(root))
                {
                    rb.AddForce(Vector3.up * JumpBoost.Value, ForceMode.VelocityChange);
                }
                if (AirStrafeBoost.On && Keys.Pressed(Keys.Q) && cam != null)
                    rb.AddForce(Flat(cam.transform.forward) * 18f, ForceMode.VelocityChange);
            }

            if (ClickTp.On && !Menu.Open && Keys.Held(Keys.Ctrl) && Keys.Pressed(Keys.MouseRight)) TeleportToCrosshair();

            if (GameSpeed.Value != 1f && Time.timeScale != 0f && !Mathf.Approximately(Time.timeScale, GameSpeed.Value)) Time.timeScale = GameSpeed.Value;
        }

        public static void LateUpdate()
        {
            var cam = G.Cam;
            if (cam == null) return;
            if (Freecam.On)
            {
                if (!Menu.Open)
                {
                    float speed = FreecamSpeed.Value * (Keys.Held(Keys.LShift) ? 3f : 1f);
                    _freecamPos += InputDir(cam.transform) * speed * Time.unscaledDeltaTime;
                }
                cam.transform.position = _freecamPos;
                return;
            }
            if (ThirdPerson.On)
            {
                Vector3 back = -cam.transform.forward * ThirdDist.Value + Vector3.up * 0.4f;
                RaycastHit h;
                var root = G.Body;
                var hits = Physics.RaycastAll(cam.transform.position, back.normalized, back.magnitude, ~0, QueryTriggerInteraction.Ignore);
                foreach (var x in hits.OrderBy(x => x.distance))
                {
                    if (root != null && x.collider.transform.IsChildOf(root)) continue;
                    h = x; back = back.normalized * Mathf.Max(0.3f, h.distance - 0.2f); break;
                }
                cam.transform.position += back;
                _cameraOffsetApplied = back;
            }
        }

        private static bool Grounded(Transform root)
        {
            return Physics.Raycast(root.position + Vector3.up * 0.2f, Vector3.down, 0.5f, ~0, QueryTriggerInteraction.Ignore);
        }

        private static Vector3 InputDir(Transform view)
        {
            Vector3 d = Vector3.zero;
            if (Keys.Held(Keys.W)) d += view.forward;
            if (Keys.Held(Keys.S)) d -= view.forward;
            if (Keys.Held(Keys.D)) d += view.right;
            if (Keys.Held(Keys.A)) d -= view.right;
            if (Keys.Held(Keys.Space)) d += Vector3.up;
            if (Keys.Held(Keys.Ctrl)) d -= Vector3.up;
            return d.sqrMagnitude > 1f ? d.normalized : d;
        }

        private static void Freeze(Transform root)
        {
            if (_frozen) return;
            _rb = root.GetComponent<Rigidbody>();
            if (_rb != null) { _rbKinematic = _rb.isKinematic; _rbGravity = _rb.useGravity; _rb.isKinematic = true; _rb.useGravity = false; _rb.velocity = Vector3.zero; }
            _cc = root.GetComponent<CharacterController>();
            if (_cc != null) _cc.enabled = false;
            _frozen = true;
        }

        public static void Unfreeze()
        {
            if (!_frozen) return;
            if (_rb != null) { _rb.isKinematic = _rbKinematic; _rb.useGravity = _rbGravity; }
            if (_cc != null) _cc.enabled = true;
            _frozen = false;
        }

        private static void DisableColliders(Transform root)
        {
            foreach (var c in root.GetComponentsInChildren<Collider>())
            {
                if (c.isTrigger || !c.enabled || c is CharacterController) continue;
                c.enabled = false;
                _disabledColliders.Add(c);
            }
        }

        private static void RestoreColliders()
        {
            foreach (var c in _disabledColliders) if (c != null) c.enabled = true;
            _disabledColliders.Clear();
        }

        public static void ApplyGravity()
        {
            if (!_gravitySaved) { _defaultGravity = Physics.gravity; _gravitySaved = true; }
            Physics.gravity = _defaultGravity * Gravity.Value;
        }
    }
}
