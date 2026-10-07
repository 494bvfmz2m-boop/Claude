using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using HarmonyLib;
using MelonLoader;
using UnityEngine;

namespace HowToFishMenu
{
    // Sets matching fields on game objects while active and restores the originals when turned off.
    internal class Tweak
    {
        public string[] Types;            // game type names, or "@local" for every game script on your player
        public Func<FieldInfo, bool> Match;
        public Func<Component, FieldInfo, object, object> Value; // (owner, field, original) -> new value
        public Func<bool> Active;

        private readonly Dictionary<Component, Dictionary<FieldInfo, object>> _orig = new Dictionary<Component, Dictionary<FieldInfo, object>>();
        private static readonly Dictionary<Type, FieldInfo[]> FieldCache = new Dictionary<Type, FieldInfo[]>();
        private readonly Dictionary<Type, FieldInfo[]> _matched = new Dictionary<Type, FieldInfo[]>();

        public static readonly List<Tweak> All = new List<Tweak>();

        public static Tweak Add(string[] types, Func<FieldInfo, bool> match, Func<Component, FieldInfo, object, object> value, Func<bool> active)
        {
            var t = new Tweak { Types = types, Match = match, Value = value, Active = active };
            All.Add(t);
            return t;
        }

        public static Tweak Field(string[] types, string field, Func<object, object> value, Func<bool> active)
        {
            return Add(types, f => f.Name == field, (c, f, o) => value(o), active);
        }

        private FieldInfo[] Fields(Type t)
        {
            FieldInfo[] m;
            if (_matched.TryGetValue(t, out m)) return m;
            FieldInfo[] all;
            if (!FieldCache.TryGetValue(t, out all))
            {
                var list = new List<FieldInfo>();
                for (var cur = t; cur != null && cur != typeof(MonoBehaviour); cur = cur.BaseType)
                    list.AddRange(cur.GetFields(G.Inst | BindingFlags.DeclaredOnly));
                all = list.ToArray();
                FieldCache[t] = all;
            }
            m = all.Where(f => !f.IsInitOnly && !f.IsLiteral && Match(f)).ToArray();
            _matched[t] = m;
            return m;
        }

        private static List<Component> _localComps = new List<Component>();
        private static float _localTime = -99f;

        private static IEnumerable<Component> Targets(string type)
        {
            if (type != "@local") return G.Find(type);
            if (Time.unscaledTime - _localTime > 1f)
            {
                _localTime = Time.unscaledTime;
                _localComps = G.LocalParts();
            }
            _localComps.RemoveAll(c => c == null);
            return _localComps;
        }

        public void Tick()
        {
            bool on;
            try { on = Active(); } catch { on = false; }
            if (!on) { Restore(); return; }

            foreach (var type in Types)
                foreach (var comp in Targets(type))
                {
                    if (comp == null) continue;
                    var fields = Fields(comp.GetType());
                    if (fields.Length == 0) continue;
                    Dictionary<FieldInfo, object> saved;
                    if (!_orig.TryGetValue(comp, out saved)) { saved = new Dictionary<FieldInfo, object>(); _orig[comp] = saved; }
                    foreach (var f in fields)
                    {
                        try
                        {
                            object orig;
                            if (!saved.TryGetValue(f, out orig)) { orig = f.GetValue(comp); saved[f] = orig; }
                            object nv = Value(comp, f, orig);
                            if (nv != null) f.SetValue(comp, G.Convert(nv, f.FieldType));
                        }
                        catch { }
                    }
                }
        }

        public void Restore()
        {
            if (_orig.Count == 0) return;
            foreach (var kv in _orig)
            {
                if (kv.Key == null) continue;
                foreach (var f in kv.Value) { try { f.Key.SetValue(kv.Key, f.Value); } catch { } }
            }
            _orig.Clear();
        }

        public static void ClearAll() { foreach (var t in All) t._orig.Clear(); }
    }

    internal static class Features
    {
        // Weapons
        public static Toggle InfAmmo, NoReload, NoRecoil, NoSpread, OneHit, AutoReloadFull;
        public static Choice RapidFire, DamageMult;
        // Player
        public static Toggle God, NeverDie, NoDrown, InfSwimJump, NoSink, InfStamina, KeepInv, AntiAfk;
        public static Choice DamageTaken, WalkSpeed, JumpHeight, SwimSpeed;
        // Fishing
        public static Toggle NeverLose, InstantBite, NoReelNeeded, AlwaysRare, InfBait, NoBirds, FishDots;
        public static Choice FastReel, BiteDelay;
        // World
        public static Toggle FreeShop, FreezeCreatures, CreatureMagnet;

        private static readonly string[] FishTypes = { "FishingRod", "Bait", "BaitInfo", "CreatureManager", "GameInfo", "CreatureUtils" };
        private static readonly Dictionary<Component, Vector3> FrozenAt = new Dictionary<Component, Vector3>();

        public static void Build()
        {
            Menu.BeginCategory("Weapons");
            InfAmmo = Menu.AddToggle("Infinite Ammo", "Magazine is refilled after every shot.", false);
            NoReload = Menu.AddToggle("No Reload", "Reloading is instant / never needed.", false);
            NoRecoil = Menu.AddToggle("No Recoil", "Removes weapon kick.", false);
            NoSpread = Menu.AddToggle("No Spread", "Every bullet goes exactly where you aim.", false);
            RapidFire = Menu.AddChoice("Rapid Fire", "Fire-rate multiplier.", new[] { 1f, 2f, 3f, 5f, 10f, 20f }, 0, "0", "x");
            DamageMult = Menu.AddChoice("Damage Multiplier", "Damage you deal to creatures.", new[] { 1f, 2f, 5f, 10f, 25f, 50f, 100f }, 0, "0", "x", null, "HOST");
            OneHit = Menu.AddToggle("One-Hit Kill", "Every hit kills.", false, null, "HOST");
            AutoReloadFull = Menu.AddToggle("Full Mag On Equip", "Weapons you pick up start with a full magazine.", false);

            Menu.BeginCategory("Player");
            God = Menu.AddToggle("God Mode", "You take no damage.", false);
            NeverDie = Menu.AddToggle("Never Die", "Blocks death even if something gets past God Mode.", false);
            DamageTaken = Menu.AddChoice("Damage Taken", "Scale incoming damage (when God Mode is off).", new[] { 1f, 0.75f, 0.5f, 0.25f, 0.1f, 0f }, 0, "0%");
            NoDrown = Menu.AddToggle("No Drowning", "Stay underwater forever.", false);
            InfSwimJump = Menu.AddToggle("Infinite Swim Jumps", "Jump out of water as often as you want.", false);
            NoSink = Menu.AddToggle("No Sinking", "You don't sink while swimming.", false);
            InfStamina = Menu.AddToggle("Infinite Stamina", "Stamina never drains (if the game has stamina).", false);
            WalkSpeed = Menu.AddChoice("Walk/Run Speed", "Movement speed multiplier.", new[] { 1f, 1.25f, 1.5f, 2f, 3f, 5f }, 0, "0.##", "x");
            SwimSpeed = Menu.AddChoice("Swim Speed", "Swimming speed multiplier.", new[] { 1f, 1.5f, 2f, 3f, 5f }, 0, "0.##", "x");
            JumpHeight = Menu.AddChoice("Jump Height", "Jump force multiplier.", new[] { 1f, 1.5f, 2f, 3f, 5f }, 0, "0.##", "x");
            KeepInv = Menu.AddToggle("Keep Inventory", "Don't drop your items when you die.", false, null, "HOST");
            AntiAfk = Menu.AddToggle("Anti-AFK", "Never get flagged as AFK.", false);

            Menu.BeginCategory("Fishing");
            FastReel = Menu.AddChoice("Fast Reel", "Reel speed multiplier.", new[] { 1f, 2f, 3f, 5f, 10f, 25f }, 0, "0", "x");
            BiteDelay = Menu.AddChoice("Bite Delay", "How long until a fish bites.", new[] { 1f, 0.5f, 0.25f, 0.1f, 2f }, 0, "0.##", "x");
            InstantBite = Menu.AddToggle("Instant Bite", "Fish bite almost immediately.", false);
            NeverLose = Menu.AddToggle("Never Lose a Fish", "Hooked fish can't escape / steal bait.", false);
            NoReelNeeded = Menu.AddToggle("No Reeling Needed", "Catch without having to reel in.", false);
            AlwaysRare = Menu.AddToggle("Always Rare Variant", "Max chance for the rare (shiny/drip) version.", false, null, "HOST");
            InfBait = Menu.AddToggle("Infinite Bait", "Bait is never used up.", false, null, "HOST");
            NoBirds = Menu.AddToggle("Birds Never Steal", "Seagulls ignore your fish and food.", false);
            FishDots = Menu.AddToggle("Show Fish Markers", "Force the game's own fish/item markers on.", false);

            Menu.BeginCategory("World");
            FreeShop = Menu.AddToggle("Free Shopping", "Purchases don't cost money.", false, null, "HOST");
            foreach (var amount in new[] { 1000, 10000, 100000, 1000000 })
            {
                int a = amount;
                Menu.AddButton("Add $" + a.ToString("N0"), "Adds money to your wallet.", () => AddMoney(a), "HOST");
            }
            Menu.AddButton("Set Money to $999,999", "Tops your wallet up to 999,999.", () =>
            {
                var mm = G.Singleton("MoneyManager");
                double cur = G.Num(G.Get(mm, "Money"), 0);
                if (cur < 999999) AddMoney((int)(999999 - cur));
            }, "HOST");
            FreezeCreatures = Menu.AddToggle("Freeze Creatures", "All creatures stop moving.", false, v => { if (!v) FrozenAt.Clear(); }, "HOST");
            CreatureMagnet = Menu.AddToggle("Creature Magnet", "Pull nearby creatures in front of you.", false, null, "HOST");
            Menu.AddButton("Bring All Creatures", "Teleport every living creature in front of you.", () => BringCreatures(1000f), "HOST");
            Menu.AddButton("Kill All Creatures", "Tries the game's own kill routes on every creature.", KillAll, "HOST");
            Menu.AddButton("Count Creatures", "Shows how many creatures/fish/bosses are loaded.", () =>
            {
                var all = G.Find("Creature", 0f).Where(c => c != null && !G.IsDead(c)).ToList();
                Menu.Toast(all.Count + " creatures (" + all.Count(Aimbot.IsFish) + " fish), " + G.Find("Boss", 0f).Count + " boss(es)");
            });

            RegisterTweaks();
        }

        private static float Mult(object o, float m)
        {
            return (float)G.Num(o, 0) * m;
        }

        private static void RegisterTweaks()
        {
            var weapon = new[] { "Weapon" };
            Tweak.Field(weapon, "_spread", o => 0f, () => NoSpread.On);
            Tweak.Field(weapon, "_recoilKnockback", o => 0f, () => NoRecoil.On);
            Tweak.Add(weapon, f => f.FieldType == typeof(float) && Rapid(f.Name),
                (c, f, o) => f.Name.ToLowerInvariant().Contains("rate") && !f.Name.ToLowerInvariant().Contains("delay") ? Mult(o, RapidFire.Value) : Mult(o, 1f / RapidFire.Value),
                () => RapidFire.Value > 1f);

            var local = new[] { "@local" };
            Tweak.Field(local, "_damageFromWater", o => 0f, () => NoDrown.On || God.On);
            Tweak.Field(local, "_underwaterDamageDelay", o => 99999f, () => NoDrown.On || God.On);
            Tweak.Field(local, "_timeWentUnderWater", o => Time.time, () => NoDrown.On || God.On);
            Tweak.Field(local, "_sinkSpeed", o => 0f, () => NoSink.On);
            Tweak.Field(local, "_swimJumpCount", o => 0, () => InfSwimJump.On);
            Tweak.Field(local, "_swimJumpAmountAllowed", o => 9999, () => InfSwimJump.On);
            Tweak.Add(local, f => (f.FieldType == typeof(float)) && Speed(f.Name, false), (c, f, o) => Mult(o, WalkSpeed.Value), () => WalkSpeed.Value != 1f);
            Tweak.Add(local, f => (f.FieldType == typeof(float)) && Speed(f.Name, true), (c, f, o) => Mult(o, SwimSpeed.Value), () => SwimSpeed.Value != 1f);
            Tweak.Add(local, f => f.FieldType == typeof(float) && Jump(f.Name), (c, f, o) => Mult(o, JumpHeight.Value), () => JumpHeight.Value != 1f);
            Tweak.Add(local, f => f.FieldType == typeof(float) && Stamina(f.Name), (c, f, o) => StaminaMax(c, f, o), () => InfStamina.On);
            Tweak.Field(new[] { "PlayerScreenShake" }, "_shakeMultiplier", o => 0f, () => Visuals.NoShake != null && Visuals.NoShake.On);

            Tweak.Add(FishTypes, f => f.Name == "_holdReelSpeed" || f.Name == "_reelMultiIncreaseSpeed" || f.Name == "_lineReelStepLength", (c, f, o) => Mult(o, FastReel.Value), () => FastReel.Value > 1f);
            Tweak.Field(FishTypes, "_lostOnBaitChance", o => 0f, () => NeverLose.On);
            Tweak.Field(FishTypes, "_requireReelingToCatch", o => false, () => NoReelNeeded.On);
            Tweak.Field(FishTypes, "_shinyCreatureChance", o => 1f, () => AlwaysRare.On);
            Tweak.Field(FishTypes, "_catchTimeMinMax", o => ScaleRange(o, InstantBite.On ? 0.02f : BiteDelay.Value), () => InstantBite.On || BiteDelay.Value != 1f);
            Tweak.Field(new[] { "Item" }, "_ignoredBySeagulls", o => true, () => NoBirds.On);
            Tweak.Field(new[] { "Creature", "Item", "MapDot" }, "_dotsEnabled", o => true, () => FishDots.On);
        }

        private static bool Rapid(string n)
        {
            n = n.ToLowerInvariant();
            return n.Contains("firerate") || n.Contains("cooldown") || n.Contains("timebetween") || n.Contains("firedelay") || n.Contains("shootdelay") || n.Contains("shotdelay") || n.Contains("delaybetween") || n.Contains("shootrate") || n.Contains("timetofire");
        }

        private static bool Speed(string n, bool swim)
        {
            n = n.ToLowerInvariant();
            if (!n.Contains("speed") || n.Contains("sink") || n.Contains("rot") || n.Contains("look") || n.Contains("sens") || n.Contains("anim") || n.Contains("lerp") || n.Contains("smooth") || n.Contains("reel") || n.Contains("cur")) return false;
            return n.Contains("swim") == swim;
        }

        private static bool Jump(string n)
        {
            n = n.ToLowerInvariant();
            return n.Contains("jump") && (n.Contains("force") || n.Contains("height") || n.Contains("power") || n.Contains("velocity") || n.Contains("strength")) && !n.Contains("swim");
        }

        private static bool Stamina(string n)
        {
            n = n.ToLowerInvariant();
            return n.Contains("stamina") && !n.Contains("max") && !n.Contains("regen") && !n.Contains("drain") && !n.Contains("cost") && !n.Contains("rate") && !n.Contains("delay") && !n.Contains("use");
        }

        private static object StaminaMax(Component c, FieldInfo f, object orig)
        {
            foreach (var other in c.GetType().GetFields(G.Inst))
            {
                string n = other.Name.ToLowerInvariant();
                if (n.Contains("stamina") && n.Contains("max")) return (float)G.Num(other.GetValue(c), 100);
            }
            return Mathf.Max((float)G.Num(orig, 100), 100f);
        }

        private static object ScaleRange(object o, float m)
        {
            if (o is Vector2) { var v = (Vector2)o; return new Vector2(v.x * m, v.y * m); }
            if (o is float) return (float)o * m;
            return null;
        }

        // ---------- per frame ----------

        public static void Update()
        {
            foreach (var t in Tweak.All) t.Tick();

            if (InfAmmo.On || AutoReloadFull.On) RefillAmmo(InfAmmo.On);

            if (FreezeCreatures.On)
            {
                foreach (var c in G.Find("Creature"))
                {
                    if (c == null) continue;
                    Vector3 p;
                    if (!FrozenAt.TryGetValue(c, out p)) { FrozenAt[c] = c.transform.position; continue; }
                    c.transform.position = p;
                    var rb = c.GetComponent<Rigidbody>();
                    if (rb != null && !rb.isKinematic) rb.velocity = Vector3.zero;
                }
            }
            if (CreatureMagnet.On) BringCreatures(40f);
        }

        private static readonly HashSet<Component> SeenWeapons = new HashSet<Component>();

        private static void RefillAmmo(bool always)
        {
            foreach (var w in G.Find("Weapon"))
            {
                if (w == null) continue;
                bool fresh = SeenWeapons.Add(w);
                if (!always && !fresh) continue;
                double per = G.AmmoPerMag(w);
                if (double.IsNaN(per) || per <= 0) continue;
                double cur = G.Num(G.Get(w, "Ammo"));
                if (!double.IsNaN(cur) && cur >= per) continue;
                if (!G.Set(w, "<Ammo>k__BackingField", per)) G.Set(w, "Ammo", per);
            }
        }

        private static void AddMoney(int amount)
        {
            var mm = G.Singleton("MoneyManager");
            if (mm == null) { Menu.Toast("MoneyManager not found (load into the world first)."); return; }
            if (G.Call(mm, "AddMoney", amount) == null && G.Call(mm, "AddMoney", amount, true) == null && G.Call(mm, "AddMoney", amount, false) == null)
            {
                // AddMoney returns void, so null is also success; check the wallet to report.
            }
            Menu.Toast("Money: " + G.Num(G.Get(mm, "Money"), 0).ToString("N0") + (G.IsServer ? "" : "  (clients: host may undo this)"));
        }

        private static void BringCreatures(float radius)
        {
            var cam = G.Cam;
            var root = G.LocalRoot;
            if (cam == null || root == null) return;
            Vector3 spot = root.position + Vector3.ProjectOnPlane(cam.transform.forward, Vector3.up).normalized * 6f + Vector3.up;
            int i = 0;
            foreach (var c in G.Find("Creature"))
            {
                if (c == null || G.IsDead(c) || !c.gameObject.activeInHierarchy || G.IsLocal(c)) continue;
                var pt = G.T("Player");
                if (pt != null && c.GetComponentInParent(pt) != null) continue;
                if (Vector3.Distance(c.transform.position, root.position) > radius) continue;
                Vector3 offset = new Vector3((i % 5 - 2) * 1.5f, 0, (i / 5) * 1.5f);
                c.transform.position = spot + offset;
                var rb = c.GetComponent<Rigidbody>();
                if (rb != null) { rb.position = spot + offset; if (!rb.isKinematic) rb.velocity = Vector3.zero; }
                if (FrozenAt.ContainsKey(c)) FrozenAt[c] = spot + offset;
                i++;
            }
            if (radius > 100f) Menu.Toast("Brought " + i + " creatures.");
        }

        private static void KillAll()
        {
            int killed = 0;
            foreach (var c in G.Find("Creature", 0f))
            {
                if (c == null || G.IsDead(c)) continue;
                foreach (var m in new[] { "ServerKill", "Kill", "ServerDie", "Die", "OnDeath" })
                {
                    var method = c.GetType().GetMethods(G.All).FirstOrDefault(x => x.Name == m && x.GetParameters().Length == 0);
                    if (method == null) continue;
                    try { method.Invoke(c, null); killed++; break; } catch { }
                }
            }
            Menu.Toast(killed > 0 ? "Killed " + killed + " creatures." : "No kill route found in this game build (use One-Hit Kill instead).");
        }

        // ---------- Harmony patches ----------

        public static int PatchCount;

        public static void InstallPatches(HarmonyLib.Harmony h)
        {
            // Run aim / FOV right AFTER the game's own camera + movement scripts, so they can't overwrite it.
            foreach (var t in new[] { "PlayerCamera", "PlayerMovement" })
                foreach (var m in new[] { "Update", "LateUpdate", "FixedUpdate" })
                    Patch(h, t, m, null, "AfterGameCamera");

            Patch(h, "Weapon", "Shoot", "ShootPrefix", "ShootPostfix");
            Patch(h, "Weapon", "Reload", "ReloadPrefix", null);
            Patch(h, "Weapon", "Recoil", "RecoilPrefix", null);
            Patch(h, "PlayerVitals", "TakeDamage", "TakeDamagePrefix", null);
            Patch(h, "PlayerDying", "LocalDie", "DiePrefix", null);
            Patch(h, "PlayerDying", "ServerDie", "DiePrefix", null);
            // Scale damage once: on the hit route sent to the server, or the local hit if that route doesn't exist.
            if (Patch(h, null, "HitCreature", "DealDamagePrefix", null) == 0)
                Patch(h, "Creature", "LocalHit", "DealDamagePrefix", null);
            Patch(h, "MoneyManager", "RemoveMoney", "RemoveMoneyPrefix", null);
            Patch(h, "MoneyManager", "CanAfford", null, "CanAffordPostfix");
            Patch(h, "PlayerInventory", "ServerOnBaitUsed", "BaitPrefix", null);
            Patch(h, "Bird", "SetAttackingFood", "BirdPrefix", null);
            Patch(h, "Item", "CaughtByBird", "BirdPrefix", null);
            Patch(h, null, "ServerDropAll", "DropAllPrefix", null);
            Patch(h, null, "DropAllItems", "DropAllPrefix", null);
            Patch(h, null, "SetIsAfk", "AfkPrefix", null);
        }

        private static Type[] _allTypes;

        private static Type[] AllTypes()
        {
            if (_allTypes != null) return _allTypes;
            try { _allTypes = G.Asm.GetTypes(); }
            catch (ReflectionTypeLoadException e) { _allTypes = e.Types.Where(t => t != null).ToArray(); }
            return _allTypes;
        }

        private static int Patch(HarmonyLib.Harmony h, string typeName, string method, string prefix, string postfix)
        {
            IEnumerable<Type> types = typeName != null ? new[] { G.T(typeName) } : AllTypes();
            var pre = prefix != null ? new HarmonyMethod(typeof(Features).GetMethod(prefix, BindingFlags.Static | BindingFlags.NonPublic)) : null;
            var post = postfix != null ? new HarmonyMethod(typeof(Features).GetMethod(postfix, BindingFlags.Static | BindingFlags.NonPublic)) : null;
            int n = 0;
            foreach (var t in types)
            {
                if (t == null) continue;
                MethodInfo[] methods;
                try { methods = t.GetMethods(G.Inst | BindingFlags.Static | BindingFlags.DeclaredOnly); } catch { continue; }
                foreach (var m in methods)
                {
                    if (m.Name != method || m.IsAbstract || m.ContainsGenericParameters || m.GetMethodBody() == null) continue;
                    try { h.Patch(m, pre, post); n++; PatchCount++; }
                    catch (Exception e) { MelonLogger.Warning("Patch " + t.Name + "." + method + " failed: " + e.Message); }
                }
            }
            if (n > 0) MelonLogger.Msg("Patched " + (typeName ?? "*") + "." + method + " (" + n + ")");
            else MelonLogger.Msg("Not found in this build: " + (typeName ?? "*") + "." + method);
            return n;
        }

        private static bool IsLocalInstance(object inst)
        {
            var c = inst as Component;
            return c == null || G.LocalRoot == null || G.IsLocal(c);
        }

        private static void ScaleDamageArgs(object[] args, MethodBase m, float mult, float set)
        {
            var ps = m.GetParameters();
            for (int i = 0; i < ps.Length && i < args.Length; i++)
            {
                string n = ps[i].Name.ToLowerInvariant();
                if (!(n.Contains("damage") || n.Contains("dmg") || n == "amount")) continue;
                var t = ps[i].ParameterType;
                if (t == typeof(float)) args[i] = set >= 0 ? set : (float)args[i] * mult;
                else if (t == typeof(int)) args[i] = set >= 0 ? (int)set : Mathf.RoundToInt((int)args[i] * mult);
                else if (t == typeof(double)) args[i] = set >= 0 ? set : (double)args[i] * mult;
            }
        }

        private static void AfterGameCamera()
        {
            try { Aimbot.LateUpdate(); Visuals.ApplyCameraFov(); } catch { }
        }

        private static void ShootPrefix() { try { Aimbot.BeforeShot(); } catch { } }

        private static void ShootPostfix(object __instance)
        {
            try { Aimbot.AfterShot(); } catch { }
            if (InfAmmo.On)
            {
                double per = G.AmmoPerMag(__instance);
                if (!double.IsNaN(per) && !G.Set(__instance, "<Ammo>k__BackingField", per)) G.Set(__instance, "<Ammo>k__BackingField", per);
            }
        }

        private static bool ReloadPrefix(object __instance)
        {
            if (!NoReload.On) return true;
            double per = G.AmmoPerMag(__instance);
            if (double.IsNaN(per)) per = 999;
            if (!G.Set(__instance, "<Ammo>k__BackingField", per)) G.Set(__instance, "Ammo", per);
            return false;
        }

        private static bool RecoilPrefix() { return !NoRecoil.On; }

        private static bool TakeDamagePrefix(object __instance, object[] __args, MethodBase __originalMethod)
        {
            if (!IsLocalInstance(__instance)) return true;
            if (God.On) return false;
            if (DamageTaken.Value != 1f) ScaleDamageArgs(__args, __originalMethod, DamageTaken.Value, -1f);
            return true;
        }

        private static bool DiePrefix(object __instance)
        {
            return !((God.On || NeverDie.On) && IsLocalInstance(__instance));
        }

        private static void DealDamagePrefix(object[] __args, MethodBase __originalMethod)
        {
            if (OneHit.On) ScaleDamageArgs(__args, __originalMethod, 1f, 999999f);
            else if (DamageMult.Value != 1f) ScaleDamageArgs(__args, __originalMethod, DamageMult.Value, -1f);
        }

        private static bool RemoveMoneyPrefix() { return !FreeShop.On; }
        private static void CanAffordPostfix(ref bool __result) { if (FreeShop.On) __result = true; }
        private static bool BaitPrefix() { return !InfBait.On; }
        private static bool BirdPrefix() { return !NoBirds.On; }
        private static bool DropAllPrefix() { return !KeepInv.On; }

        private static void AfkPrefix(object[] __args)
        {
            if (!AntiAfk.On) return;
            for (int i = 0; i < __args.Length; i++) if (__args[i] is bool) __args[i] = false;
        }
    }
}
