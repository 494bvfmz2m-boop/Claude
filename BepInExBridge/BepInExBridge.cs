using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Runtime.CompilerServices;
using MelonLoader;
using UnityEngine;

[assembly: MelonInfo(typeof(BepInExBridge.Bridge), "BepInEx Bridge", "1.0.0", "BepInExBridge")]
[assembly: MelonGame(null, null)]

namespace BepInExBridge
{
    // Runs BepInEx 5 plugins inside MelonLoader without installing BepInEx's own loader.
    // It uses the real BepInEx.dll from How to Fish\BepInEx\core, sets up its paths and logging,
    // then creates every plugin from How to Fish\BepInEx\plugins exactly like BepInEx's chainloader does.
    public class Bridge : MelonMod
    {
        internal static string GameRoot;
        internal static string BepRoot;
        private static readonly List<string> SearchDirs = new List<string>();

        public override void OnInitializeMelon()
        {
            GameRoot = Path.GetDirectoryName(Process.GetCurrentProcess().MainModule.FileName);
            BepRoot = Path.Combine(GameRoot, "BepInEx");
            string core = Path.Combine(BepRoot, "core");
            if (!File.Exists(Path.Combine(core, "BepInEx.dll")))
            {
                LoggerInstance.Error("BepInEx.dll not found at " + core + ". Copy the BepInEx folder (core + plugins) into the game folder.");
                return;
            }
            if (File.Exists(Path.Combine(GameRoot, "winhttp.dll")) && File.Exists(Path.Combine(GameRoot, "doorstop_config.ini")))
                LoggerInstance.Warning("BepInEx's own loader (winhttp.dll + doorstop_config.ini) is still in the game folder. Delete those two files, or plugins load twice.");

            SearchDirs.Add(core);
            string plugins = Path.Combine(BepRoot, "plugins");
            if (Directory.Exists(plugins))
            {
                SearchDirs.Add(plugins);
                SearchDirs.AddRange(Directory.GetDirectories(plugins, "*", SearchOption.AllDirectories));
            }
            SearchDirs.Add(Path.Combine(GameRoot, Path.GetFileNameWithoutExtension(Process.GetCurrentProcess().MainModule.FileName) + "_Data", "Managed"));
            AppDomain.CurrentDomain.AssemblyResolve += Resolve;
        }

        public override void OnLateInitializeMelon()
        {
            if (BepRoot == null || !SearchDirs.Any()) return;
            try { Boot.Start(LoggerInstance); }
            catch (Exception e) { LoggerInstance.Error("BepInEx bridge failed to start: " + e); }
        }

        // Already-loaded assemblies win (so MelonLoader's Harmony/MonoMod are shared), then BepInEx/core, plugins, game Managed.
        private static Assembly Resolve(object sender, ResolveEventArgs args)
        {
            string name = new AssemblyName(args.Name).Name;
            foreach (var a in AppDomain.CurrentDomain.GetAssemblies())
            {
                try { if (a.GetName().Name == name) return a; } catch { }
            }
            foreach (var dir in SearchDirs)
            {
                string p = Path.Combine(dir, name + ".dll");
                if (File.Exists(p))
                {
                    try { return Assembly.LoadFrom(p); } catch { }
                }
            }
            return null;
        }
    }

    // Everything that touches BepInEx types lives here, so the resolver is registered before these types load.
    internal static class Boot
    {
        public static GameObject Manager;

        [MethodImpl(MethodImplOptions.NoInlining)]
        public static void Start(MelonLogger.Instance log)
        {
            // Paths.SetExecutablePath is what BepInEx's preloader calls first; everything else (config, logs) depends on it.
            var exe = Process.GetCurrentProcess().MainModule.FileName;
            typeof(BepInEx.Paths).GetMethod("SetExecutablePath", BindingFlags.Static | BindingFlags.NonPublic)
                .Invoke(null, new object[] { exe, Bridge.BepRoot, null, null });
            Directory.CreateDirectory(BepInEx.Paths.ConfigPath);

            BepInEx.Logging.Logger.Listeners.Add(new MelonLogListener());

            // Manager object, like BepInEx's chainloader (plugins are components on it).
            Manager = new GameObject("BepInEx_Manager");
            UnityEngine.Object.DontDestroyOnLoad(Manager);
            try
            {
                typeof(BepInEx.Bootstrap.Chainloader).GetProperty("ManagerObject", BindingFlags.Static | BindingFlags.Public)
                    .SetValue(null, Manager, null);
            }
            catch { }

            string plugins = Path.Combine(Bridge.BepRoot, "plugins");
            if (!Directory.Exists(plugins)) { log.Warning("No BepInEx\\plugins folder."); return; }

            var found = new List<Type>();
            foreach (var dll in Directory.GetFiles(plugins, "*.dll", SearchOption.AllDirectories))
            {
                Assembly asm;
                try { asm = Assembly.LoadFrom(dll); }
                catch (Exception e) { log.Warning("Could not load " + Path.GetFileName(dll) + ": " + e.Message); continue; }
                Type[] types;
                try { types = asm.GetTypes(); }
                catch (ReflectionTypeLoadException e)
                {
                    types = e.Types.Where(t => t != null).ToArray();
                    foreach (var le in e.LoaderExceptions.Take(3)) log.Warning(Path.GetFileName(dll) + ": " + le.Message);
                }
                foreach (var t in types)
                {
                    if (t.IsAbstract || !typeof(BepInEx.BaseUnityPlugin).IsAssignableFrom(t)) continue;
                    if (t.GetCustomAttributes(typeof(BepInEx.BepInPlugin), false).Length == 0) continue;
                    found.Add(t);
                }
            }

            foreach (var t in OrderByDependencies(found))
            {
                var meta = (BepInEx.BepInPlugin)t.GetCustomAttributes(typeof(BepInEx.BepInPlugin), false)[0];
                try
                {
                    var plugin = (BepInEx.BaseUnityPlugin)Manager.AddComponent(t);
                    if (plugin != null && !BepInEx.Bootstrap.Chainloader.PluginInfos.ContainsKey(meta.GUID))
                        BepInEx.Bootstrap.Chainloader.PluginInfos[meta.GUID] = plugin.Info;
                    log.Msg("Loaded BepInEx plugin: " + meta.Name + " " + meta.Version);
                }
                catch (Exception e)
                {
                    log.Error("Plugin " + meta.Name + " failed to start: " + (e.InnerException ?? e));
                }
            }
        }

        // Plugins that declare [BepInDependency] on another found plugin start after it.
        private static List<Type> OrderByDependencies(List<Type> types)
        {
            var guidOf = new Dictionary<Type, string>();
            foreach (var t in types) guidOf[t] = ((BepInEx.BepInPlugin)t.GetCustomAttributes(typeof(BepInEx.BepInPlugin), false)[0]).GUID;
            var result = new List<Type>();
            var pending = new List<Type>(types);
            for (int pass = 0; pass < types.Count + 1 && pending.Count > 0; pass++)
            {
                foreach (var t in pending.ToList())
                {
                    var deps = t.GetCustomAttributes(typeof(BepInEx.BepInDependency), true).Cast<BepInEx.BepInDependency>()
                        .Select(d => d.DependencyGUID).Where(g => guidOf.Values.Contains(g));
                    if (deps.All(g => result.Any(r => guidOf[r] == g))) { result.Add(t); pending.Remove(t); }
                }
            }
            result.AddRange(pending);
            return result;
        }
    }

    // Sends BepInEx log output to the MelonLoader console / Latest.log.
    internal class MelonLogListener : BepInEx.Logging.ILogListener
    {
        public void LogEvent(object sender, BepInEx.Logging.LogEventArgs e)
        {
            string text = "[" + e.Source.SourceName + "] " + e.Data;
            switch (e.Level)
            {
                case BepInEx.Logging.LogLevel.Fatal:
                case BepInEx.Logging.LogLevel.Error:
                    MelonLogger.Error(text); break;
                case BepInEx.Logging.LogLevel.Warning:
                    MelonLogger.Warning(text); break;
                case BepInEx.Logging.LogLevel.Debug:
                    break;
                default:
                    MelonLogger.Msg(text); break;
            }
        }

        public void Dispose() { }
    }
}
