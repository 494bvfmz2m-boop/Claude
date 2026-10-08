using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Runtime.CompilerServices;
using MelonLoader;
using UnityEngine;

namespace HowToFishMenu
{
    // Runs BepInEx 5 mods that are embedded inside this DLL (original, unchanged plugin code).
    // BepInEx.dll itself is embedded too and used for their config files and logging; nothing needs installing.
    internal static class BepInHost
    {
        public class EmbeddedMod
        {
            public string Name, Resource, Desc, Key;
            public Toggle Toggle;
            public Component Instance;
            public Assembly Asm;
        }

        // Embedded plugins (see build.sh: embedded/<file> -> resource name).
        public static readonly List<EmbeddedMod> Mods = new List<EmbeddedMod>
        {
            new EmbeddedMod { Name = "KRAKEN", Resource = "Embedded.KRAKEN.dll", Key = "INSERT", Desc = "KRAKEN v1.2.1 menu (INSERT, or CTRL+INSERT). Hotkeys F5-F11." },
            new EmbeddedMod { Name = "Fish Menu", Resource = "Embedded.FishMenu.dll", Key = "INSERT", Desc = "Fish Menu 2.1.1 (INSERT). Also uses INSERT, so turn KRAKEN or this off if both open together." },
            new EmbeddedMod { Name = "How to Fish Local Cheats", Resource = "Embedded.HowToFishCheats.dll", Key = "F8", Desc = "How to Fish Local Cheats 1.1.0 (F8)." },
        };

        private static readonly Dictionary<string, Assembly> Loaded = new Dictionary<string, Assembly>();
        private static bool _resolverOn;
        public static bool Started;
        public static string Error;

        public static void BuildMenu()
        {
            Menu.BeginCategory("Mods");
            foreach (var m in Mods)
            {
                var mod = m;
                mod.Toggle = Menu.AddToggle(m.Name, m.Desc + " Built into this DLL with its original code.", true, v => SetEnabled(mod, v));
            }
        }

        public static void InstallResolver()
        {
            if (_resolverOn) return;
            _resolverOn = true;
            AppDomain.CurrentDomain.AssemblyResolve += Resolve;
        }

        // Embedded assemblies by name; anything already loaded (Harmony, MonoMod, game code) is reused.
        private static Assembly Resolve(object sender, ResolveEventArgs args)
        {
            string name = new AssemblyName(args.Name).Name;
            Assembly a;
            if (Loaded.TryGetValue(name, out a)) return a;
            foreach (var x in AppDomain.CurrentDomain.GetAssemblies())
            {
                try { if (x.GetName().Name == name) return x; } catch { }
            }
            if (name == "BepInEx") return LoadEmbedded("Embedded.BepInEx.dll");
            return null;
        }

        private static Assembly LoadEmbedded(string resource)
        {
            using (var s = typeof(BepInHost).Assembly.GetManifestResourceStream(resource))
            {
                if (s == null) return null;
                var bytes = new byte[s.Length];
                int read = 0;
                while (read < bytes.Length) read += s.Read(bytes, read, bytes.Length - read);
                var asm = Assembly.Load(bytes);
                Loaded[asm.GetName().Name] = asm;
                return asm;
            }
        }

        public static void Start()
        {
            if (Started) return;
            Started = true;
            InstallResolver();
            try { Boot(); }
            catch (Exception e) { Error = e.Message; MelonLogger.Error("Embedded BepInEx mods failed to start: " + e); }
        }

        [MethodImpl(MethodImplOptions.NoInlining)]
        private static void Boot()
        {
            if (LoadEmbedded("Embedded.BepInEx.dll") == null) { MelonLogger.Warning("No embedded BepInEx in this build."); return; }

            // BepInEx's paths: configs go to How to Fish\UserData\BepInEx\config.
            string exe = Process.GetCurrentProcess().MainModule.FileName;
            string root = Path.Combine(Path.Combine(Path.GetDirectoryName(exe), "UserData"), "BepInEx");
            BepInBoot.Init(exe, root);

            foreach (var m in Mods)
            {
                try
                {
                    var asm = LoadEmbedded(m.Resource);
                    m.Asm = asm;
                    if (asm == null) { MelonLogger.Warning(m.Name + " is not in this build."); continue; }
                    if (m.Toggle == null || m.Toggle.On) m.Instance = BepInBoot.CreatePlugin(asm);
                    if (m.Instance != null) MelonLogger.Msg("Started " + m.Name + " (embedded)");
                }
                catch (Exception e) { MelonLogger.Error(m.Name + " failed to start: " + (e.InnerException ?? e)); }
            }
        }

        private static void SetEnabled(EmbeddedMod m, bool on)
        {
            if (!Started) return;
            try
            {
                if (m.Instance == null && on)
                {
                    if (m.Asm != null) m.Instance = BepInBoot.CreatePlugin(m.Asm);
                }
                else if (m.Instance != null)
                {
                    var b = m.Instance as Behaviour;
                    if (b != null) b.enabled = on;
                }
            }
            catch (Exception e) { MelonLogger.Warning(m.Name + ": " + e.Message); }
        }
    }

    // Everything touching BepInEx types is here, so the embedded BepInEx.dll is resolvable before these types load.
    internal static class BepInBoot
    {
        private static GameObject _manager;

        [MethodImpl(MethodImplOptions.NoInlining)]
        public static void Init(string exe, string root)
        {
            typeof(BepInEx.Paths).GetMethod("SetExecutablePath", BindingFlags.Static | BindingFlags.NonPublic)
                .Invoke(null, new object[] { exe, root, null, null });
            Directory.CreateDirectory(BepInEx.Paths.ConfigPath);
            BepInEx.Logging.Logger.Listeners.Add(new MelonLogListener());

            _manager = new GameObject("BepInEx_Manager");
            UnityEngine.Object.DontDestroyOnLoad(_manager);
            try
            {
                typeof(BepInEx.Bootstrap.Chainloader).GetProperty("ManagerObject", BindingFlags.Static | BindingFlags.Public)
                    .SetValue(null, _manager, null);
            }
            catch { }
        }

        private static IEnumerable<Type> PluginTypes(Assembly asm)
        {
            Type[] types;
            try { types = asm.GetTypes(); }
            catch (ReflectionTypeLoadException e) { types = e.Types.Where(t => t != null).ToArray(); }
            return types.Where(t => !t.IsAbstract && typeof(BepInEx.BaseUnityPlugin).IsAssignableFrom(t)
                                    && t.GetCustomAttributes(typeof(BepInEx.BepInPlugin), false).Length > 0);
        }

        [MethodImpl(MethodImplOptions.NoInlining)]
        public static Component CreatePlugin(Assembly asm)
        {
            Component first = null;
            foreach (var t in PluginTypes(asm))
            {
                var meta = (BepInEx.BepInPlugin)t.GetCustomAttributes(typeof(BepInEx.BepInPlugin), false)[0];
                var plugin = (BepInEx.BaseUnityPlugin)_manager.AddComponent(t);
                if (plugin != null && !BepInEx.Bootstrap.Chainloader.PluginInfos.ContainsKey(meta.GUID))
                    BepInEx.Bootstrap.Chainloader.PluginInfos[meta.GUID] = plugin.Info;
                if (first == null) first = plugin;
            }
            return first;
        }
    }

    // BepInEx log output -> MelonLoader console / Latest.log.
    internal class MelonLogListener : BepInEx.Logging.ILogListener
    {
        public void LogEvent(object sender, BepInEx.Logging.LogEventArgs e)
        {
            string text = "[" + e.Source.SourceName + "] " + e.Data;
            switch (e.Level)
            {
                case BepInEx.Logging.LogLevel.Fatal:
                case BepInEx.Logging.LogLevel.Error: MelonLogger.Error(text); break;
                case BepInEx.Logging.LogLevel.Warning: MelonLogger.Warning(text); break;
                case BepInEx.Logging.LogLevel.Debug: break;
                default: MelonLogger.Msg(text); break;
            }
        }

        public void Dispose() { }
    }
}
