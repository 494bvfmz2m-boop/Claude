// Embedded "How to Fish - Advanced Mod Menu" engine by chadi7bark (decompiled from HowToFishModMenu.dll v0.4.46).
// Its feature code is kept as-is; only the MelonMod shell, its own key input and the casino prefix signature changed,
// so this menu can drive it directly. Credit to the original author.
using System;
using System.Collections;
using System.Collections.Generic;
using System.Diagnostics;
using System.Reflection;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
using HarmonyLib;
using MelonLoader;
using UnityEngine;

namespace HowToFishMenu.Advanced
{
	internal sealed class AdvancedEngine
	{
		private sealed class ClientInventorySnapshotItem
		{
			public object Item;

			public byte Slot;

			public bool WasHeld;

			public bool Recovered;

			public bool Failed;

			public bool HasItemId;

			public byte ItemId;

			public object FreshItem;

			public int RestoreSlot;

			public float NextAttemptAt;

			public int Attempts;

			public int RecoveryPhase;

			public int PurchaseAttempts;

			public int PutAttempts;

			public bool MissingLogged;

			public string NameAtSnapshot;

			public ClientInventorySnapshotItem(object item, byte slot, bool wasHeld)
			{
				Item = item;
				Slot = slot;
				WasHeld = wasHeld;
				Recovered = false;
				Failed = false;
				FreshItem = null;
				RestoreSlot = (wasHeld ? (-1) : slot);
				NextAttemptAt = 0f;
				Attempts = 0;
				RecoveryPhase = 0;
				PurchaseAttempts = 0;
				PutAttempts = 0;
				MissingLogged = false;
				NameAtSnapshot = GetUnityName(item);
				byte id;
				HasItemId = TryGetRecoveryItemId(item, out id);
				ItemId = id;
			}
		}

		private enum Page
		{
			Root,
			Angler,
			Fishing,
			Arsenal,
			Island,
			System
		}

		private enum EntryKind
		{
			Category,
			Toggle,
			Value,
			Action,
			Unavailable
		}

		private enum Feature
		{
			None,
			ResetAll,
			InfiniteHealth,
			KeepInventory,
			InfiniteStamina,
			NoFallDamage,
			Sobriety,
			InfiniteBeer,
			MovementSpeed,
			SwimNoDrown,
			InfiniteCarryWeight,
			NeverLoseFish,
			LineNeverBreaks,
			InstantCatch,
			AutoPerfectReel,
			BarrierBreakSpeed,
			InfiniteBait,
			BirdsNeverSteal,
			GuaranteedRare,
			FishSize,
			BiteDelay,
			HighlightFish,
			FastReel,
			InfiniteAmmo,
			NoReload,
			NoRecoilSpread,
			DamageMultiplier,
			OneHitKill,
			UnlockKnifeInspects,
			FreezeCreatureAI,
			BossHealth,
			InfiniteMoney,
			SellPriceMultiplier,
			RigCasino,
			UnlockAllIslands,
			UnlockAllSkins,
			RevealMap,
			InstantQuest,
			NoclipFly,
			BoatNeverSinks,
			PhysicsThrowForce,
			WeatherTime,
			TeleportToFriend,
			PreviousIsland,
			NextIsland,
			Fov,
			FreeCamera,
			HideInterface,
			ThirdPerson,
			DisableScreenShake,
			UnderwaterClarity,
			PhotoMode,
			HostOnly,
			SaveBackup,
			ReadOnly,
			OverlayOpacity
		}

		private sealed class MenuEntry
		{
			public string Name;

			public EntryKind Kind;

			public Feature Feature;

			public Page TargetPage;

			private MenuEntry(string name, EntryKind kind, Feature feature, Page targetPage)
			{
				Name = name;
				Kind = kind;
				Feature = feature;
				TargetPage = targetPage;
			}

			public static MenuEntry Category(string name, Page page)
			{
				return new MenuEntry(name, EntryKind.Category, Feature.None, page);
			}

			public static MenuEntry Toggle(string name, Feature feature)
			{
				return new MenuEntry(name, EntryKind.Toggle, feature, Page.Root);
			}

			public static MenuEntry Value(string name, Feature feature)
			{
				return new MenuEntry(name, EntryKind.Value, feature, Page.Root);
			}

			public static MenuEntry Action(string name, Feature feature)
			{
				return new MenuEntry(name, EntryKind.Action, feature, Page.Root);
			}

			public static MenuEntry Unavailable(string name, Feature feature)
			{
				return new MenuEntry(name, EntryKind.Unavailable, feature, Page.Root);
			}
		}

		private struct WeaponTuning
		{
			public float Spread;

			public int Recoil;
		}

		private struct RodTuning
		{
			public float HoldSpeed;

			public float Step;

			public float Increase;
		}

		private struct MovementTuning
		{
			public int WaterDamage;

			public float WaterDelay;

			public float SinkSpeed;

			public int SwimJumpAllowed;
		}

		private struct BaitInfoTuning
		{
			public float LostChance;

			public Vector2 CatchTime;

			public bool RequireReeling;
		}

		private const int VK_BACK = 8;

		private const int VK_UP = 38;

		private const int VK_DOWN = 40;

		private const int VK_RSHIFT = 161;

		private const int InfiniteMoneyTarget = 999999;

		public static bool InfiniteHealth;

		public static bool KeepInventory;

		public static bool SwimNoDrown;

		public static bool NeverLoseFish;

		public static bool InstantCatch;

		public static bool AutoPerfectReel;

		public static bool InfiniteBait;

		public static bool BirdsNeverSteal;

		public static bool GuaranteedRare;

		public static bool HighlightFish;

		public static bool FastReel;

		public static bool InfiniteAmmo;

		public static bool NoReload;

		public static bool NoRecoilSpread;

		public static bool OneHitKill;

		public static bool FreezeCreatureAI;

		public static bool InfiniteMoney;

		public static bool RigCasino;

		public static bool RevealMap;

		public static bool HideInterface;

		public static bool DisableScreenShake;

		public static float FishSizeMultiplier = 1f;

		public static float BiteDelayMultiplier = 1f;

		public static float DamageMultiplier = 1f;

		public static int BossHealthPercent = 100;

		public static float SellPriceMultiplier = 1f;

		public static int Fov = 90;

		public static int OverlayOpacityPercent = 94;

		private static bool _inSellContext;

		private static bool _internalBossClamp;

		private static bool _moneyRestoreGuard;

		private static float _nextMoneyEnforceLog;

		private static float _nextInfiniteHealthLog;

		private static float _nextDemiGodAfkSyncTime;

		private static bool _demiGodServerAfkSent;

		private static int _fastReelLastFrame = -1;

		private static int _fastReelLastRodId = int.MinValue;

		private static float _nextFastReelLog;

		private static float _nextClientAutoCatchSyncTime;

		private static int _lastClientAutoCatchItemId = int.MinValue;

		private static readonly HashSet<int> _rareProgressCandidates = new HashSet<int>();

		private static readonly Dictionary<int, object> _rareOriginalWritePermissions = new Dictionary<int, object>();

		private static readonly HashSet<int> _rareAuthorityLogged = new HashSet<int>();

		private static float _nextRareAuthorityLog;

		private static byte _casinoChosenBetColor = byte.MaxValue;

		private static bool _casinoBetTracked;

		private static int _casinoPreBetWorth;

		private static bool _casinoRouletteLockReady;

		private static bool _casinoRouletteLockLogged;

		private static Vector3 _casinoRouletteLockBallPos;

		private static float _casinoRouletteLockWheelRot;

		private static float _nextCasinoAuthorityPush;

		private static float _casinoForceResultUntil;

		private static float _nextCasinoAuthorityLog;

		private static object _casinoOriginalWritePermission;

		private static bool _casinoOriginalPermissionCaptured;

		private static bool _clientAllIslandsOverride;

		private static byte _clientAllIslandsMax;

		private static object _islandOriginalWritePermission;

		private static bool _islandOriginalPermissionCaptured;

		private static float _nextIslandAuthorityPush;

		private static float _nextIslandAuthorityLog;

		private bool _backWasDown;

		private bool _upWasDown;

		private bool _downWasDown;

		private bool _rshiftWasDown;

		private bool _menuOpen;

		private Page _page;

		private int _selectedIndex;

		private string _status = "BACKSPACE to open.";

		private float _nextRefreshTime;

		private float _nextBirdRefreshTime;

		private float _nextClientSellSyncTime;

		private static bool _networkRoleLogged;

		private static int _knownWaterDamage = int.MinValue;

		private static float _clientKeepRecoveryStart;

		private static float _clientKeepRecoveryUntil;

		private static int _clientKeepRecoveryCursor;

		private static float _clientKeepNextGlobalAttempt;

		private static bool _clientKeepWaitingForRespawn;

		private static readonly List<ClientInventorySnapshotItem> _clientKeepInventorySnapshot = new List<ClientInventorySnapshotItem>();

		private static readonly Dictionary<int, float> _clientSellMultiplierApplied = new Dictionary<int, float>();

		private static readonly Dictionary<int, float> _clientBirdReclaimLastAttempt = new Dictionary<int, float>();

		private int _clientIslandCursor = -1;

		private int _pendingClientIslandIndex = -1;

		private int _pendingClientIslandDirection;

		private float _pendingClientIslandUntil;

		private float _nextPendingClientIslandCheck;

		private Vector3 _pendingFriendTeleportPos;

		private float _pendingFriendTeleportRot;

		private float _pendingFriendTeleportUntil;

		private float _nextFriendTeleportReinforce;

		private GUIStyle _boxStyle;

		private GUIStyle _titleStyle;

		private GUIStyle _subTitleStyle;

		private GUIStyle _normalStyle;

		private GUIStyle _dimStyle;

		private GUIStyle _enabledStyle;

		private GUIStyle _selectedStyle;

		private GUIStyle _selectedEnabledStyle;

		private GUIStyle _footerStyle;

		private Texture2D _panelTex;

		private Texture2D _selectedTex;

		private Texture2D _dividerTex;

		private static Assembly _gameAssembly;

		private static Type _playerType;

		private static Type _playerVitalsType;

		private static Type _playerDyingType;

		private static Type _deadPlayerType;

		private static Type _playerInventoryType;

		private static Type _playerMovementType;

		private static Type _playerScreenShakeType;

		private static Type _playerUIType;

		private static Type _playerCameraType;

		private static Type _playerToolMovementType;

		private static Type _itemType;

		private static Type _itemSkinType;

		private static Type _gameInfoType;

		private static Type _weaponType;

		private static Type _fishingRodType;

		private static Type _baitType;

		private static Type _baitInfoType;

		private static Type _birdType;

		private static Type _moneyManagerType;

		private static Type _creatureType;

		private static Type _creatureManagerType;

		private static Type _creatureUtilsType;

		private static Type _bossManagerType;

		private static Type _casinoManagerType;

		private static Type _localCasinoType;

		private static Type _saveManagerType;

		private static Type _islandManagerType;

		private static Type _onlineIslandManagerType;

		private static Type _boatType;

		private static Type _mapDotType;

		private static Type _otherPlayerType;

		private static Type _serverType;

		private static Type _closeItemsUIType;

		private static Type _fishingUIType;

		private static Type _savedCreatureType;

		private static Type _dazedCommandsType;

		private HarmonyLib.Harmony _harmony;

		private readonly Dictionary<int, bool> _birdOriginals = new Dictionary<int, bool>();

		private readonly Dictionary<int, bool> _closeDotOriginals = new Dictionary<int, bool>();

		private readonly Dictionary<int, WeaponTuning> _weaponOriginals = new Dictionary<int, WeaponTuning>();

		private readonly Dictionary<int, RodTuning> _rodOriginals = new Dictionary<int, RodTuning>();

		private readonly Dictionary<int, MovementTuning> _movementOriginals = new Dictionary<int, MovementTuning>();

		private readonly Dictionary<int, BaitInfoTuning> _baitInfoOriginals = new Dictionary<int, BaitInfoTuning>();

		private readonly Dictionary<int, float> _shakeOriginals = new Dictionary<int, float>();

		private readonly Dictionary<int, Vector3> _fishScaleOriginals = new Dictionary<int, Vector3>();

		private readonly Dictionary<int, float> _fishWeightOriginals = new Dictionary<int, float>();

		private readonly Dictionary<int, float> _fishWeightNetworkAttempt = new Dictionary<int, float>();

		private int? _rareChanceOriginal;

		private bool? _itemDotsOriginalEnabled;

		private bool _hideInterfaceApplied;

		private bool _fovTouched;

		private int _lastAppliedFov = int.MinValue;

		private int _lastFovCameraId = int.MinValue;

		private readonly MenuEntry[] _rootEntries = new MenuEntry[6]
		{
			MenuEntry.Category("ANGLER", Page.Angler),
			MenuEntry.Category("FISHING", Page.Fishing),
			MenuEntry.Category("ARSENAL", Page.Arsenal),
			MenuEntry.Category("ISLAND", Page.Island),
			MenuEntry.Category("SYSTEM", Page.System),
			MenuEntry.Action("Reset All Mods", Feature.ResetAll)
		};

		private readonly MenuEntry[] _anglerEntries = new MenuEntry[3]
		{
			MenuEntry.Toggle("GodMode", Feature.InfiniteHealth),
			MenuEntry.Toggle("Keep Inventory on Death", Feature.KeepInventory),
			MenuEntry.Toggle("Swim + No Drowning", Feature.SwimNoDrown)
		};

		private readonly MenuEntry[] _fishingEntries = new MenuEntry[8]
		{
			MenuEntry.Toggle("Never Lose a Fish", Feature.NeverLoseFish),
			MenuEntry.Toggle("Auto-Perfect Reel", Feature.AutoPerfectReel),
			MenuEntry.Toggle("Infinite Bait", Feature.InfiniteBait),
			MenuEntry.Toggle("Birds Never Steal", Feature.BirdsNeverSteal),
			MenuEntry.Toggle("Guaranteed Rare Variant", Feature.GuaranteedRare),
			MenuEntry.Value("Bite Delay", Feature.BiteDelay),
			MenuEntry.Toggle("Highlight Fish Underwater", Feature.HighlightFish),
			MenuEntry.Toggle("Fast Reel", Feature.FastReel)
		};

		private readonly MenuEntry[] _arsenalEntries = new MenuEntry[6]
		{
			MenuEntry.Toggle("Infinite Ammo", Feature.InfiniteAmmo),
			MenuEntry.Toggle("No Reload", Feature.NoReload),
			MenuEntry.Toggle("No Recoil / Spread", Feature.NoRecoilSpread),
			MenuEntry.Value("Damage Multiplier", Feature.DamageMultiplier),
			MenuEntry.Toggle("One-Hit Kill", Feature.OneHitKill),
			MenuEntry.Value("Boss Health", Feature.BossHealth)
		};

		private readonly MenuEntry[] _islandEntries = new MenuEntry[8]
		{
			MenuEntry.Toggle("Infinite Money / No Spending", Feature.InfiniteMoney),
			MenuEntry.Value("Sell Price Multiplier", Feature.SellPriceMultiplier),
			MenuEntry.Toggle("Rig Fish Casino", Feature.RigCasino),
			MenuEntry.Action("Unlock All Islands", Feature.UnlockAllIslands),
			MenuEntry.Action("Unlock All Item Skins", Feature.UnlockAllSkins),
			MenuEntry.Action("Teleport to Friend", Feature.TeleportToFriend),
			MenuEntry.Action("Previous Island", Feature.PreviousIsland),
			MenuEntry.Action("Next Island", Feature.NextIsland)
		};

		private readonly MenuEntry[] _systemEntries = new MenuEntry[3]
		{
			MenuEntry.Value("Field of View", Feature.Fov),
			MenuEntry.Toggle("Hide Interface", Feature.HideInterface),
			MenuEntry.Toggle("Disable Screen Shake", Feature.DisableScreenShake)
		};

		[DllImport("user32.dll")]
		private static extern short GetAsyncKeyState(int vKey);

		[DllImport("user32.dll")]
		private static extern IntPtr GetForegroundWindow();

		[DllImport("user32.dll")]
		private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

		public void Init()
		{
			MelonLogger.Msg("How to Fish Tweaks Menu v0.4.46 FISH SIZE REMOVED + FRIEND TP FIX ready.");
			MelonLogger.Msg("MONEY FIX: host/offline authoritative wallet floor=999999; joined clients never write MoneyManager/SyncVar state and only force supported purchases free.");
			MelonLogger.Msg("FAST REEL FIX: native DecreaseLineLength is forced every reel frame and live reel speed is pinned high.");
			MelonLogger.Msg("CLIENT FIX: joined clients use free purchase RPCs and Server.TeleportPlayer for island travel.");
			MelonLogger.Msg("KEEP INVENTORY SERVER-RECREATE: remote clients snapshot Item.ID + slot, wait for the real RespawnPlayer RPC, force BuyItem(isFree=true), then move each fresh server-created copy back to its saved slot.");
			MelonLogger.Msg("GODMODE: host/offline blocks TakeDamage; remote clients pin server-side AFK immunity while keeping local AFK state hidden.");
			MelonLogger.Msg("MP SAFETY: runtime/network effects stay dormant until the real gameplay player + world are stable; default 1x/off options send no packets.");
			ResolveGameTypes();
			InstallPatches();
		}

		public void Shutdown()
		{
			ResetEverything();
		}

		public void Tick()
		{
			if (!IsGameForeground())
			{
				return;
			}
			bool flag = false;
			bool flag2 = false;
			bool flag3 = false;
			bool flag4 = false;
			if (flag && !_backWasDown)
			{
				if (!_menuOpen)
				{
					_menuOpen = true;
					_page = Page.Root;
					_selectedIndex = 0;
					_status = "Choose a category.";
				}
				else if (_page != 0)
				{
					_page = Page.Root;
					_selectedIndex = 0;
					_status = "Back to categories.";
				}
				else
				{
					_menuOpen = false;
					_status = "BACKSPACE to open.";
				}
			}
			if (_menuOpen)
			{
				MenuEntry[] array = CurrentEntries();
				if (flag2 && !_upWasDown)
				{
					_selectedIndex--;
					if (_selectedIndex < 0)
					{
						_selectedIndex = array.Length - 1;
					}
				}
				if (flag3 && !_downWasDown)
				{
					_selectedIndex++;
					if (_selectedIndex >= array.Length)
					{
						_selectedIndex = 0;
					}
				}
				if (flag4 && !_rshiftWasDown)
				{
					ActivateSelected();
				}
			}
			_backWasDown = flag;
			_upWasDown = flag2;
			_downWasDown = flag3;
			_rshiftWasDown = flag4;
			if (Time.unscaledTime >= _nextRefreshTime)
			{
				_nextRefreshTime = Time.unscaledTime + 0.12f;
				ApplyRuntimeEffects();
			}
			ProcessPendingClientIslandTeleport();
			ProcessPendingFriendTeleport();
			ApplyClientIslandUnlockAuthority();
			ApplyClientDemiGodServerAfkShield();
			ApplyAggressiveClientCasinoAuthority();
			if (Time.unscaledTime >= _nextBirdRefreshTime)
			{
				_nextBirdRefreshTime = Time.unscaledTime + 0.75f;
				ApplyBirdProtection();
				ApplyClientBirdReclaim();
				ApplyBaitInfoTuning();
				ApplyRareChance();
				ApplyGuaranteedRareToExisting();
				ApplyFishHighlight();
				ApplyFishSizeVisuals();
			}
		}

		public void DrawOwnPanel()
		{
			if (!_menuOpen)
			{
				return;
			}
			EnsureStyles();
			MenuEntry[] array = CurrentEntries();
			int num = 9;
			int num2 = 0;
			if (array.Length > num)
			{
				num2 = _selectedIndex - num / 2;
				if (num2 < 0)
				{
					num2 = 0;
				}
				if (num2 > array.Length - num)
				{
					num2 = array.Length - num;
				}
			}
			int num3 = Math.Min(num, array.Length);
			float num4 = 430f;
			float num5 = 28f;
			float num6 = 94f;
			float num7 = 67f;
			float height = num6 + (float)num3 * num5 + num7;
			float num8 = (float)Screen.width - num4 - 28f;
			float num9 = 50f;
			GUI.Box(new Rect(num8, num9, num4, height), GUIContent.none, _boxStyle);
			GUI.Label(new Rect(num8 + 16f, num9 + 11f, num4 - 32f, 25f), "HOW TO FISH // TWEAK DECK", _titleStyle);
			GUI.Label(new Rect(num8 + 17f, num9 + 37f, num4 - 34f, 18f), PageName(_page) + "   |   " + (_selectedIndex + 1) + "/" + array.Length, _subTitleStyle);
			GUI.DrawTexture(new Rect(num8 + 16f, num9 + 61f, num4 - 32f, 2f), _dividerTex);
			GUI.Label(new Rect(num8 + 17f, num9 + 68f, num4 - 34f, 19f), "BACKSPACE  BACK/CLOSE     UP/DOWN  MOVE     RSHIFT  SELECT", _footerStyle);
			float num10 = num9 + num6;
			for (int i = 0; i < num3; i++)
			{
				int num11 = num2 + i;
				MenuEntry menuEntry = array[num11];
				bool flag = num11 == _selectedIndex;
				bool flag2 = menuEntry.Kind == EntryKind.Toggle && IsEnabled(menuEntry.Feature);
				if (flag)
				{
					GUI.DrawTexture(new Rect(num8 + 12f, num10 + 1f, num4 - 24f, num5 - 2f), _selectedTex);
				}
				string entryPrefix = GetEntryPrefix(menuEntry);
				string text = (flag ? ">>  " : "    ") + entryPrefix + "  " + menuEntry.Name;
				if (menuEntry.Kind == EntryKind.Value)
				{
					text = text + "  " + GetValueText(menuEntry.Feature);
				}
				GUI.Label(style: (menuEntry.Kind == EntryKind.Unavailable && !flag) ? _dimStyle : ((flag && flag2) ? _selectedEnabledStyle : ((!flag) ? ((!flag2) ? _normalStyle : _enabledStyle) : _selectedStyle)), position: new Rect(num8 + 17f, num10 + 3f, num4 - 34f, num5 - 4f), text: text);
				num10 += num5;
			}
			GUI.DrawTexture(new Rect(num8 + 16f, num10 + 5f, num4 - 32f, 2f), _dividerTex);
			GUI.Label(new Rect(num8 + 17f, num10 + 12f, num4 - 34f, 20f), "SELECTED: " + array[_selectedIndex].Name.ToUpperInvariant(), _subTitleStyle);
			GUI.Label(new Rect(num8 + 17f, num10 + 32f, num4 - 34f, 28f), _status, _footerStyle);
		}

		private string GetEntryPrefix(MenuEntry e)
		{
			if (e.Kind == EntryKind.Category)
			{
				return "[>]";
			}
			if (e.Kind == EntryKind.Action)
			{
				return "[>]";
			}
			if (e.Kind == EntryKind.Value)
			{
				return "[*]";
			}
			if (e.Kind == EntryKind.Unavailable)
			{
				return "[-]";
			}
			if (!IsEnabled(e.Feature))
			{
				return "[ ]";
			}
			return "[X]";
		}

		private void ActivateSelected()
		{
			MenuEntry[] array = CurrentEntries();
			if (_selectedIndex < 0 || _selectedIndex >= array.Length)
			{
				return;
			}
			MenuEntry menuEntry = array[_selectedIndex];
			if (menuEntry.Kind == EntryKind.Category)
			{
				_page = menuEntry.TargetPage;
				_selectedIndex = 0;
				_status = "BACKSPACE returns to categories.";
			}
			else if (menuEntry.Kind == EntryKind.Unavailable)
			{
				_status = "This option is visible, but not safely mapped in this game build yet.";
			}
			else if (menuEntry.Kind == EntryKind.Toggle)
			{
				bool flag = !IsEnabled(menuEntry.Feature);
				if (flag && menuEntry.Feature == Feature.AutoPerfectReel)
				{
					BiteDelayMultiplier = 1f;
				}
				SetEnabled(menuEntry.Feature, flag);
				if (menuEntry.Feature == Feature.BirdsNeverSteal && !flag)
				{
					RestoreBirdFlags();
				}
				if (menuEntry.Feature == Feature.HighlightFish && !flag)
				{
					RestoreFishHighlight();
				}
				if (menuEntry.Feature == Feature.NoRecoilSpread && !flag)
				{
					RestoreAllWeapons();
				}
				if (menuEntry.Feature == Feature.FastReel && !flag)
				{
					RestoreAllRods();
				}
				if (menuEntry.Feature == Feature.HideInterface && !flag)
				{
					RestoreInterface();
				}
				if (menuEntry.Feature == Feature.GuaranteedRare && flag)
				{
					ApplyGuaranteedRareToExisting();
				}
				else if (menuEntry.Feature == Feature.GuaranteedRare && !flag)
				{
					RestoreRareAuthorityPermissions();
				}
				if (flag && menuEntry.Feature == Feature.AutoPerfectReel)
				{
					_status = (IsRemoteClientSession() ? "Auto-Perfect Reel: ON  // remote authority -> host zero-line + inventory RPC" : "Auto-Perfect Reel: ON  // host authority -> zero-line + inventory route");
				}
				else if (flag && menuEntry.Feature == Feature.GuaranteedRare)
				{
					_status = (IsRemoteClientSession() ? "Guaranteed Rare Variant: ON  // forged drip SyncVar authority + journal" : "Guaranteed Rare Variant: ON  // host SetDrip authority + journal");
				}
				else if (menuEntry.Feature == Feature.InfiniteMoney)
				{
					_status = "Infinite Money / No Spending: " + (flag ? "ON" : "OFF");
					MelonLogger.Msg("[MoneyFix] Infinite Money toggled " + (flag ? "ON" : "OFF") + ".");
					if (flag && IsRemoteClientSession())
					{
						MelonLogger.Msg("[MoneyFix] CLIENT SAFE MODE -> wallet SyncVar untouched; CanAfford bypass + free purchase RPCs only.");
					}
				}
				else if (menuEntry.Feature == Feature.FastReel)
				{
					_status = "Fast Reel: " + (flag ? "ON // live line force" : "OFF");
					MelonLogger.Msg("[FastReel] toggled " + (flag ? "ON" : "OFF") + ".");
				}
				else
				{
					_status = menuEntry.Name + ": " + (flag ? "ON" : "OFF");
				}
			}
			else if (menuEntry.Kind == EntryKind.Value)
			{
				CycleValue(menuEntry.Feature);
			}
			else
			{
				RunAction(menuEntry.Feature);
			}
		}

		private void RunAction(Feature feature)
		{
			switch (feature)
			{
			case Feature.ResetAll:
				ResetEverything();
				_status = "All runtime mods reset.";
				break;
			case Feature.TeleportToFriend:
				TeleportToFriend();
				break;
			case Feature.PreviousIsland:
				TeleportIslandOrdered(-1);
				break;
			case Feature.NextIsland:
				TeleportIslandOrdered(1);
				break;
			case Feature.UnlockAllIslands:
				UnlockAllIslands();
				break;
			case Feature.UnlockAllSkins:
				UnlockAllSkins();
				break;
			}
		}

		private void CycleValue(Feature feature)
		{
			switch (feature)
			{
			case Feature.FishSize:
			{
				float[] values7 = new float[5] { 1f, 2f, 3f, 5f, 10f };
				FishSizeMultiplier = NextFloat(values7, FishSizeMultiplier);
				if (Math.Abs(FishSizeMultiplier - 1f) < 0.001f)
				{
					RestoreFishScales();
				}
				else
				{
					ApplyFishSizeVisuals();
				}
				_status = "Fish Size: " + FishSizeMultiplier.ToString("0.#") + "x";
				break;
			}
			case Feature.BiteDelay:
			{
				float[] values6 = new float[5] { 1f, 0.5f, 0.25f, 0.1f, 2f };
				float num = NextFloat(values6, BiteDelayMultiplier);
				if (Math.Abs(num - 1f) > 0.001f)
				{
					AutoPerfectReel = false;
				}
				BiteDelayMultiplier = num;
				if (Math.Abs(num - 1f) > 0.001f)
				{
					_status = "Bite Delay: " + num.ToString("0.##") + "x  // Auto-Perfect Reel OFF";
				}
				else
				{
					_status = "Bite Delay: 1x (normal)";
				}
				break;
			}
			case Feature.DamageMultiplier:
			{
				float[] values5 = new float[6] { 1f, 2f, 5f, 10f, 25f, 50f };
				DamageMultiplier = NextFloat(values5, DamageMultiplier);
				_status = "Damage: " + DamageMultiplier.ToString("0.#") + "x";
				break;
			}
			case Feature.BossHealth:
			{
				int[] values4 = new int[6] { 100, 75, 50, 25, 10, 1 };
				BossHealthPercent = NextInt(values4, BossHealthPercent);
				RefreshBossHealth();
				_status = "Boss Health: " + BossHealthPercent + "%  // live boss updated";
				break;
			}
			case Feature.SellPriceMultiplier:
			{
				float[] values3 = new float[7] { 1f, 2f, 3f, 5f, 10f, 25f, 50f };
				SellPriceMultiplier = NextFloat(values3, SellPriceMultiplier);
				_status = "Sell Price: " + SellPriceMultiplier.ToString("0.#") + "x";
				break;
			}
			case Feature.Fov:
			{
				int[] values2 = new int[8] { 60, 70, 80, 90, 100, 110, 120, 130 };
				Fov = NextInt(values2, Fov);
				_fovTouched = true;
				_lastAppliedFov = int.MinValue;
				ApplyFov(FindLocalPlayer());
				_status = "FOV: " + Fov;
				break;
			}
			case Feature.OverlayOpacity:
			{
				int[] values = new int[7] { 100, 94, 85, 75, 65, 55, 45 };
				OverlayOpacityPercent = NextInt(values, OverlayOpacityPercent);
				RebuildGuiTextures();
				_status = "Overlay Opacity: " + OverlayOpacityPercent + "%";
				break;
			}
			}
		}

		private string GetValueText(Feature feature)
		{
			switch (feature)
			{
			case Feature.FishSize:
				return FishSizeMultiplier.ToString("0.#") + "x";
			case Feature.BiteDelay:
				return BiteDelayMultiplier.ToString("0.##") + "x";
			case Feature.DamageMultiplier:
				return DamageMultiplier.ToString("0.#") + "x";
			case Feature.BossHealth:
				return BossHealthPercent + "%";
			case Feature.SellPriceMultiplier:
				return SellPriceMultiplier.ToString("0.#") + "x";
			case Feature.Fov:
				return Fov.ToString();
			case Feature.OverlayOpacity:
				return OverlayOpacityPercent + "%";
			default:
				return "";
			}
		}

		private MenuEntry[] CurrentEntries()
		{
			if (_page == Page.Angler)
			{
				return _anglerEntries;
			}
			if (_page == Page.Fishing)
			{
				return _fishingEntries;
			}
			if (_page == Page.Arsenal)
			{
				return _arsenalEntries;
			}
			if (_page == Page.Island)
			{
				return _islandEntries;
			}
			if (_page == Page.System)
			{
				return _systemEntries;
			}
			return _rootEntries;
		}

		private static string PageName(Page page)
		{
			switch (page)
			{
			case Page.Angler:
				return "ANGLER";
			case Page.Fishing:
				return "FISHING";
			case Page.Arsenal:
				return "ARSENAL";
			case Page.Island:
				return "ISLAND";
			case Page.System:
				return "SYSTEM";
			default:
				return "CATEGORIES";
			}
		}

		private void ApplyRuntimeEffects()
		{
			InstantCatch = false;
			object obj = FindLocalPlayer();
			if (obj != null)
			{
				ApplyMovement(obj);
				ApplyWeapon(obj);
				ApplyRod(obj);
				ApplyClientAutoPerfectCatchAuthority(obj);
				ApplyScreenShake(obj);
				ApplyFov(obj);
				ApplyHideInterface();
				LogNetworkRoleOnce();
				ApplyInfiniteMoneyState(obj);
				if (KeepInventory && _clientKeepInventorySnapshot.Count > 0)
				{
					ProcessClientKeepInventoryRecovery(obj);
				}
				if (Time.unscaledTime >= _nextClientSellSyncTime)
				{
					_nextClientSellSyncTime = Time.unscaledTime + 0.75f;
					ApplyClientSellMultiplier(obj);
				}
			}
		}

		private void ApplyInfiniteMoneyState(object player)
		{
			if (InfiniteMoney && !(_moneyManagerType == null))
			{
				object obj = FindFirstActive(_moneyManagerType);
				if (obj != null && !IsRemoteClientSession())
				{
					EnsureAuthoritativeMoneyFloor(obj, player, 999999);
				}
			}
		}

		private static int ReadMoneyValue(object money)
		{
			if (money == null)
			{
				return 0;
			}
			try
			{
				PropertyInfo propertyInfo = Property(_moneyManagerType, "Money");
				if (propertyInfo != null)
				{
					return Convert.ToInt32(propertyInfo.GetValue(money, null));
				}
			}
			catch
			{
			}
			try
			{
				FieldInfo fieldInfo = Field(_moneyManagerType, "<Money>k__BackingField");
				if (fieldInfo != null)
				{
					return Convert.ToInt32(fieldInfo.GetValue(money));
				}
			}
			catch
			{
			}
			try
			{
				FieldInfo fieldInfo2 = Field(_moneyManagerType, "_money");
				object obj3 = ((fieldInfo2 != null) ? fieldInfo2.GetValue(money) : null);
				if (obj3 != null)
				{
					PropertyInfo propertyInfo2 = Property(obj3.GetType(), "Value");
					if (propertyInfo2 != null)
					{
						return Convert.ToInt32(propertyInfo2.GetValue(obj3, null));
					}
					FieldInfo fieldInfo3 = Field(obj3.GetType(), "_value");
					if (fieldInfo3 != null)
					{
						return Convert.ToInt32(fieldInfo3.GetValue(obj3));
					}
				}
			}
			catch
			{
			}
			return 0;
		}

		private static void ForceMoneyLocalDisplay(object money, int value)
		{
			if (money == null)
			{
				return;
			}
			try
			{
				FieldInfo fieldInfo = Field(_moneyManagerType, "<Money>k__BackingField");
				if (fieldInfo != null)
				{
					fieldInfo.SetValue(money, value);
				}
			}
			catch
			{
			}
			try
			{
				ForceSyncVarLocalValue(money, "_money", value);
			}
			catch
			{
			}
		}

		private static void ForceMoneySyncVarAuthoritative(object money, int value)
		{
			if (money == null)
			{
				return;
			}
			try
			{
				FieldInfo fieldInfo = Field(_moneyManagerType, "_money");
				object obj = ((fieldInfo != null) ? fieldInfo.GetValue(money) : null);
				if (obj != null)
				{
					MethodInfo methodInfo = Method(obj.GetType(), "SetValue", 3);
					if (methodInfo != null)
					{
						methodInfo.Invoke(obj, new object[3] { value, true, true });
					}
					else
					{
						FieldInfo fieldInfo2 = Field(obj.GetType(), "_value");
						if (fieldInfo2 != null)
						{
							fieldInfo2.SetValue(obj, value);
						}
					}
				}
				FieldInfo fieldInfo3 = Field(_moneyManagerType, "<Money>k__BackingField");
				if (fieldInfo3 != null)
				{
					fieldInfo3.SetValue(money, value);
				}
			}
			catch
			{
			}
		}

		private static void EnsureAuthoritativeMoneyFloor(object money, object player, int target)
		{
			if (money == null || _moneyRestoreGuard)
			{
				return;
			}
			int num = ReadMoneyValue(money);
			if (num >= target)
			{
				return;
			}
			_moneyRestoreGuard = true;
			try
			{
				int num2 = target - num;
				MethodInfo methodInfo = Method(_moneyManagerType, "AddMoney", 2);
				if (methodInfo != null && player != null && num2 > 0)
				{
					try
					{
						methodInfo.Invoke(money, new object[2] { num2, player });
					}
					catch
					{
						ForceMoneySyncVarAuthoritative(money, target);
					}
				}
				else
				{
					ForceMoneySyncVarAuthoritative(money, target);
				}
				if (Time.unscaledTime >= _nextMoneyEnforceLog)
				{
					_nextMoneyEnforceLog = Time.unscaledTime + 2f;
					MelonLogger.Msg("[MoneyFix] AUTHORITATIVE MONEY FLOOR -> " + target + ".");
				}
			}
			finally
			{
				_moneyRestoreGuard = false;
			}
		}

		private void ApplyMovement(object player)
		{
			object component = GetComponent(player, _playerMovementType);
			if (component == null)
			{
				return;
			}
			FieldInfo fieldInfo = Field(_playerMovementType, "_damageFromWater");
			FieldInfo fieldInfo2 = Field(_playerMovementType, "_underwaterDamageDelay");
			FieldInfo fieldInfo3 = Field(_playerMovementType, "_sinkSpeed");
			FieldInfo fieldInfo4 = Field(_playerMovementType, "_swimJumpAmountAllowed");
			FieldInfo fieldInfo5 = Field(_playerMovementType, "_swimJumpCount");
			FieldInfo fieldInfo6 = Field(_playerMovementType, "_timeWentUnderWater");
			FieldInfo fieldInfo7 = Field(_playerMovementType, "_timeOfLastDamage");
			int key = UnityId(component);
			if (!_movementOriginals.ContainsKey(key))
			{
				MovementTuning value = default(MovementTuning);
				try
				{
					value.WaterDamage = ((fieldInfo != null) ? Convert.ToInt32(fieldInfo.GetValue(component)) : 0);
					if (value.WaterDamage > 0)
					{
						_knownWaterDamage = value.WaterDamage;
					}
				}
				catch
				{
				}
				try
				{
					value.WaterDelay = ((fieldInfo2 != null) ? Convert.ToSingle(fieldInfo2.GetValue(component)) : 0f);
				}
				catch
				{
				}
				try
				{
					value.SinkSpeed = ((fieldInfo3 != null) ? Convert.ToSingle(fieldInfo3.GetValue(component)) : 0f);
				}
				catch
				{
				}
				try
				{
					value.SwimJumpAllowed = ((fieldInfo4 != null) ? Convert.ToInt32(fieldInfo4.GetValue(component)) : 0);
				}
				catch
				{
				}
				_movementOriginals[key] = value;
			}
			MovementTuning movementTuning = _movementOriginals[key];
			try
			{
				if (SwimNoDrown)
				{
					if (fieldInfo != null)
					{
						fieldInfo.SetValue(component, 0);
					}
					if (fieldInfo2 != null)
					{
						fieldInfo2.SetValue(component, 999999f);
					}
					if (fieldInfo4 != null)
					{
						fieldInfo4.SetValue(component, 1000000);
					}
					if (fieldInfo5 != null)
					{
						fieldInfo5.SetValue(component, 0);
					}
					if (fieldInfo6 != null)
					{
						fieldInfo6.SetValue(component, Time.time);
					}
					if (fieldInfo7 != null)
					{
						fieldInfo7.SetValue(component, Time.time);
					}
					if (fieldInfo3 != null)
					{
						fieldInfo3.SetValue(component, movementTuning.SinkSpeed);
					}
				}
				else
				{
					if (fieldInfo != null)
					{
						fieldInfo.SetValue(component, movementTuning.WaterDamage);
					}
					if (fieldInfo2 != null)
					{
						fieldInfo2.SetValue(component, movementTuning.WaterDelay);
					}
					if (fieldInfo3 != null)
					{
						fieldInfo3.SetValue(component, movementTuning.SinkSpeed);
					}
					if (fieldInfo4 != null)
					{
						fieldInfo4.SetValue(component, movementTuning.SwimJumpAllowed);
					}
				}
			}
			catch
			{
			}
		}

		private void ApplyWeapon(object player)
		{
			object heldSubItem = GetHeldSubItem(player, "Weapon");
			if (heldSubItem == null)
			{
				return;
			}
			int key = UnityId(heldSubItem);
			FieldInfo fieldInfo = Field(_weaponType, "_spread");
			FieldInfo fieldInfo2 = Field(_weaponType, "_recoilKnockback");
			if (NoRecoilSpread)
			{
				if (!_weaponOriginals.ContainsKey(key))
				{
					WeaponTuning value = default(WeaponTuning);
					try
					{
						value.Spread = ((fieldInfo != null) ? Convert.ToSingle(fieldInfo.GetValue(heldSubItem)) : 0f);
					}
					catch
					{
					}
					try
					{
						value.Recoil = ((fieldInfo2 != null) ? Convert.ToInt32(fieldInfo2.GetValue(heldSubItem)) : 0);
					}
					catch
					{
					}
					_weaponOriginals[key] = value;
				}
				try
				{
					if (fieldInfo != null)
					{
						fieldInfo.SetValue(heldSubItem, 0f);
					}
				}
				catch
				{
				}
				try
				{
					if (fieldInfo2 != null)
					{
						fieldInfo2.SetValue(heldSubItem, 0);
					}
					return;
				}
				catch
				{
					return;
				}
			}
			WeaponTuning value2;
			if (!_weaponOriginals.TryGetValue(key, out value2))
			{
				return;
			}
			try
			{
				if (fieldInfo != null)
				{
					fieldInfo.SetValue(heldSubItem, value2.Spread);
				}
			}
			catch
			{
			}
			try
			{
				if (fieldInfo2 != null)
				{
					fieldInfo2.SetValue(heldSubItem, value2.Recoil);
				}
			}
			catch
			{
			}
			_weaponOriginals.Remove(key);
		}

		private void ApplyRod(object player)
		{
			object heldSubItem = GetHeldSubItem(player, "FishingRod");
			if (heldSubItem == null)
			{
				return;
			}
			int key = UnityId(heldSubItem);
			FieldInfo fieldInfo = Field(_fishingRodType, "_holdReelSpeed");
			FieldInfo fieldInfo2 = Field(_fishingRodType, "_lineReelStepLength");
			FieldInfo fieldInfo3 = Field(_fishingRodType, "_reelMultiIncreaseSpeed");
			if (FastReel)
			{
				if (!_rodOriginals.ContainsKey(key))
				{
					RodTuning value = default(RodTuning);
					try
					{
						value.HoldSpeed = ((fieldInfo != null) ? Convert.ToSingle(fieldInfo.GetValue(heldSubItem)) : 0f);
					}
					catch
					{
					}
					try
					{
						value.Step = ((fieldInfo2 != null) ? Convert.ToSingle(fieldInfo2.GetValue(heldSubItem)) : 0f);
					}
					catch
					{
					}
					try
					{
						value.Increase = ((fieldInfo3 != null) ? Convert.ToSingle(fieldInfo3.GetValue(heldSubItem)) : 0f);
					}
					catch
					{
					}
					_rodOriginals[key] = value;
				}
				RodTuning rodTuning = _rodOriginals[key];
				try
				{
					if (fieldInfo != null)
					{
						fieldInfo.SetValue(heldSubItem, rodTuning.HoldSpeed * 10f);
					}
				}
				catch
				{
				}
				try
				{
					if (fieldInfo2 != null)
					{
						fieldInfo2.SetValue(heldSubItem, rodTuning.Step * 10f);
					}
				}
				catch
				{
				}
				try
				{
					if (fieldInfo3 != null)
					{
						fieldInfo3.SetValue(heldSubItem, rodTuning.Increase * 12f);
					}
					return;
				}
				catch
				{
					return;
				}
			}
			RodTuning value2;
			if (!_rodOriginals.TryGetValue(key, out value2))
			{
				return;
			}
			try
			{
				if (fieldInfo != null)
				{
					fieldInfo.SetValue(heldSubItem, value2.HoldSpeed);
				}
			}
			catch
			{
			}
			try
			{
				if (fieldInfo2 != null)
				{
					fieldInfo2.SetValue(heldSubItem, value2.Step);
				}
			}
			catch
			{
			}
			try
			{
				if (fieldInfo3 != null)
				{
					fieldInfo3.SetValue(heldSubItem, value2.Increase);
				}
			}
			catch
			{
			}
			_rodOriginals.Remove(key);
		}

		private void ApplyBaitInfoTuning()
		{
			if (_baitInfoType == null)
			{
				return;
			}
			UnityEngine.Object[] array = FindObjects(_baitInfoType);
			FieldInfo fieldInfo = Field(_baitInfoType, "_lostOnBaitChance");
			FieldInfo fieldInfo2 = Field(_baitInfoType, "_catchTimeMinMax");
			FieldInfo fieldInfo3 = Field(_baitInfoType, "_requireReelingToCatch");
			foreach (object obj in array)
			{
				if (obj == null)
				{
					continue;
				}
				int key = UnityId(obj);
				if (!_baitInfoOriginals.ContainsKey(key))
				{
					BaitInfoTuning value = default(BaitInfoTuning);
					try
					{
						value.LostChance = ((fieldInfo != null) ? Convert.ToSingle(fieldInfo.GetValue(obj)) : 0f);
					}
					catch
					{
					}
					try
					{
						value.CatchTime = ((fieldInfo2 != null) ? ((Vector2)fieldInfo2.GetValue(obj)) : Vector2.one);
					}
					catch
					{
						value.CatchTime = Vector2.one;
					}
					try
					{
						value.RequireReeling = fieldInfo3 != null && Convert.ToBoolean(fieldInfo3.GetValue(obj));
					}
					catch
					{
					}
					_baitInfoOriginals[key] = value;
				}
				BaitInfoTuning baitInfoTuning = _baitInfoOriginals[key];
				try
				{
					if (fieldInfo != null)
					{
						fieldInfo.SetValue(obj, NeverLoseFish ? 0f : baitInfoTuning.LostChance);
					}
					if (fieldInfo3 != null)
					{
						fieldInfo3.SetValue(obj, !AutoPerfectReel && baitInfoTuning.RequireReeling);
					}
					if (fieldInfo2 != null)
					{
						Vector2 vector = baitInfoTuning.CatchTime;
						if (InstantCatch)
						{
							vector = new Vector2(0.02f, 0.02f);
						}
						else if (Math.Abs(BiteDelayMultiplier - 1f) > 0.001f)
						{
							vector = baitInfoTuning.CatchTime * BiteDelayMultiplier;
						}
						fieldInfo2.SetValue(obj, vector);
					}
				}
				catch
				{
				}
			}
		}

		private void ApplyRareChance()
		{
			object obj = FindFirst(_creatureManagerType);
			if (obj == null)
			{
				return;
			}
			FieldInfo fieldInfo = Field(_creatureManagerType, "_shinyCreatureChance");
			if (fieldInfo == null)
			{
				return;
			}
			if (!_rareChanceOriginal.HasValue)
			{
				try
				{
					_rareChanceOriginal = Convert.ToInt32(fieldInfo.GetValue(obj));
				}
				catch
				{
					_rareChanceOriginal = 100;
				}
			}
			try
			{
				fieldInfo.SetValue(obj, GuaranteedRare ? 1 : _rareChanceOriginal.Value);
			}
			catch
			{
			}
		}

		private void ApplyGuaranteedRareToExisting()
		{
			if (GuaranteedRare && !(_creatureType == null))
			{
				UnityEngine.Object[] array = FindObjects(_creatureType);
				for (int i = 0; i < array.Length; i++)
				{
					ForceDripVariant(array[i]);
				}
			}
		}

		private static void ForceDripVariant(object creature)
		{
			if (!GuaranteedRare || creature == null || _creatureType == null)
			{
				return;
			}
			try
			{
				PropertyInfo propertyInfo = Property(_creatureType, "IsDead");
				if (propertyInfo != null && Convert.ToBoolean(propertyInfo.GetValue(creature, null)))
				{
					return;
				}
				bool flag = GetNetworkBool(creature, "IsServerInitialized") || GetNetworkBool(creature, "IsServerStarted") || GetNetworkBool(creature, "IsOffline");
				if (flag)
				{
					PropertyInfo propertyInfo2 = Property(_creatureType, "IsDrip");
					if (!(propertyInfo2 != null) || !Convert.ToBoolean(propertyInfo2.GetValue(creature, null)))
					{
						MethodInfo methodInfo = Method(_creatureType, "SetDrip", 0);
						if (methodInfo != null)
						{
							try
							{
								methodInfo.Invoke(creature, null);
							}
							catch
							{
							}
						}
					}
				}
				if (!flag && IsRemoteClientSession())
				{
					ForceDripNetworkStateAggressive(creature);
				}
				ForceLocalDripState(creature);
				ForceLocalDripVisuals(creature);
			}
			catch
			{
			}
		}

		private static void ForceLocalDripState(object creature)
		{
			try
			{
				FieldInfo fieldInfo = Field(_creatureType, "_isDrip");
				object obj = ((fieldInfo != null) ? fieldInfo.GetValue(creature) : null);
				if (obj == null)
				{
					return;
				}
				MethodInfo methodInfo = Method(obj.GetType(), "SetValue", 3);
				if (methodInfo != null)
				{
					try
					{
						methodInfo.Invoke(obj, new object[3] { true, false, false });
						return;
					}
					catch
					{
					}
				}
				FieldInfo fieldInfo2 = Field(obj.GetType(), "_value");
				if (fieldInfo2 != null)
				{
					fieldInfo2.SetValue(obj, true);
				}
			}
			catch
			{
			}
		}

		private static void ForceDripNetworkStateAggressive(object creature)
		{
			if (!GuaranteedRare || creature == null || _creatureType == null || !IsRemoteClientSession())
			{
				return;
			}
			try
			{
				FieldInfo fieldInfo = Field(_creatureType, "_isDrip");
				object obj = ((fieldInfo != null) ? fieldInfo.GetValue(creature) : null);
				if (obj == null)
				{
					return;
				}
				int num = UnityId(creature);
				if (!_rareOriginalWritePermissions.ContainsKey(num))
				{
					object obj2 = null;
					Type type = obj.GetType();
					while (type != null && obj2 == null)
					{
						FieldInfo field = type.GetField("Settings", BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic);
						if (field != null)
						{
							try
							{
								obj2 = field.GetValue(obj);
							}
							catch
							{
							}
						}
						type = type.BaseType;
					}
					if (obj2 != null)
					{
						FieldInfo fieldInfo2 = Field(obj2.GetType(), "WritePermission");
						object obj4 = ((fieldInfo2 != null) ? fieldInfo2.GetValue(obj2) : null);
						if (obj4 != null)
						{
							_rareOriginalWritePermissions[num] = obj4;
						}
					}
				}
				MethodInfo methodInfo = Method(obj.GetType(), "UpdatePermissions", 1);
				if (methodInfo != null)
				{
					ParameterInfo[] parameters = methodInfo.GetParameters();
					if (parameters.Length == 1 && parameters[0].ParameterType.IsEnum)
					{
						object obj5 = Enum.Parse(parameters[0].ParameterType, "ClientUnsynchronized");
						methodInfo.Invoke(obj, new object[1] { obj5 });
					}
				}
				MethodInfo methodInfo2 = Method(obj.GetType(), "UpdateSendRate", 1);
				if (methodInfo2 != null)
				{
					try
					{
						methodInfo2.Invoke(obj, new object[1] { 0f });
					}
					catch
					{
					}
				}
				MethodInfo methodInfo3 = Method(obj.GetType(), "SetValue", 3);
				if (methodInfo3 != null)
				{
					methodInfo3.Invoke(obj, new object[3] { true, true, true });
				}
				MethodInfo methodInfo4 = Method(obj.GetType(), "DirtyAll", 0);
				if (methodInfo4 != null)
				{
					try
					{
						methodInfo4.Invoke(obj, null);
					}
					catch
					{
					}
				}
				MethodInfo methodInfo5 = Method(creature.GetType(), "DirtySyncType", 0);
				if (methodInfo5 != null)
				{
					try
					{
						methodInfo5.Invoke(creature, null);
					}
					catch
					{
					}
				}
				if (_rareAuthorityLogged.Add(num) || Time.unscaledTime >= _nextRareAuthorityLog)
				{
					_nextRareAuthorityLog = Time.unscaledTime + 2f;
					MelonLogger.Msg("[Rare] REMOTE AUTHORITY FORGE -> " + GetUnityName(creature) + " _isDrip=true | permission=ClientUnsynchronized | SetValue(true,true,true) + DirtyAll.");
				}
			}
			catch (Exception ex)
			{
				if (Time.unscaledTime >= _nextRareAuthorityLog)
				{
					_nextRareAuthorityLog = Time.unscaledTime + 2f;
					MelonLogger.Warning("[Rare] Remote drip authority forge failed: " + RootMessage(ex));
				}
			}
		}

		private static void RestoreRareAuthorityPermissions()
		{
			if (_creatureType == null)
			{
				return;
			}
			try
			{
				UnityEngine.Object[] array = FindObjects(_creatureType);
				FieldInfo fieldInfo = Field(_creatureType, "_isDrip");
				foreach (object obj in array)
				{
					if (obj == null)
					{
						continue;
					}
					int key = UnityId(obj);
					object value;
					if (!_rareOriginalWritePermissions.TryGetValue(key, out value) || value == null)
					{
						continue;
					}
					object obj2 = ((fieldInfo != null) ? fieldInfo.GetValue(obj) : null);
					if (obj2 == null)
					{
						continue;
					}
					MethodInfo methodInfo = Method(obj2.GetType(), "UpdatePermissions", 1);
					if (methodInfo != null)
					{
						try
						{
							methodInfo.Invoke(obj2, new object[1] { value });
						}
						catch
						{
						}
					}
				}
			}
			catch
			{
			}
			_rareOriginalWritePermissions.Clear();
			_rareAuthorityLogged.Clear();
		}

		private static void ForceLocalDripVisuals(object creature)
		{
			try
			{
				FieldInfo fieldInfo = Field(_creatureType, "_disableOnShiny");
				FieldInfo fieldInfo2 = Field(_creatureType, "_enableOnShiny");
				GameObject gameObject = ((fieldInfo != null) ? (fieldInfo.GetValue(creature) as GameObject) : null);
				GameObject gameObject2 = ((fieldInfo2 != null) ? (fieldInfo2.GetValue(creature) as GameObject) : null);
				if (gameObject != null)
				{
					gameObject.SetActive(false);
				}
				if (gameObject2 != null)
				{
					gameObject2.SetActive(true);
				}
				PropertyInfo propertyInfo = Property(_creatureType, "Mesh");
				PropertyInfo propertyInfo2 = Property(_creatureType, "DripMesh");
				Mesh mesh = ((propertyInfo != null) ? (propertyInfo.GetValue(creature, null) as Mesh) : null);
				Mesh mesh2 = ((propertyInfo2 != null) ? (propertyInfo2.GetValue(creature, null) as Mesh) : null);
				if (mesh2 == null)
				{
					return;
				}
				Component component = creature as Component;
				if (component == null)
				{
					return;
				}
				MeshFilter[] componentsInChildren = component.GetComponentsInChildren<MeshFilter>(true);
				foreach (MeshFilter meshFilter in componentsInChildren)
				{
					if (!(meshFilter == null) && (mesh == null || meshFilter.sharedMesh == mesh))
					{
						meshFilter.sharedMesh = mesh2;
					}
				}
			}
			catch
			{
			}
		}

		private static void CreatureAwakePostfix(object __instance)
		{
			ForceDripVariant(__instance);
		}

		private static void CreatureStartServerPostfix(object __instance)
		{
			ForceDripVariant(__instance);
		}

		private static void CreatureStartClientPostfix(object __instance)
		{
			ForceDripVariant(__instance);
		}

		private static void CreatureIsDripPostfix(ref bool __result)
		{
			if (GuaranteedRare)
			{
				__result = true;
			}
		}

		private static void OnlineIslandMaxUnlockedPostfix(ref byte __result)
		{
			if (_clientAllIslandsOverride && IsRemoteClientSession() && __result < _clientAllIslandsMax)
			{
				__result = _clientAllIslandsMax;
			}
		}

		private void ApplyBirdProtection()
		{
			if (_itemType == null || !BirdsNeverSteal)
			{
				return;
			}
			FieldInfo fieldInfo = Field(_itemType, "_ignoredBySeagulls");
			if (fieldInfo == null)
			{
				return;
			}
			UnityEngine.Object[] array = FindObjects(_itemType);
			foreach (object obj in array)
			{
				if (obj == null)
				{
					continue;
				}
				int key = UnityId(obj);
				if (!_birdOriginals.ContainsKey(key))
				{
					try
					{
						_birdOriginals[key] = Convert.ToBoolean(fieldInfo.GetValue(obj));
					}
					catch
					{
						_birdOriginals[key] = false;
					}
				}
				try
				{
					fieldInfo.SetValue(obj, true);
				}
				catch
				{
				}
			}
		}

		private void ApplyFishHighlight()
		{
			if (_itemType == null)
			{
				return;
			}
			FieldInfo fieldInfo = Field(_itemType, "_ignoredByCloseDots");
			PropertyInfo propertyInfo = Property(_itemType, "Creature");
			if (fieldInfo == null || propertyInfo == null)
			{
				return;
			}
			UnityEngine.Object[] array = FindObjects(_itemType);
			foreach (object obj in array)
			{
				if (obj == null)
				{
					continue;
				}
				object obj2 = null;
				try
				{
					obj2 = propertyInfo.GetValue(obj, null);
				}
				catch
				{
				}
				if (obj2 == null)
				{
					continue;
				}
				int key = UnityId(obj);
				if (!_closeDotOriginals.ContainsKey(key))
				{
					try
					{
						_closeDotOriginals[key] = Convert.ToBoolean(fieldInfo.GetValue(obj));
					}
					catch
					{
						_closeDotOriginals[key] = false;
					}
				}
				if (HighlightFish)
				{
					try
					{
						fieldInfo.SetValue(obj, false);
					}
					catch
					{
					}
				}
			}
			if (!HighlightFish)
			{
				return;
			}
			object obj6 = FindFirst(_closeItemsUIType);
			MethodInfo methodInfo = Method(_closeItemsUIType, "ToggleItemDots", 1);
			FieldInfo fieldInfo2 = Field(_closeItemsUIType, "_dotsEnabled");
			try
			{
				if (obj6 != null && !_itemDotsOriginalEnabled.HasValue && fieldInfo2 != null)
				{
					_itemDotsOriginalEnabled = Convert.ToBoolean(fieldInfo2.GetValue(obj6));
				}
				if (obj6 != null && methodInfo != null)
				{
					methodInfo.Invoke(obj6, new object[1] { true });
				}
			}
			catch
			{
			}
		}

		private void ApplyFishSizeVisuals()
		{
			if (_itemType == null)
			{
				return;
			}
			PropertyInfo propertyInfo = Property(_itemType, "Creature");
			if (propertyInfo == null)
			{
				return;
			}
			UnityEngine.Object[] array = FindObjects(_itemType);
			foreach (object obj in array)
			{
				if (obj == null)
				{
					continue;
				}
				object obj2 = null;
				try
				{
					obj2 = propertyInfo.GetValue(obj, null);
				}
				catch
				{
				}
				if (obj2 == null)
				{
					continue;
				}
				Component component = obj as Component;
				if (component == null || component.transform == null)
				{
					continue;
				}
				int num = UnityId(obj);
				if (!_fishScaleOriginals.ContainsKey(num))
				{
					_fishScaleOriginals[num] = component.transform.localScale;
				}
				Vector3 vector = _fishScaleOriginals[num];
				Vector3 vector2 = vector * FishSizeMultiplier;
				TryApplyNetworkFishWeight(obj, num);
				try
				{
					if ((component.transform.localScale - vector2).sqrMagnitude > 1E-06f)
					{
						component.transform.localScale = vector2;
					}
				}
				catch
				{
				}
			}
		}

		private void TryApplyNetworkFishWeight(object item, int id)
		{
			if (item == null)
			{
				return;
			}
			try
			{
				PropertyInfo propertyInfo = Property(_itemType, "RandomizedWeight");
				if (!(propertyInfo == null))
				{
					float value = Convert.ToSingle(propertyInfo.GetValue(item, null));
					if (!_fishWeightOriginals.ContainsKey(id))
					{
						_fishWeightOriginals[id] = value;
					}
					float num = _fishWeightOriginals[id];
					float num2 = num * FishSizeMultiplier;
					float value2;
					if (!_fishWeightNetworkAttempt.TryGetValue(id, out value2) || !(Math.Abs(value2 - num2) < 0.001f))
					{
						_fishWeightNetworkAttempt[id] = num2;
						TryWriteFishNetworkWeight(item, num2, "size multiplier");
					}
				}
			}
			catch (Exception ex)
			{
				MelonLogger.Warning("[ClientFix] Fish weight sync failed: " + RootMessage(ex));
			}
		}

		private bool TryWriteFishNetworkWeight(object item, float targetWeight, string reason)
		{
			if (item == null)
			{
				return false;
			}
			try
			{
				FieldInfo fieldInfo = Field(_itemType, "_syncedRandomWeight");
				if (fieldInfo == null)
				{
					return false;
				}
				object value = fieldInfo.GetValue(item);
				if (value == null)
				{
					return false;
				}
				bool flag = GetNetworkBool(item, "IsServerInitialized") || GetNetworkBool(item, "IsServerStarted");
				bool flag2 = false;
				if (!flag)
				{
					try
					{
						FieldInfo fieldInfo2 = Field(value.GetType(), "Settings");
						object obj = ((fieldInfo2 != null) ? fieldInfo2.GetValue(value) : null);
						if (obj != null)
						{
							FieldInfo fieldInfo3 = Field(obj.GetType(), "WritePermission");
							object obj2 = ((fieldInfo3 != null) ? fieldInfo3.GetValue(obj) : null);
							flag2 = obj2 != null && obj2.ToString().IndexOf("ClientUnsynchronized", StringComparison.OrdinalIgnoreCase) >= 0;
						}
					}
					catch
					{
					}
				}
				if (!flag && !flag2)
				{
					MelonLogger.Msg("[ClientFix] Fish weight network sync unavailable for " + GetUnityName(item) + " (server-only SyncVar); visual multiplier stays local for this unmodded host.");
					return false;
				}
				MethodInfo methodInfo = Method(value.GetType(), "SetValue", 3);
				if (methodInfo == null)
				{
					return false;
				}
				methodInfo.Invoke(value, new object[3] { targetWeight, true, true });
				MelonLogger.Msg("[ClientFix] FISH WEIGHT SYNC -> " + GetUnityName(item) + " = " + targetWeight.ToString("0.###") + " // " + reason);
				return true;
			}
			catch (Exception ex)
			{
				MelonLogger.Warning("[ClientFix] Fish weight write failed: " + RootMessage(ex));
				return false;
			}
		}

		private void RestoreFishScales()
		{
			if (_itemType == null || _fishScaleOriginals.Count == 0)
			{
				return;
			}
			UnityEngine.Object[] array = FindObjects(_itemType);
			foreach (object obj in array)
			{
				Vector3 value;
				if (!_fishScaleOriginals.TryGetValue(UnityId(obj), out value))
				{
					continue;
				}
				float value2;
				if (_fishWeightOriginals.TryGetValue(UnityId(obj), out value2))
				{
					TryWriteFishNetworkWeight(obj, value2, "restore normal size");
				}
				Component component = obj as Component;
				if (!(component == null) && !(component.transform == null))
				{
					try
					{
						component.transform.localScale = value;
					}
					catch
					{
					}
				}
			}
			_fishScaleOriginals.Clear();
			_fishWeightOriginals.Clear();
			_fishWeightNetworkAttempt.Clear();
		}

		private void ApplyMapReveal()
		{
			if (!RevealMap || _mapDotType == null)
			{
				return;
			}
			MethodInfo methodInfo = Method(_mapDotType, "UpdateAlpha", 1);
			if (methodInfo == null)
			{
				return;
			}
			UnityEngine.Object[] array = FindObjects(_mapDotType);
			for (int i = 0; i < array.Length; i++)
			{
				try
				{
					methodInfo.Invoke(array[i], new object[1] { 1f });
				}
				catch
				{
				}
			}
		}

		private void ApplyScreenShake(object player)
		{
			object obj = null;
			try
			{
				PropertyInfo propertyInfo = Property(_playerType, "ScreenShake");
				if (propertyInfo != null)
				{
					obj = propertyInfo.GetValue(player, null);
				}
			}
			catch
			{
			}
			if (obj == null)
			{
				return;
			}
			FieldInfo fieldInfo = Field(_playerScreenShakeType, "_shakeMultiplier");
			MethodInfo methodInfo = Method(_playerScreenShakeType, "SetShakeMultiplier", 1);
			int key = UnityId(obj);
			if (!_shakeOriginals.ContainsKey(key))
			{
				try
				{
					_shakeOriginals[key] = ((fieldInfo != null) ? Convert.ToSingle(fieldInfo.GetValue(obj)) : 1f);
				}
				catch
				{
					_shakeOriginals[key] = 1f;
				}
			}
			float num = (DisableScreenShake ? 0f : _shakeOriginals[key]);
			try
			{
				if (methodInfo != null)
				{
					methodInfo.Invoke(obj, new object[1] { num });
				}
				else if (fieldInfo != null)
				{
					fieldInfo.SetValue(obj, num);
				}
			}
			catch
			{
			}
		}

		private void ApplyFov(object player)
		{
			if (!_fovTouched || player == null)
			{
				return;
			}
			object obj = null;
			try
			{
				PropertyInfo propertyInfo = Property(_playerType, "Camera");
				if (propertyInfo != null)
				{
					obj = propertyInfo.GetValue(player, null);
				}
			}
			catch
			{
			}
			if (obj == null)
			{
				return;
			}
			int num = UnityId(obj);
			if (_lastAppliedFov == Fov && _lastFovCameraId == num)
			{
				return;
			}
			FieldInfo fieldInfo = Field(_playerCameraType, "_origFov");
			MethodInfo methodInfo = Method(_playerCameraType, "SetFov", 0);
			MethodInfo methodInfo2 = Method(_playerCameraType, "SetFOV", 1);
			try
			{
				if (fieldInfo != null)
				{
					fieldInfo.SetValue(obj, (float)Fov);
				}
				if (methodInfo != null)
				{
					methodInfo.Invoke(obj, null);
				}
				else if (methodInfo2 != null)
				{
					methodInfo2.Invoke(obj, new object[1] { (float)Fov });
				}
				_lastAppliedFov = Fov;
				_lastFovCameraId = num;
			}
			catch
			{
			}
		}

		private void ApplyHideInterface()
		{
			if (HideInterface == _hideInterfaceApplied)
			{
				return;
			}
			object obj = FindFirst(_playerUIType);
			MethodInfo methodInfo = Method(_playerUIType, "ToggleMainCanvas", 1);
			try
			{
				if (obj != null && methodInfo != null)
				{
					methodInfo.Invoke(obj, new object[1] { !HideInterface });
					_hideInterfaceApplied = HideInterface;
				}
			}
			catch
			{
			}
		}

		private void RestoreInterface()
		{
			if (!_hideInterfaceApplied)
			{
				return;
			}
			object obj = FindFirst(_playerUIType);
			MethodInfo methodInfo = Method(_playerUIType, "ToggleMainCanvas", 1);
			try
			{
				if (obj != null && methodInfo != null)
				{
					methodInfo.Invoke(obj, new object[1] { true });
				}
			}
			catch
			{
			}
			_hideInterfaceApplied = false;
		}

		private bool RequireWorld()
		{
			if (!HasPlayableWorld())
			{
				_status = "Gameplay world systems are not active yet. Nothing was executed.";
				return false;
			}
			return true;
		}

		private bool HasPlayableWorld()
		{
			if (FindFirstActive(_onlineIslandManagerType) != null)
			{
				return true;
			}
			if (FindFirstActive(_islandManagerType) != null && FindFirstActive(_creatureManagerType) != null)
			{
				return true;
			}
			if (FindFirstActive(_moneyManagerType) != null && FindFirstActive(_playerType) != null)
			{
				return true;
			}
			return false;
		}

		private void RefreshBossHealth()
		{
			try
			{
				object obj = FindFirst(_bossManagerType);
				if (obj != null)
				{
					MethodInfo methodInfo = Method(_bossManagerType, "UpdateBossMaxHp", 0);
					if (methodInfo != null)
					{
						methodInfo.Invoke(obj, null);
					}
					PropertyInfo propertyInfo = Property(_bossManagerType, "Boss");
					object boss = ((propertyInfo != null) ? propertyInfo.GetValue(obj, null) : null);
					ApplyBossPercentToLiveBoss(obj, boss);
				}
			}
			catch (Exception ex)
			{
				MelonLogger.Warning("Boss health refresh: " + RootMessage(ex));
			}
		}

		private static void ApplyBossPercentToLiveBoss(object bossManager, object boss)
		{
			if (BossHealthPercent >= 100 || bossManager == null || boss == null)
			{
				return;
			}
			try
			{
				PropertyInfo propertyInfo = Property(_creatureType, "IsDead");
				if (propertyInfo != null && Convert.ToBoolean(propertyInfo.GetValue(boss, null)))
				{
					return;
				}
				PropertyInfo propertyInfo2 = Property(_creatureType, "MaxHp");
				PropertyInfo propertyInfo3 = Property(_creatureType, "BossHpMultiplier");
				PropertyInfo propertyInfo4 = Property(_creatureType, "Hp");
				MethodInfo methodInfo = Method(_bossManagerType, "GetBossMaxHp", 2);
				if (propertyInfo2 == null || propertyInfo3 == null || propertyInfo4 == null || methodInfo == null)
				{
					return;
				}
				int num = Convert.ToInt32(propertyInfo2.GetValue(boss, null));
				float num2 = Convert.ToSingle(propertyInfo3.GetValue(boss, null));
				int val = Convert.ToInt32(methodInfo.Invoke(bossManager, new object[2] { num, num2 }));
				val = Math.Max(1, val);
				int num3 = Convert.ToInt32(propertyInfo4.GetValue(boss, null));
				if (num3 <= val)
				{
					return;
				}
				int num4 = num3 - val;
				if (GetNetworkBool(boss, "IsServerInitialized") || GetNetworkBool(boss, "IsServerStarted") || GetNetworkBool(boss, "IsOffline"))
				{
					MethodInfo methodInfo2 = Method(_creatureType, "ServerChangeHp", 1);
					if (methodInfo2 != null)
					{
						methodInfo2.Invoke(boss, new object[1] { num4 });
						return;
					}
				}
				object obj = FindLocalPlayerStatic();
				Component component = boss as Component;
				if (obj == null || !(component != null))
				{
					return;
				}
				Vector3 position = component.transform.position;
				Vector3 zero = Vector3.zero;
				_internalBossClamp = true;
				try
				{
					InvokeServerRpcForced("HitCreature", "RpcWriter___HitCreature", 5, new object[5] { boss, obj, num4, position, zero }, "boss health clamp");
				}
				finally
				{
					_internalBossClamp = false;
				}
			}
			catch (Exception ex)
			{
				_internalBossClamp = false;
				MelonLogger.Warning("Live boss HP clamp failed: " + RootMessage(ex));
			}
		}

		private static void BossFightInitializedPostfix(object __instance, object creature)
		{
			if (BossHealthPercent >= 100)
			{
				return;
			}
			try
			{
				MethodInfo methodInfo = Method(_bossManagerType, "UpdateBossMaxHp", 0);
				if (methodInfo != null)
				{
					methodInfo.Invoke(__instance, null);
				}
				ApplyBossPercentToLiveBoss(__instance, creature);
			}
			catch (Exception ex)
			{
				MelonLogger.Warning("Boss spawn percentage apply failed: " + RootMessage(ex));
			}
		}

		private void UnlockAllSkins()
		{
			if (!RequireWorld())
			{
				return;
			}
			GameObject gameObject = null;
			try
			{
				object obj = FindFirst(_saveManagerType);
				if (obj == null)
				{
					_status = "Unlock skins: SaveManager is not ready.";
					return;
				}
				int itemTypes;
				int totalSkins;
				GetSavedSkinUnlockCounts(obj, out itemTypes, out totalSkins);
				object obj2 = FindFirstActive(_dazedCommandsType);
				if (obj2 == null)
				{
					obj2 = FindFirst(_dazedCommandsType);
				}
				if (obj2 == null && _dazedCommandsType != null)
				{
					try
					{
						gameObject = new GameObject("TweakDeck_NativeSkinUnlock");
						obj2 = gameObject.AddComponent(_dazedCommandsType);
					}
					catch
					{
						if (gameObject != null)
						{
							UnityEngine.Object.Destroy(gameObject);
							gameObject = null;
						}
						try
						{
							obj2 = Activator.CreateInstance(_dazedCommandsType);
						}
						catch
						{
						}
					}
				}
				MethodInfo methodInfo = Method(_dazedCommandsType, "UseUnlockAllSkinsCommand", 0);
				if (obj2 == null || methodInfo == null)
				{
					_status = "Unlock skins: native game unlock command is unavailable.";
					MelonLogger.Warning("[Skins] " + _status);
					return;
				}
				methodInfo.Invoke(obj2, null);
				MethodInfo methodInfo2 = Method(_saveManagerType, "SaveLocal", 0);
				if (methodInfo2 != null)
				{
					methodInfo2.Invoke(obj, null);
				}
				int itemTypes2;
				int totalSkins2;
				GetSavedSkinUnlockCounts(obj, out itemTypes2, out totalSkins2);
				int num = Math.Max(0, totalSkins2 - totalSkins);
				_status = "Native skin unlock complete: " + totalSkins2 + " saved skins across " + itemTypes2 + " item types" + ((num > 0) ? (" (+" + num + ")") : "") + ". Hold item + C/Z to switch.";
				MelonLogger.Msg("[Skins] " + _status);
			}
			catch (Exception ex)
			{
				_status = "Unlock skins blocked safely: " + RootMessage(ex);
				MelonLogger.Warning("[Skins] " + RootMessage(ex));
			}
			finally
			{
				if (gameObject != null)
				{
					try
					{
						UnityEngine.Object.Destroy(gameObject);
					}
					catch
					{
					}
				}
			}
		}

		private static void GetSavedSkinUnlockCounts(object saveManager, out int itemTypes, out int totalSkins)
		{
			itemTypes = 0;
			totalSkins = 0;
			if (saveManager == null || _saveManagerType == null)
			{
				return;
			}
			try
			{
				FieldInfo fieldInfo = Field(_saveManagerType, "_curLocalSave");
				object obj = ((fieldInfo != null) ? fieldInfo.GetValue(saveManager) : null);
				if (obj == null)
				{
					return;
				}
				FieldInfo fieldInfo2 = Field(obj.GetType(), "UnlockedItemSkins");
				object obj2 = ((fieldInfo2 != null) ? fieldInfo2.GetValue(obj) : null);
				IEnumerable enumerable = obj2 as IEnumerable;
				if (enumerable == null)
				{
					return;
				}
				foreach (object item in enumerable)
				{
					if (item == null)
					{
						continue;
					}
					itemTypes++;
					FieldInfo fieldInfo3 = Field(item.GetType(), "SkinsUnlocked");
					object obj3 = ((fieldInfo3 != null) ? fieldInfo3.GetValue(item) : null);
					ICollection collection = obj3 as ICollection;
					if (collection != null)
					{
						totalSkins += collection.Count;
						continue;
					}
					IEnumerable enumerable2 = obj3 as IEnumerable;
					if (enumerable2 == null)
					{
						continue;
					}
					foreach (object item2 in enumerable2)
					{
						object obj5 = item2;
						totalSkins++;
					}
				}
			}
			catch
			{
			}
		}

		private List<object> GetSkinnableItems()
		{
			List<object> list = new List<object>();
			try
			{
				object obj = FindFirst(_gameInfoType);
				if (obj != null)
				{
					object obj2 = null;
					PropertyInfo propertyInfo = Property(_gameInfoType, "ItemWithSkinsforCommands");
					if (propertyInfo != null)
					{
						obj2 = propertyInfo.GetValue(obj, null);
					}
					if (obj2 == null)
					{
						FieldInfo fieldInfo = Field(_gameInfoType, "_itemsWithSkinsForCommands");
						if (fieldInfo != null)
						{
							obj2 = fieldInfo.GetValue(obj);
						}
					}
					AddEnumerableObjects(obj2, list);
				}
			}
			catch
			{
			}
			if (list.Count == 0)
			{
				UnityEngine.Object[] array = FindObjects(_itemType);
				for (int i = 0; i < array.Length; i++)
				{
					list.Add(array[i]);
				}
			}
			return list;
		}

		private static void AddEnumerableObjects(object raw, List<object> output)
		{
			if (raw == null || output == null)
			{
				return;
			}
			Array array = raw as Array;
			if (array != null)
			{
				for (int i = 0; i < array.Length; i++)
				{
					output.Add(array.GetValue(i));
				}
				return;
			}
			IEnumerable enumerable = raw as IEnumerable;
			if (enumerable == null)
			{
				return;
			}
			foreach (object item in enumerable)
			{
				output.Add(item);
			}
		}

		private static int DiscoverItemSkinCount(object preset)
		{
			if (preset == null)
			{
				return 0;
			}
			int num = CountItemSkinContainer(preset, true);
			int num2 = 0;
			int num3 = 0;
			try
			{
				Type type = preset.GetType();
				BindingFlags bindingAttr = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic;
				FieldInfo[] fields = type.GetFields(bindingAttr);
				for (int i = 0; i < fields.Length; i++)
				{
					try
					{
						object value = fields[i].GetValue(preset);
						bool likelySkinContainer = IsItemSkinType(fields[i].FieldType) || fields[i].Name.IndexOf("skin", StringComparison.OrdinalIgnoreCase) >= 0;
						int num4 = CountItemSkinContainer(value, likelySkinContainer);
						if (num4 > num)
						{
							num = num4;
						}
						if (value != null && IsItemSkinObject(value))
						{
							num2++;
						}
					}
					catch
					{
					}
				}
				PropertyInfo[] properties = type.GetProperties(bindingAttr);
				for (int j = 0; j < properties.Length; j++)
				{
					try
					{
						if (properties[j].GetIndexParameters().Length == 0)
						{
							object value2 = properties[j].GetValue(preset, null);
							bool likelySkinContainer2 = IsItemSkinType(properties[j].PropertyType) || properties[j].Name.IndexOf("skin", StringComparison.OrdinalIgnoreCase) >= 0;
							int num5 = CountItemSkinContainer(value2, likelySkinContainer2);
							if (num5 > num)
							{
								num = num5;
							}
							if (value2 != null && IsItemSkinObject(value2))
							{
								num3++;
							}
						}
					}
					catch
					{
					}
				}
			}
			catch
			{
			}
			if (num > 0)
			{
				return num;
			}
			if (num2 > 0)
			{
				return num2;
			}
			return num3;
		}

		private static int CountItemSkinContainer(object value, bool likelySkinContainer)
		{
			if (value == null || value is string)
			{
				return 0;
			}
			if (IsItemSkinObject(value))
			{
				return 1;
			}
			Array array = value as Array;
			if (array != null)
			{
				Type elementType = array.GetType().GetElementType();
				if (IsItemSkinType(elementType))
				{
					return array.Length;
				}
				int num = 0;
				for (int i = 0; i < array.Length; i++)
				{
					object value2 = array.GetValue(i);
					if (value2 != null && IsItemSkinObject(value2))
					{
						num++;
					}
				}
				if (num > 0)
				{
					return num;
				}
				if (!likelySkinContainer)
				{
					return 0;
				}
				return array.Length;
			}
			ICollection collection = value as ICollection;
			if (collection != null)
			{
				int num2 = 0;
				foreach (object item in collection)
				{
					if (item != null && IsItemSkinObject(item))
					{
						num2++;
					}
				}
				if (num2 > 0)
				{
					return num2;
				}
				if (!likelySkinContainer)
				{
					return 0;
				}
				return collection.Count;
			}
			return 0;
		}

		private static bool IsItemSkinObject(object value)
		{
			if (value == null)
			{
				return false;
			}
			return IsItemSkinType(value.GetType());
		}

		private static bool IsItemSkinType(Type type)
		{
			if (type == null)
			{
				return false;
			}
			if (_itemSkinType != null && type == _itemSkinType)
			{
				return true;
			}
			if (string.Equals(type.Name, "ItemSkin", StringComparison.Ordinal))
			{
				return true;
			}
			if (type.IsArray)
			{
				return IsItemSkinType(type.GetElementType());
			}
			if (type.IsGenericType)
			{
				Type[] genericArguments = type.GetGenericArguments();
				for (int i = 0; i < genericArguments.Length; i++)
				{
					if (IsItemSkinType(genericArguments[i]))
					{
						return true;
					}
				}
			}
			return false;
		}

		private void UnlockAllIslands()
		{
			if (!RequireWorld())
			{
				return;
			}
			try
			{
				object obj = FindFirst(_saveManagerType);
				object obj2 = FindFirstActive(_islandManagerType);
				object obj3 = FindFirstActive(_onlineIslandManagerType);
				if (obj2 == null)
				{
					_status = "Island system is not active yet.";
					return;
				}
				FieldInfo fieldInfo = Field(_islandManagerType, "TotalIslands");
				int num = ((fieldInfo != null) ? Convert.ToInt32(fieldInfo.GetValue(obj2)) : 0);
				if (num <= 0)
				{
					_status = "Island list has not initialized yet.";
					return;
				}
				int num2 = Math.Min(255, Math.Max(0, num - 1));
				if (IsRemoteClientSession())
				{
					_clientAllIslandsOverride = true;
					_clientAllIslandsMax = (byte)num2;
					ForceLocalOnlineIslandUnlock(obj3, (byte)num2);
					ForceLocalServerSaveIsland(obj, (byte)num2);
					ForceRemoteIslandUnlockAuthorityAggressive(obj3, (byte)num2);
					MelonLogger.Msg("[ClientFix] Unlock All Islands -> local progression mirror forced to " + num2 + ".");
				}
				if (obj3 != null)
				{
					MethodInfo methodInfo = Method(_onlineIslandManagerType, "UnlockIsland", 1);
					if (methodInfo != null)
					{
						for (int i = 0; i <= num2; i++)
						{
							try
							{
								methodInfo.Invoke(obj3, new object[1] { (byte)i });
							}
							catch
							{
							}
						}
					}
				}
				if (obj != null)
				{
					PropertyInfo propertyInfo = Property(_saveManagerType, "CurServerSave");
					object obj5 = ((propertyInfo != null) ? propertyInfo.GetValue(obj, null) : null);
					if (obj5 != null)
					{
						FieldInfo fieldInfo2 = Field(obj5.GetType(), "MaxIsland");
						if (fieldInfo2 != null)
						{
							fieldInfo2.SetValue(obj5, (byte)num2);
						}
						MethodInfo methodInfo2 = Method(_saveManagerType, "SaveServer", 1);
						if (methodInfo2 != null)
						{
							methodInfo2.Invoke(obj, new object[1] { false });
						}
					}
				}
				_status = (IsRemoteClientSession() ? "All islands unlocked for this client." : "All islands unlocked through live progression + save.");
			}
			catch (Exception ex)
			{
				_status = "Unlock islands blocked safely: " + RootMessage(ex);
			}
		}

		private void TeleportIslandOrdered(int direction)
		{
			if (!RequireWorld())
			{
				return;
			}
			try
			{
				object obj = FindLocalPlayer();
				object obj2 = FindFirstActive(_islandManagerType);
				object obj3 = FindFirstActive(_onlineIslandManagerType);
				if (obj2 == null)
				{
					_status = "Island list is not ready yet.";
					return;
				}
				FieldInfo fieldInfo = Field(_islandManagerType, "_islandInfos");
				Array array = ((fieldInfo != null) ? (fieldInfo.GetValue(obj2) as Array) : null);
				if (array == null || array.Length == 0)
				{
					_status = "Island order has not initialized yet.";
					return;
				}
				int val = 0;
				if (IsRemoteClientSession() && _clientIslandCursor >= 0)
				{
					val = _clientIslandCursor;
				}
				else if (obj3 != null)
				{
					PropertyInfo propertyInfo = Property(_onlineIslandManagerType, "CurIsland");
					if (propertyInfo != null)
					{
						val = Convert.ToInt32(propertyInfo.GetValue(obj3, null));
					}
				}
				else
				{
					FieldInfo fieldInfo2 = Field(_islandManagerType, "_curIsland");
					if (fieldInfo2 != null)
					{
						val = Convert.ToInt32(fieldInfo2.GetValue(obj2));
					}
				}
				val = Math.Max(0, Math.Min(array.Length - 1, val));
				int num = val + direction;
				if (num >= array.Length)
				{
					num = 0;
				}
				if (num < 0)
				{
					num = array.Length - 1;
				}
				if (IsRemoteClientSession())
				{
					if (obj == null)
					{
						_status = "Local player was not ready for client island teleport.";
					}
					else
					{
						if (TryClientIslandSpawnTeleport(obj2, array, obj, num, direction))
						{
							return;
						}
						MethodInfo methodInfo = Method(_islandManagerType, "QueueRequest", 1);
						MethodInfo methodInfo2 = Method(_islandManagerType, "LoadIsland", 1);
						bool flag = false;
						try
						{
							if (methodInfo != null)
							{
								methodInfo.Invoke(obj2, new object[1] { (byte)num });
								flag = true;
							}
							else if (methodInfo2 != null)
							{
								methodInfo2.Invoke(obj2, new object[1] { (byte)num });
								flag = true;
							}
						}
						catch (Exception ex)
						{
							MelonLogger.Warning("[ClientFix] Client island local-load request failed: " + RootMessage(ex));
						}
						_pendingClientIslandIndex = num;
						_pendingClientIslandDirection = direction;
						_pendingClientIslandUntil = Time.unscaledTime + 8f;
						_nextPendingClientIslandCheck = 0f;
						_status = ((direction < 0) ? "Previous" : "Next") + " island -> loading #" + num + " for client teleport...";
						MelonLogger.Msg("[ClientFix] CLIENT ISLAND LOAD -> #" + num + " requested=" + flag + "; waiting for real spawn point.");
					}
					return;
				}
				if (obj3 != null)
				{
					MethodInfo methodInfo3 = Method(_onlineIslandManagerType, "TpToSpecificIsland", 1);
					if (methodInfo3 != null)
					{
						methodInfo3.Invoke(obj3, new object[1] { (byte)num });
						_status = ((direction < 0) ? "Previous" : "Next") + " island -> #" + num + " (native island route).";
						return;
					}
				}
				if (obj == null)
				{
					_status = "Local player was not ready for island teleport.";
				}
				else if (!TryClientIslandSpawnTeleport(obj2, array, obj, num, direction))
				{
					_status = "Target island #" + num + " spawn point is not loaded.";
				}
			}
			catch (Exception ex2)
			{
				_status = "Island teleport blocked safely: " + RootMessage(ex2);
			}
		}

		private bool TryClientIslandSpawnTeleport(object islandManager, Array infos, object player, int targetIndex, int direction)
		{
			if (islandManager == null || infos == null || player == null || targetIndex < 0 || targetIndex >= infos.Length)
			{
				return false;
			}
			try
			{
				object obj = infos.GetValue(targetIndex);
				if (obj == null)
				{
					MethodInfo methodInfo = Method(_islandManagerType, "GetIslandInfo", 1);
					if (methodInfo != null)
					{
						obj = methodInfo.Invoke(islandManager, new object[1] { targetIndex });
					}
				}
				if (obj == null)
				{
					return false;
				}
				FieldInfo fieldInfo = Field(obj.GetType(), "_spawnPosition");
				GameObject gameObject = ((fieldInfo != null) ? (fieldInfo.GetValue(obj) as GameObject) : null);
				if (gameObject == null || gameObject.transform == null || !gameObject.scene.IsValid())
				{
					return false;
				}
				Vector3 vector = gameObject.transform.position + Vector3.up * 1.5f;
				float num = 0f;
				Component component = player as Component;
				if (component != null)
				{
					num = component.transform.eulerAngles.y;
				}
				if (TryNetworkTeleport(player, vector, num))
				{
					_clientIslandCursor = targetIndex;
					_pendingClientIslandIndex = -1;
					_status = ((direction < 0) ? "Previous" : "Next") + " island -> #" + targetIndex + " (client Server.TeleportPlayer).";
					MelonLogger.Msg(string.Concat("[ClientFix] CLIENT ISLAND TELEPORT -> #", targetIndex, " pos=", vector, " via Server.TeleportPlayer."));
					return true;
				}
				if (!IsRemoteClientSession())
				{
					MethodInfo methodInfo2 = Method(_playerType, "LocalTeleport", 3);
					if (methodInfo2 != null)
					{
						methodInfo2.Invoke(player, new object[3] { vector, num, true });
						_clientIslandCursor = targetIndex;
						_pendingClientIslandIndex = -1;
						_status = ((direction < 0) ? "Previous" : "Next") + " island -> #" + targetIndex + " (local spawn fallback).";
						return true;
					}
				}
			}
			catch (Exception ex)
			{
				MelonLogger.Warning("[ClientFix] Client island spawn teleport failed: " + RootMessage(ex));
			}
			return false;
		}

		private void ProcessPendingClientIslandTeleport()
		{
			if (_pendingClientIslandIndex < 0 || !IsRemoteClientSession())
			{
				return;
			}
			float unscaledTime = Time.unscaledTime;
			if (unscaledTime < _nextPendingClientIslandCheck)
			{
				return;
			}
			_nextPendingClientIslandCheck = unscaledTime + 0.2f;
			if (unscaledTime > _pendingClientIslandUntil)
			{
				MelonLogger.Warning("[ClientFix] CLIENT ISLAND TELEPORT TIMEOUT -> #" + _pendingClientIslandIndex + " spawn point never became available locally.");
				_status = "Island #" + _pendingClientIslandIndex + " did not finish loading for client teleport.";
				_pendingClientIslandIndex = -1;
				return;
			}
			try
			{
				object obj = FindLocalPlayer();
				object obj2 = FindFirstActive(_islandManagerType);
				if (obj != null && obj2 != null)
				{
					FieldInfo fieldInfo = Field(_islandManagerType, "_islandInfos");
					Array array = ((fieldInfo != null) ? (fieldInfo.GetValue(obj2) as Array) : null);
					if (array != null)
					{
						TryClientIslandSpawnTeleport(obj2, array, obj, _pendingClientIslandIndex, _pendingClientIslandDirection);
					}
				}
			}
			catch
			{
			}
		}

		private static bool TryNetworkTeleport(object player, Vector3 pos, float rot)
		{
			if (player == null)
			{
				return false;
			}
			return InvokeServerRpcForced("TeleportPlayer", "RpcWriter___TeleportPlayer", 3, new object[3] { player, pos, rot }, "teleport");
		}

		private void TeleportToFriend()
		{
			if (!RequireWorld())
			{
				return;
			}
			try
			{
				object obj = FindLocalPlayer();
				if (obj == null)
				{
					_status = "World is loaded, but the local player could not be identified for teleport.";
					return;
				}
				object targetPlayer;
				Transform targetTransform;
				if (!TryFindFriendTarget(obj, out targetPlayer, out targetTransform) || targetTransform == null)
				{
					_status = "No other active player is currently available.";
					MelonLogger.Warning("[FriendTP] No non-local replicated Player/OtherPlayer target was found.");
					return;
				}
				Vector3 forward = targetTransform.forward;
				if (forward.sqrMagnitude < 0.001f)
				{
					forward = Vector3.forward;
				}
				Vector3 vector = targetTransform.position - forward.normalized * 1.1f + Vector3.up * 0.2f;
				float y = targetTransform.eulerAngles.y;
				if (ForceFriendTeleportOnce(obj, vector, y, false))
				{
					_pendingFriendTeleportUntil = 0f;
					string text = ((targetTransform.gameObject != null) ? targetTransform.gameObject.name : "friend");
					_status = "Teleported to " + text + " // local + server movement authority.";
					MelonLogger.Msg(string.Concat("[FriendTP] TELEPORT -> target=", text, " pos=", vector, " rot=", y.ToString("0.0"), " mode=", IsRemoteClientSession() ? "REMOTE CLIENT" : "HOST/OFFLINE", "."));
				}
				else
				{
					_status = "Teleport routes were found, but none accepted the move.";
				}
			}
			catch (Exception ex)
			{
				_status = "Teleport blocked safely: " + RootMessage(ex);
				MelonLogger.Warning("[FriendTP] " + RootMessage(ex));
			}
		}

		private static bool TryFindFriendTarget(object localPlayer, out object targetPlayer, out Transform targetTransform)
		{
			targetPlayer = null;
			targetTransform = null;
			if (localPlayer == null || _playerType == null)
			{
				return false;
			}
			Component component = localPlayer as Component;
			Vector3 vector = ((component != null) ? component.transform.position : Vector3.zero);
			try
			{
				if (_otherPlayerType != null)
				{
					UnityEngine.Object[] array = FindObjects(_otherPlayerType);
					int num = int.MinValue;
					for (int i = 0; i < array.Length; i++)
					{
						Component component2 = array[i] as Component;
						if (component2 == null || component2.gameObject == null || component2.transform == null || !component2.gameObject.activeInHierarchy || !component2.gameObject.scene.IsValid() || IsLocalOwnedComponent(component2))
						{
							continue;
						}
						string transformPath = GetTransformPath(component2.transform);
						if (transformPath.IndexOf("Backup", StringComparison.OrdinalIgnoreCase) >= 0 || !IsPlausibleFriendPose(component2.transform, vector))
						{
							continue;
						}
						object obj = null;
						try
						{
							obj = component2.GetComponentInParent(_playerType);
						}
						catch
						{
						}
						if (obj == null || (!SameUnityObject(obj, localPlayer) && !IsOwnerObject(obj)))
						{
							int num2 = 5000;
							if (obj != null)
							{
								num2 += 1000;
							}
							if (transformPath.IndexOf("PlayerHolder", StringComparison.OrdinalIgnoreCase) >= 0)
							{
								num2 += 300;
							}
							float sqrMagnitude = (component2.transform.position - vector).sqrMagnitude;
							if (sqrMagnitude > 0.04f)
							{
								num2 += 200;
							}
							if (num2 > num)
							{
								num = num2;
								targetPlayer = obj;
								targetTransform = component2.transform;
							}
						}
					}
					if (targetTransform != null)
					{
						return true;
					}
				}
				UnityEngine.Object[] array2 = FindObjects(_playerType);
				int num3 = int.MinValue;
				foreach (object obj3 in array2)
				{
					Component component3 = obj3 as Component;
					if (obj3 == null || component3 == null || component3.gameObject == null || SameUnityObject(obj3, localPlayer) || IsOwnerObject(obj3) || !component3.gameObject.activeInHierarchy || !component3.gameObject.scene.IsValid())
					{
						continue;
					}
					string transformPath2 = GetTransformPath(component3.transform);
					if (transformPath2.IndexOf("Backup", StringComparison.OrdinalIgnoreCase) < 0 && IsPlausibleFriendPose(component3.transform, vector))
					{
						int num4 = 1000;
						if (transformPath2.IndexOf("PlayerHolder", StringComparison.OrdinalIgnoreCase) >= 0)
						{
							num4 += 400;
						}
						if ((component3.transform.position - vector).sqrMagnitude > 0.04f)
						{
							num4 += 100;
						}
						if (num4 > num3)
						{
							num3 = num4;
							targetPlayer = obj3;
							targetTransform = component3.transform;
						}
					}
				}
			}
			catch
			{
			}
			return targetTransform != null;
		}

		private static bool IsPlausibleFriendPose(Transform t, Vector3 localPos)
		{
			if (t == null || t.gameObject == null || !t.gameObject.activeInHierarchy)
			{
				return false;
			}
			Vector3 position = t.position;
			if (float.IsNaN(position.x) || float.IsNaN(position.y) || float.IsNaN(position.z) || float.IsInfinity(position.x) || float.IsInfinity(position.y) || float.IsInfinity(position.z))
			{
				return false;
			}
			if (Mathf.Abs(position.x) < 0.05f && Mathf.Abs(position.y) < 0.05f && Mathf.Abs(position.z) < 0.05f)
			{
				return false;
			}
			return true;
		}

		internal static bool ForceFriendTeleportOnce(object player, Vector3 pos, float rot, bool silent)
		{
			if (player == null)
			{
				return false;
			}
			bool flag = false;
			bool flag2 = false;
			bool flag3 = false;
			try
			{
				MethodInfo methodInfo = Method(_playerType, "LocalTeleport", 3);
				if (methodInfo != null)
				{
					methodInfo.Invoke(player, new object[3] { pos, rot, true });
					flag = true;
				}
				else
				{
					Component component = player as Component;
					if (component != null)
					{
						component.transform.position = pos;
						Vector3 eulerAngles = component.transform.eulerAngles;
						component.transform.rotation = Quaternion.Euler(eulerAngles.x, rot, eulerAngles.z);
						flag = true;
					}
				}
			}
			catch
			{
			}
			flag2 = TryNetworkPlayerPositionTeleport(player, pos, rot, silent);
			flag3 = ((!silent) ? TryNetworkTeleport(player, pos, rot) : InvokeServerRpcForcedSilent("TeleportPlayer", "RpcWriter___TeleportPlayer", 3, new object[3] { player, pos, rot }));
			if (!flag && !flag2)
			{
				return flag3;
			}
			return true;
		}

		internal static bool TryNetworkPlayerPositionTeleport(object player, Vector3 pos, float rot, bool silent)
		{
			if (player == null || _serverType == null)
			{
				return false;
			}
			object serverInstanceStrong = GetServerInstanceStrong();
			if (serverInstanceStrong == null)
			{
				return false;
			}
			try
			{
				MethodInfo methodInfo = null;
				if (IsRemoteClientSession())
				{
					methodInfo = FindMethodStartsWith(_serverType, "RpcWriter___UpdatePlayerPosRot", 6);
				}
				if (methodInfo == null)
				{
					methodInfo = Method(_serverType, "UpdatePlayerPosRot", 6);
				}
				if (methodInfo == null)
				{
					return false;
				}
				ParameterInfo[] parameters = methodInfo.GetParameters();
				object reliableChannelValue = GetReliableChannelValue(parameters[5].ParameterType);
				Vector2 vector = new Vector2(0f, rot);
				methodInfo.Invoke(serverInstanceStrong, new object[6] { player, pos, vector, false, true, reliableChannelValue });
				if (!silent)
				{
					MelonLogger.Msg(string.Concat("[FriendTP] POSITION AUTHORITY -> ", methodInfo.Name, " teleport=true pos=", pos, "."));
				}
				return true;
			}
			catch (TargetInvocationException ex)
			{
				if (!silent)
				{
					Exception ex2 = ((ex.InnerException != null) ? ex.InnerException : ex);
					MelonLogger.Warning("[FriendTP] Position authority failed: " + ex2.GetType().Name + ": " + ex2.Message);
				}
			}
			catch (Exception ex3)
			{
				if (!silent)
				{
					MelonLogger.Warning("[FriendTP] Position authority failed: " + ex3.GetType().Name + ": " + ex3.Message);
				}
			}
			return false;
		}

		private static object GetReliableChannelValue(Type channelType)
		{
			if (channelType == null)
			{
				return null;
			}
			try
			{
				if (channelType.IsEnum)
				{
					return Enum.Parse(channelType, "Reliable");
				}
			}
			catch
			{
			}
			try
			{
				if (channelType.IsEnum)
				{
					return Enum.ToObject(channelType, 0);
				}
			}
			catch
			{
			}
			return Activator.CreateInstance(channelType);
		}

		private void ProcessPendingFriendTeleport()
		{
			if (_pendingFriendTeleportUntil <= 0f)
			{
				return;
			}
			float unscaledTime = Time.unscaledTime;
			if (unscaledTime > _pendingFriendTeleportUntil)
			{
				_pendingFriendTeleportUntil = 0f;
			}
			else
			{
				if (unscaledTime < _nextFriendTeleportReinforce)
				{
					return;
				}
				_nextFriendTeleportReinforce = unscaledTime + 0.12f;
				try
				{
					object obj = FindLocalPlayer();
					if (obj != null)
					{
						ForceFriendTeleportOnce(obj, _pendingFriendTeleportPos, _pendingFriendTeleportRot, true);
					}
				}
				catch
				{
				}
			}
		}

		private void ResolveGameTypes()
		{
			_gameAssembly = FindAssembly("Assembly-CSharp");
			if (_gameAssembly == null)
			{
				MelonLogger.Error("Assembly-CSharp was not loaded.");
				return;
			}
			_playerType = T("Player");
			_playerVitalsType = T("PlayerVitals");
			_playerDyingType = T("PlayerDying");
			_deadPlayerType = T("DeadPlayer");
			_playerInventoryType = T("PlayerInventory");
			_playerMovementType = T("PlayerMovement");
			_playerScreenShakeType = T("PlayerScreenShake");
			_playerUIType = T("PlayerUI");
			_playerCameraType = T("PlayerCamera");
			_playerToolMovementType = T("PlayerToolMovement");
			_itemType = T("Item");
			_itemSkinType = T("ItemSkin");
			_gameInfoType = T("GameInfo");
			_weaponType = T("Weapon");
			_fishingRodType = T("FishingRod");
			_baitType = T("Bait");
			_baitInfoType = T("BaitInfo");
			_birdType = T("Bird");
			_moneyManagerType = T("MoneyManager");
			_creatureType = T("Creature");
			_creatureManagerType = T("CreatureManager");
			_creatureUtilsType = T("CreatureUtils");
			_bossManagerType = T("BossManager");
			_casinoManagerType = T("CasinoManager");
			_localCasinoType = T("LocalCasino");
			_saveManagerType = T("SaveManager");
			_islandManagerType = T("IslandManager");
			_onlineIslandManagerType = T("OnlineIslandManager");
			_boatType = T("Boat");
			_mapDotType = T("MapDot");
			_otherPlayerType = T("OtherPlayer");
			_serverType = T("Server");
			_closeItemsUIType = T("CloseItemsUI");
			_fishingUIType = T("FishingUI");
			_savedCreatureType = T("SavedCreature");
			_dazedCommandsType = T("DazedCommands");
			MelonLogger.Msg("Core game systems resolved.");
		}

		private void InstallPatches()
		{
			try
			{
				_harmony = new HarmonyLib.Harmony("howtofishmenu.advanced.embedded");
				PatchPrefixExact(_playerVitalsType, "TakeDamage", 4, "PlayerVitalsTakeDamagePrefix");
				PatchPrefixExact(_playerInventoryType, "ServerDropAll", 2, "KeepInventoryServerDropAllPrefix");
				PatchPrefix(_playerDyingType, "ServerDie", "PlayerDyingServerDiePrefix");
				PatchPrefix(_playerDyingType, "LocalDie", "KeepInventoryDeathPrefix");
				PatchClientDeathTransportMethods();
				PatchPrefixExact(_playerInventoryType, "ServerOnBaitUsed", 0, "PlayerInventoryBaitUsedPrefix");
				PatchPrefixExact(_birdType, "SetAttackingFood", 1, "BirdSetAttackingFoodPrefix");
				PatchPrefixExact(_itemType, "CaughtByBird", 1, "ItemCaughtByBirdPrefix");
				PatchPrefixExact(_moneyManagerType, "RemoveMoney", 2, "MoneyRemovePrefix");
				PatchPostfixExact(_moneyManagerType, "CanAfford", 1, "MoneyCanAffordPostfix");
				PatchPostfixExact(_moneyManagerType, "OnChangeMoney", 3, "MoneyOnChangePostfix");
				PatchPrefixPostfix(_weaponType, "Shoot", "WeaponShootPrefix", "WeaponShootPostfix");
				PatchPrefixExact(_weaponType, "Reload", 1, "WeaponReloadPrefix");
				PatchPrefixExact(_playerCameraType, "Recoil", 1, "NoRecoilPrefix");
				PatchPrefixExact(_playerToolMovementType, "Recoil", 1, "NoRecoilPrefix");
				PatchPrefixExact(_fishingRodType, "DecreaseLineLength", 1, "FishingRodDecreaseLineLengthPrefix");
				PatchPostfixExact(_fishingRodType, "Update", 0, "FishingRodFastReelPostfix");
				PatchPostfixExact(_fishingRodType, "TickUpdate", 0, "FishingRodFastReelPostfix");
				PatchPrefixExact(_playerMovementType, "TeleportToLand", 0, "PlayerMovementTeleportToLandPrefix");
				PatchPrefixExact(_creatureType, "LocalHit", 8, "CreatureLocalHitPrefix");
				PatchPrefixExact(_serverType, "HitCreature", 5, "ServerHitCreaturePrefix");
				PatchPrefixExact(_serverType, "HitPlayer", 6, "ServerHitPlayerPrefix");
				PatchPrefixExact(_serverType, "SetIsAfk", 3, "ServerSetIsAfkArgsPrefix");
				PatchPrefixExact(_serverType, "UpdateBaitPosAndLineLength", 5, "ServerUpdateBaitPosAndLineLengthPrefix");
				PatchPrefixExact(_serverType, "BuyItem", 6, "ServerBuyItemPrefix");
				PatchPrefixExact(_serverType, "BuyBait", 3, "ServerBuyBaitPrefix");
				PatchPrefixExact(_serverType, "BuyBoatMotor", 3, "ServerBuyBoatMotorPrefix");
				PatchPrefixExact(_serverType, "BuyBoatRadar", 2, "ServerBuyBoatRadarPrefix");
				PatchPrefixExact(_serverType, "BuyBulletUpgrade", 1, "ServerBuyBulletUpgradePrefix");
				PatchPrefixStartsWith(_serverType, "RpcWriter___HitCreature", 5, "ServerHitCreaturePrefix");
				PatchPrefixStartsWith(_serverType, "RpcWriter___HitPlayer", 6, "ServerHitPlayerPrefix");
				PatchPrefixStartsWith(_serverType, "RpcWriter___SetIsAfk", 3, "ServerSetIsAfkArgsPrefix");
				PatchPrefixStartsWith(_serverType, "RpcWriter___UpdateBaitPosAndLineLength", 5, "ServerUpdateBaitPosAndLineLengthPrefix");
				PatchPrefixStartsWith(_serverType, "RpcWriter___BuyItem", 6, "ServerBuyItemPrefix");
				PatchPrefixStartsWith(_serverType, "RpcWriter___BuyBait", 3, "ServerBuyBaitPrefix");
				PatchPrefixStartsWith(_serverType, "RpcWriter___BuyBoatMotor", 3, "ServerBuyBoatMotorPrefix");
				PatchPrefixStartsWith(_serverType, "RpcWriter___BuyBoatRadar", 2, "ServerBuyBoatRadarPrefix");
				PatchPrefixStartsWith(_serverType, "RpcWriter___BuyBulletUpgrade", 1, "ServerBuyBulletUpgradePrefix");
				PatchPrefixExact(_serverType, "ReleaseItemFromBait", 1, "ServerReleaseItemFromBaitPrefix");
				PatchPrefixStartsWith(_serverType, "RpcWriter___ReleaseItemFromBait", 1, "ServerReleaseItemFromBaitPrefix");
				PatchPrefixExact(_serverType, "DropAllItems", 3, "KeepInventoryDropAllRpcPrefix");
				PatchPrefixStartsWith(_serverType, "RpcWriter___DropAllItems", 3, "KeepInventoryDropAllRpcPrefix");
				PatchPrefixExact(_serverType, "RespawnPlayer", 3, "KeepInventoryRespawnRpcPrefix");
				PatchPrefixStartsWith(_serverType, "RpcWriter___RespawnPlayer", 3, "KeepInventoryRespawnRpcPrefix");
				PatchPostfixExact(_playerInventoryType, "OnOwnedBaitChange", 5, "PlayerInventoryOwnedBaitPostfix");
				PatchPostfixExact(_closeItemsUIType, "ShouldHideItem", 1, "CloseItemsShouldHidePostfix");
				PatchPostfixExact(_creatureType, "Awake", 0, "CreatureAwakePostfix");
				PatchPostfixExact(_creatureType, "OnStartServer", 0, "CreatureStartServerPostfix");
				PatchPostfixExact(_creatureType, "OnStartClient", 0, "CreatureStartClientPostfix");
				PatchPostfixExact(_creatureType, "OnDeath", 0, "CreatureOnDeathRareProgressPostfix");
				PatchPropertyPostfix(_creatureType, "IsDrip", "CreatureIsDripPostfix");
				PatchPropertyPostfix(_onlineIslandManagerType, "MaxIslandUnlocked", "OnlineIslandMaxUnlockedPostfix");
				PatchPostfixExact(_fishingUIType, "OnNewFishCaught", 1, "FishingUIOnNewFishCaughtRareProgressPostfix");
				PatchPostfixExact(_bossManagerType, "GetBossMaxHp", 2, "BossMaxHpPostfix");
				PatchPostfixExact(_bossManagerType, "InitializeBossFight", 1, "BossFightInitializedPostfix");
				PatchPostfixExact(_playerVitalsType, "OnHealthChange", 3, "PlayerVitalsOnHealthChangePostfix");
				PatchPropertyPostfix(_playerType, "IsAfk", "PlayerIsAfkPostfix");
				PatchPropertyPostfix(_playerType, "AfkFromPause", "PlayerAfkFromPausePostfix");
				PatchPrefix(_playerDyingType, "LocalDie", "ClientLocalDieBlockPrefix");
				PatchPrefixExact(_casinoManagerType, "ServerRouletteResult", 1, "CasinoServerRouletteResultPrefix");
				PatchPrefixExact(_casinoManagerType, "CalculateWorth", 1, "CasinoCalculateWorthArgsPrefix");
				PatchPrefixExact(_casinoManagerType, "BetResultEffects", 2, "CasinoBetResultEffectsArgsPrefix");
				PatchPrefixStartsWith(_casinoManagerType, "RpcLogic___BetResultEffects", 2, "CasinoBetResultEffectsArgsPrefix");
				PatchPrefixExact(_casinoManagerType, "UpdateTotalWorth", 2, "CasinoUpdateTotalWorthArgsPrefix");
				PatchPrefixStartsWith(_casinoManagerType, "RpcLogic___UpdateTotalWorth", 2, "CasinoUpdateTotalWorthArgsPrefix");
				PatchPrefixExact(_casinoManagerType, "StartBetEffects", 1, "CasinoStartBetEffectsArgsPrefix");
				PatchPrefixStartsWith(_casinoManagerType, "RpcLogic___StartBetEffects", 1, "CasinoStartBetEffectsArgsPrefix");
				PatchPrefixExact(_serverType, "PlaceBet", 1, "CasinoPlaceBetArgsPrefix");
				PatchPrefixStartsWith(_serverType, "RpcWriter___PlaceBet", 1, "CasinoPlaceBetArgsPrefix");
				PatchPrefixExact(_serverType, "UpdateRoulette", 2, "CasinoUpdateRouletteArgsPrefix");
				PatchPrefixStartsWith(_serverType, "RpcWriter___UpdateRoulette", 2, "CasinoUpdateRouletteArgsPrefix");
				PatchPrefixPostfix(_moneyManagerType, "SellItem", "MoneySellPrefix", "MoneySellPostfix");
				PatchPropertyPostfix(_itemType, "TotalWorth", "ItemTotalWorthPostfix");
				MelonLogger.Msg("Tweak Deck Harmony patches installed.");
			}
			catch (Exception ex)
			{
				MelonLogger.Error("Patch setup failed: " + ex);
			}
		}

		private void PatchPrefixStartsWith(Type type, string targetPrefix, int parameterCount, string prefixName)
		{
			if (type == null)
			{
				return;
			}
			MethodInfo method = typeof(AdvancedEngine).GetMethod(prefixName, BindingFlags.Static | BindingFlags.NonPublic);
			if (method == null)
			{
				MelonLogger.Warning("Patch prefix missing: " + prefixName);
				return;
			}
			MethodInfo[] methods = type.GetMethods(BindingFlags.Instance | BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic);
			int num = 0;
			foreach (MethodInfo methodInfo in methods)
			{
				if (!(methodInfo == null) && methodInfo.Name.StartsWith(targetPrefix, StringComparison.Ordinal) && methodInfo.GetParameters().Length == parameterCount)
				{
					try
					{
						_harmony.Patch(methodInfo, new HarmonyMethod(method));
						num++;
						MelonLogger.Msg("Patched " + type.Name + "." + methodInfo.Name);
					}
					catch (Exception ex)
					{
						MelonLogger.Warning("Patch skipped safely: " + type.Name + "." + methodInfo.Name + " -> " + RootMessage(ex));
					}
				}
			}
			if (num == 0)
			{
				MelonLogger.Warning("Patch missing by prefix: " + type.Name + "." + targetPrefix + "*");
			}
		}

		private void PatchClientDeathTransportMethods()
		{
			if (_playerDyingType == null)
			{
				return;
			}
			MethodInfo method = typeof(AdvancedEngine).GetMethod("ClientDeathRpcTransportPrefix", BindingFlags.Static | BindingFlags.NonPublic);
			if (method == null)
			{
				return;
			}
			MethodInfo[] methods = _playerDyingType.GetMethods(BindingFlags.Instance | BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic);
			int num = 0;
			foreach (MethodInfo methodInfo in methods)
			{
				if (methodInfo == null)
				{
					continue;
				}
				string text = methodInfo.Name ?? string.Empty;
				if (text.StartsWith("RpcWriter___", StringComparison.Ordinal) && (text.IndexOf("Die", StringComparison.OrdinalIgnoreCase) >= 0 || text.IndexOf("Death", StringComparison.OrdinalIgnoreCase) >= 0))
				{
					try
					{
						_harmony.Patch(methodInfo, new HarmonyMethod(method));
						num++;
						MelonLogger.Msg("Patched client death transport " + _playerDyingType.Name + "." + text);
					}
					catch (Exception ex)
					{
						MelonLogger.Warning("Client death transport patch skipped safely: " + text + " -> " + RootMessage(ex));
					}
				}
			}
			if (num == 0)
			{
				MelonLogger.Msg("CLEAN ANGLER: health/godmode authority patches are not installed.");
			}
		}

		private void PatchPrefix(Type type, string targetName, string prefixName)
		{
			if (type == null)
			{
				return;
			}
			MethodInfo methodInfo = AccessTools.Method(type, targetName);
			MethodInfo method = typeof(AdvancedEngine).GetMethod(prefixName, BindingFlags.Static | BindingFlags.NonPublic);
			if (methodInfo == null || method == null)
			{
				MelonLogger.Warning("Patch missing: " + type.Name + "." + targetName);
				return;
			}
			try
			{
				_harmony.Patch(methodInfo, new HarmonyMethod(method));
				MelonLogger.Msg("Patched " + type.Name + "." + targetName);
			}
			catch (Exception ex)
			{
				MelonLogger.Warning("Patch skipped safely: " + type.Name + "." + targetName + " -> " + RootMessage(ex));
			}
		}

		private void PatchPostfix(Type type, string targetName, string postfixName)
		{
			if (type == null)
			{
				return;
			}
			MethodInfo methodInfo = AccessTools.Method(type, targetName);
			MethodInfo method = typeof(AdvancedEngine).GetMethod(postfixName, BindingFlags.Static | BindingFlags.NonPublic);
			if (methodInfo == null || method == null)
			{
				MelonLogger.Warning("Patch missing: " + type.Name + "." + targetName);
				return;
			}
			try
			{
				_harmony.Patch(methodInfo, null, new HarmonyMethod(method));
				MelonLogger.Msg("Patched " + type.Name + "." + targetName);
			}
			catch (Exception ex)
			{
				MelonLogger.Warning("Patch skipped safely: " + type.Name + "." + targetName + " -> " + RootMessage(ex));
			}
		}

		private void PatchPrefixPostfix(Type type, string targetName, string prefixName, string postfixName)
		{
			if (type == null)
			{
				return;
			}
			MethodInfo methodInfo = AccessTools.Method(type, targetName);
			MethodInfo method = typeof(AdvancedEngine).GetMethod(prefixName, BindingFlags.Static | BindingFlags.NonPublic);
			MethodInfo method2 = typeof(AdvancedEngine).GetMethod(postfixName, BindingFlags.Static | BindingFlags.NonPublic);
			if (methodInfo == null || method == null || method2 == null)
			{
				MelonLogger.Warning("Patch missing: " + type.Name + "." + targetName);
				return;
			}
			try
			{
				_harmony.Patch(methodInfo, new HarmonyMethod(method), new HarmonyMethod(method2));
				MelonLogger.Msg("Patched " + type.Name + "." + targetName);
			}
			catch (Exception ex)
			{
				MelonLogger.Warning("Patch skipped safely: " + type.Name + "." + targetName + " -> " + RootMessage(ex));
			}
		}

		private void PatchPrefixExact(Type type, string targetName, int parameterCount, string prefixName)
		{
			if (type == null)
			{
				return;
			}
			MethodInfo methodInfo = Method(type, targetName, parameterCount);
			MethodInfo method = typeof(AdvancedEngine).GetMethod(prefixName, BindingFlags.Static | BindingFlags.NonPublic);
			if (methodInfo == null || method == null)
			{
				MelonLogger.Warning("Patch missing: " + type.Name + "." + targetName + "/" + parameterCount);
				return;
			}
			try
			{
				_harmony.Patch(methodInfo, new HarmonyMethod(method));
				MelonLogger.Msg("Patched " + type.Name + "." + targetName);
			}
			catch (Exception ex)
			{
				MelonLogger.Warning("Patch skipped safely: " + type.Name + "." + targetName + " -> " + RootMessage(ex));
			}
		}

		private void PatchPostfixExact(Type type, string targetName, int parameterCount, string postfixName)
		{
			if (type == null)
			{
				return;
			}
			MethodInfo methodInfo = Method(type, targetName, parameterCount);
			MethodInfo method = typeof(AdvancedEngine).GetMethod(postfixName, BindingFlags.Static | BindingFlags.NonPublic);
			if (methodInfo == null || method == null)
			{
				MelonLogger.Warning("Patch missing: " + type.Name + "." + targetName + "/" + parameterCount);
				return;
			}
			try
			{
				_harmony.Patch(methodInfo, null, new HarmonyMethod(method));
				MelonLogger.Msg("Patched " + type.Name + "." + targetName);
			}
			catch (Exception ex)
			{
				MelonLogger.Warning("Patch skipped safely: " + type.Name + "." + targetName + " -> " + RootMessage(ex));
			}
		}

		private void PatchPropertyPostfix(Type type, string propertyName, string postfixName)
		{
			if (type == null)
			{
				return;
			}
			MethodInfo methodInfo = AccessTools.PropertyGetter(type, propertyName);
			MethodInfo method = typeof(AdvancedEngine).GetMethod(postfixName, BindingFlags.Static | BindingFlags.NonPublic);
			if (methodInfo == null || method == null)
			{
				MelonLogger.Warning("Property patch missing: " + type.Name + "." + propertyName);
				return;
			}
			try
			{
				_harmony.Patch(methodInfo, null, new HarmonyMethod(method));
				MelonLogger.Msg("Patched property " + type.Name + "." + propertyName);
			}
			catch (Exception ex)
			{
				MelonLogger.Warning("Property patch skipped safely: " + type.Name + "." + propertyName + " -> " + RootMessage(ex));
			}
		}

		private static bool PlayerVitalsTakeDamagePrefix(object __instance, ref int amount)
		{
			if (InfiniteHealth && !IsRemoteClientSession() && IsLocalOwnedComponent(__instance))
			{
				if (Time.unscaledTime >= _nextInfiniteHealthLog)
				{
					_nextInfiniteHealthLog = Time.unscaledTime + 1f;
					MelonLogger.Msg("[Health] GodMode HOST/OFFLINE -> blocked TakeDamage amount=" + amount + ".");
				}
				return false;
			}
			if (!SwimNoDrown || !IsLocalOwnedComponent(__instance))
			{
				return true;
			}
			try
			{
				Component component = __instance as Component;
				object obj = ((component != null) ? GetComponent(component, _playerMovementType) : null);
				FieldInfo fieldInfo = Field(_playerMovementType, "_isSwimming");
				if (obj != null && fieldInfo != null && Convert.ToBoolean(fieldInfo.GetValue(obj)) && _knownWaterDamage > 0 && amount == _knownWaterDamage)
				{
					return false;
				}
			}
			catch
			{
			}
			return true;
		}

		private static void ApplyClientDemiGodServerAfkShield()
		{
			if (!InfiniteHealth || !IsRemoteClientSession())
			{
				return;
			}
			float unscaledTime = Time.unscaledTime;
			if (_demiGodServerAfkSent && unscaledTime < _nextDemiGodAfkSyncTime)
			{
				return;
			}
			object obj = FindLocalPlayerStatic();
			if (obj == null)
			{
				return;
			}
			_nextDemiGodAfkSyncTime = unscaledTime + 1f;
			if (InvokeServerRpcForced("SetIsAfk", "RpcWriter___SetIsAfk", 3, new object[3] { obj, true, false }, "demi god server AFK damage shield"))
			{
				if (!_demiGodServerAfkSent || unscaledTime >= _nextInfiniteHealthLog)
				{
					_nextInfiniteHealthLog = unscaledTime + 2f;
					MelonLogger.Msg("[ClientFix] GODMODE SERVER SHIELD -> host AFK=true, fromPause=false (damage + hunger immunity).");
				}
				_demiGodServerAfkSent = true;
			}
		}

		private static void SetClientDemiGodServerAfk(bool enabled)
		{
			if (IsRemoteClientSession())
			{
				object obj = FindLocalPlayerStatic();
				if (obj != null && InvokeServerRpcForced("SetIsAfk", "RpcWriter___SetIsAfk", 3, new object[3] { obj, enabled, false }, enabled ? "demi god enable server AFK shield" : "demi god disable server AFK shield"))
				{
					MelonLogger.Msg("[ClientFix] GODMODE SERVER SHIELD -> AFK=" + enabled + " sent to host.");
				}
			}
		}

		private static void ServerSetIsAfkArgsPrefix(object[] __args)
		{
			if (InfiniteHealth && IsRemoteClientSession() && __args != null && __args.Length >= 3)
			{
				object player = __args[0];
				if (IsLocalPlayerObject(player))
				{
					__args[1] = true;
					__args[2] = false;
				}
			}
		}

		private static void PlayerIsAfkPostfix(object __instance, ref bool __result)
		{
			if (InfiniteHealth && IsRemoteClientSession() && IsLocalPlayerObject(__instance))
			{
				__result = false;
			}
		}

		private static void PlayerAfkFromPausePostfix(object __instance, ref bool __result)
		{
			if (InfiniteHealth && IsRemoteClientSession() && IsLocalPlayerObject(__instance))
			{
				__result = false;
			}
		}

		private static void ServerHitPlayerPrefix(object player, ref int damage)
		{
			if (InfiniteHealth && IsRemoteClientSession() && damage > 0)
			{
				int num = damage;
				damage = 0;
				if (Time.unscaledTime >= _nextInfiniteHealthLog)
				{
					_nextInfiniteHealthLog = Time.unscaledTime + 0.75f;
					MelonLogger.Msg("[ClientFix] GODMODE -> outbound HitPlayer damage " + num + " -> 0.");
				}
			}
		}

		private static void ServerUpdateBaitPosAndLineLengthPrefix(object[] __args)
		{
			if (!AutoPerfectReel || __args == null || __args.Length < 5)
			{
				return;
			}
			try
			{
				object obj = __args[0];
				if (obj == null || !IsLocalFishingRodInstance(obj))
				{
					return;
				}
				object caughtCreatureItemOnRod = GetCaughtCreatureItemOnRod(obj);
				if (caughtCreatureItemOnRod != null)
				{
					object creatureFromItem = GetCreatureFromItem(caughtCreatureItemOnRod);
					if (GuaranteedRare && creatureFromItem != null)
					{
						ForceDripVariant(creatureFromItem);
					}
					__args[1] = GetClientCatchTargetPosition(obj);
					__args[2] = 0;
					__args[3] = 0f;
				}
			}
			catch
			{
			}
		}

		private static void ApplyClientAutoPerfectCatchAuthority(object player)
		{
			if (!AutoPerfectReel || player == null || _fishingRodType == null)
			{
				return;
			}
			try
			{
				object heldSubItemStatic = GetHeldSubItemStatic(player, "FishingRod");
				if (heldSubItemStatic == null)
				{
					return;
				}
				object caughtCreatureItemOnRod = GetCaughtCreatureItemOnRod(heldSubItemStatic);
				if (caughtCreatureItemOnRod == null)
				{
					_lastClientAutoCatchItemId = int.MinValue;
					return;
				}
				FieldInfo fieldInfo = Field(_fishingRodType, "_curLineLengthMulti");
				FieldInfo fieldInfo2 = Field(_fishingRodType, "_receivedCurLineLengthMulti");
				try
				{
					if (fieldInfo != null)
					{
						fieldInfo.SetValue(heldSubItemStatic, 0);
					}
				}
				catch
				{
				}
				try
				{
					if (fieldInfo2 != null)
					{
						fieldInfo2.SetValue(heldSubItemStatic, 0);
					}
				}
				catch
				{
				}
				object obj3 = null;
				PropertyInfo propertyInfo = Property(_fishingRodType, "Bait");
				try
				{
					obj3 = ((propertyInfo != null) ? propertyInfo.GetValue(heldSubItemStatic, null) : null);
				}
				catch
				{
				}
				if (obj3 != null)
				{
					MethodInfo methodInfo = Method(obj3.GetType(), "SetLineLength", 1);
					try
					{
						if (methodInfo != null)
						{
							methodInfo.Invoke(obj3, new object[1] { 0f });
						}
					}
					catch
					{
					}
				}
				float unscaledTime = Time.unscaledTime;
				if (unscaledTime < _nextClientAutoCatchSyncTime)
				{
					return;
				}
				_nextClientAutoCatchSyncTime = unscaledTime + 0.2f;
				int num = UnityId(caughtCreatureItemOnRod);
				int openInventorySlot = GetOpenInventorySlot(player);
				if (openInventorySlot < 0 || openInventorySlot > 255)
				{
					if (_lastClientAutoCatchItemId != num)
					{
						_lastClientAutoCatchItemId = num;
						MelonLogger.Warning("[CatchAuthority] Hooked creature fully reeled, but inventory has no free slot.");
					}
					return;
				}
				object creatureFromItem = GetCreatureFromItem(caughtCreatureItemOnRod);
				if (GuaranteedRare && creatureFromItem != null)
				{
					ForceDripVariant(creatureFromItem);
				}
				if (InvokeServerRpcForced("PutItemInInventory", "RpcWriter___PutItemInInventory", 3, new object[3]
				{
					player,
					caughtCreatureItemOnRod,
					(byte)openInventorySlot
				}, IsRemoteClientSession() ? "auto-perfect remote catch authority" : "auto-perfect host catch authority"))
				{
					if (GuaranteedRare && creatureFromItem != null)
					{
						RegisterForcedDripProgress(creatureFromItem, IsRemoteClientSession() ? "remote forced catch" : "host forced catch");
					}
					if (_lastClientAutoCatchItemId != num)
					{
						_lastClientAutoCatchItemId = num;
						MelonLogger.Msg("[CatchAuthority] AUTO-PERFECT CATCH -> PutItemInInventory sent for " + GetUnityName(caughtCreatureItemOnRod) + " | slot=" + openInventorySlot + " | route=" + (IsRemoteClientSession() ? "REMOTE->HOST" : "HOST/DIRECT") + " | zero-line authority active.");
					}
				}
			}
			catch (Exception ex)
			{
				if (Time.unscaledTime >= _nextClientAutoCatchSyncTime)
				{
					_nextClientAutoCatchSyncTime = Time.unscaledTime + 1f;
					MelonLogger.Warning("[CatchAuthority] catch authority failed: " + RootMessage(ex));
				}
			}
		}

		private static object GetCaughtCreatureItemOnRod(object rod)
		{
			if (rod == null || _itemType == null)
			{
				return null;
			}
			try
			{
				PropertyInfo propertyInfo = Property(_fishingRodType, "Bait");
				object obj = ((propertyInfo != null) ? propertyInfo.GetValue(rod, null) : null);
				if (obj != null)
				{
					PropertyInfo propertyInfo2 = Property(obj.GetType(), "ItemOnBait");
					object obj2 = ((propertyInfo2 != null) ? propertyInfo2.GetValue(obj, null) : null);
					if (GetCreatureFromItem(obj2) != null)
					{
						return obj2;
					}
					PropertyInfo propertyInfo3 = Property(obj.GetType(), "ServerItemOnBait");
					obj2 = ((propertyInfo3 != null) ? propertyInfo3.GetValue(obj, null) : null);
					if (GetCreatureFromItem(obj2) != null)
					{
						return obj2;
					}
				}
			}
			catch
			{
			}
			try
			{
				UnityEngine.Object[] array = FindObjects(_itemType);
				PropertyInfo propertyInfo4 = Property(_itemType, "AttachedRod");
				foreach (object obj4 in array)
				{
					if (obj4 != null && GetCreatureFromItem(obj4) != null)
					{
						object obj5 = ((propertyInfo4 != null) ? propertyInfo4.GetValue(obj4, null) : null);
						if (obj5 != null && SameUnityObject(obj5, rod))
						{
							return obj4;
						}
					}
				}
			}
			catch
			{
			}
			return null;
		}

		private static object GetCreatureFromItem(object item)
		{
			if (item == null)
			{
				return null;
			}
			try
			{
				PropertyInfo propertyInfo = Property(_itemType, "Creature");
				return (propertyInfo != null) ? propertyInfo.GetValue(item, null) : null;
			}
			catch
			{
				return null;
			}
		}

		private static Vector3 GetClientCatchTargetPosition(object rod)
		{
			try
			{
				FieldInfo fieldInfo = Field(_fishingRodType, "_tipJoint");
				Rigidbody rigidbody = ((fieldInfo != null) ? (fieldInfo.GetValue(rod) as Rigidbody) : null);
				if (rigidbody != null)
				{
					return rigidbody.position;
				}
			}
			catch
			{
			}
			try
			{
				PropertyInfo propertyInfo = Property(_fishingRodType, "Bait");
				object obj2 = ((propertyInfo != null) ? propertyInfo.GetValue(rod, null) : null);
				if (obj2 != null)
				{
					FieldInfo fieldInfo2 = Field(obj2.GetType(), "_rodTip");
					Transform transform = ((fieldInfo2 != null) ? (fieldInfo2.GetValue(obj2) as Transform) : null);
					if (transform != null)
					{
						return transform.position;
					}
				}
			}
			catch
			{
			}
			Component component = rod as Component;
			if (!(component != null))
			{
				return Vector3.zero;
			}
			return component.transform.position;
		}

		private static bool PlayerInventoryBaitUsedPrefix(object __instance)
		{
			if (!InfiniteBait)
			{
				return true;
			}
			return !IsLocalInventory(__instance);
		}

		private static bool BirdSetAttackingFoodPrefix()
		{
			return !BirdsNeverSteal;
		}

		private static bool ItemCaughtByBirdPrefix()
		{
			return !BirdsNeverSteal;
		}

		private static bool MoneyRemovePrefix(object[] __args)
		{
			if (!InfiniteMoney)
			{
				return true;
			}
			if (!IsRemoteClientSession())
			{
				MelonLogger.Msg("[MoneyFix] HOST/OFFLINE RemoveMoney blocked while Infinite Money is enabled.");
				return false;
			}
			try
			{
				if (__args != null && __args.Length >= 2 && IsLocalPlayerObject(__args[1]))
				{
					return false;
				}
			}
			catch
			{
			}
			return true;
		}

		private static void WeaponShootPrefix(object __instance, ref int __state)
		{
			__state = int.MinValue;
			if ((!InfiniteAmmo && !NoReload) || !IsLocalWeapon(__instance))
			{
				return;
			}
			FieldInfo fieldInfo = Field(_weaponType, "<Ammo>k__BackingField");
			if (fieldInfo == null)
			{
				return;
			}
			try
			{
				if ((__state = Convert.ToInt32(fieldInfo.GetValue(__instance))) <= 0)
				{
					fieldInfo.SetValue(__instance, 1);
				}
			}
			catch
			{
				__state = int.MinValue;
			}
		}

		private static void WeaponShootPostfix(object __instance, int __state)
		{
			if ((!InfiniteAmmo && !NoReload) || __state == int.MinValue)
			{
				return;
			}
			FieldInfo fieldInfo = Field(_weaponType, "<Ammo>k__BackingField");
			if (fieldInfo == null)
			{
				return;
			}
			try
			{
				fieldInfo.SetValue(__instance, __state);
			}
			catch
			{
			}
		}

		private static bool WeaponReloadPrefix(object __instance)
		{
			if (!NoReload || !IsLocalWeapon(__instance))
			{
				return true;
			}
			try
			{
				FieldInfo fieldInfo = Field(_weaponType, "<Ammo>k__BackingField");
				PropertyInfo propertyInfo = Property(_weaponType, "Attachments");
				object obj = ((propertyInfo != null) ? propertyInfo.GetValue(__instance, null) : null);
				int num = 999;
				if (obj != null)
				{
					PropertyInfo propertyInfo2 = Property(obj.GetType(), "AmmoPerMag");
					if (propertyInfo2 != null)
					{
						num = Convert.ToInt32(propertyInfo2.GetValue(obj, null));
					}
				}
				if (fieldInfo != null)
				{
					fieldInfo.SetValue(__instance, num);
				}
			}
			catch
			{
			}
			return false;
		}

		private static void CreatureLocalHitPrefix(object __instance, object player, ref int damage)
		{
			try
			{
				if (IsLocalPlayerObject(player))
				{
					if (OneHitKill)
					{
						PropertyInfo propertyInfo = Property(_creatureType, "MaxHp");
						int num = ((propertyInfo != null) ? Convert.ToInt32(propertyInfo.GetValue(__instance, null)) : 999999);
						damage = Math.Max(damage, num + 999);
					}
					else if (Math.Abs(DamageMultiplier - 1f) > 0.001f)
					{
						damage = (int)Math.Max(1.0, Math.Round((float)damage * DamageMultiplier));
					}
					if (GuaranteedRare)
					{
						ForceDripVariant(__instance);
					}
					MarkRareProgressCandidateIfLethal(__instance, damage);
				}
			}
			catch
			{
			}
		}

		private static void ServerHitCreaturePrefix(object creature, object playerWhoHit, ref int damage)
		{
			if (_internalBossClamp)
			{
				return;
			}
			try
			{
				if (IsLocalPlayerObject(playerWhoHit) && creature != null)
				{
					if (OneHitKill)
					{
						PropertyInfo propertyInfo = Property(_creatureType, "Hp");
						PropertyInfo propertyInfo2 = Property(_creatureType, "MaxHp");
						int num = ((propertyInfo != null) ? Convert.ToInt32(propertyInfo.GetValue(creature, null)) : ((propertyInfo2 != null) ? Convert.ToInt32(propertyInfo2.GetValue(creature, null)) : 999999));
						damage = Math.Max(damage, num + 999);
					}
					else if (Math.Abs(DamageMultiplier - 1f) > 0.001f)
					{
						damage = (int)Math.Max(1.0, Math.Round((float)damage * DamageMultiplier));
					}
					if (GuaranteedRare)
					{
						ForceDripVariant(creature);
					}
					MarkRareProgressCandidateIfLethal(creature, damage);
				}
			}
			catch
			{
			}
		}

		private static void MarkRareProgressCandidateIfLethal(object creature, int damage)
		{
			if (!GuaranteedRare || creature == null || damage <= 0)
			{
				return;
			}
			try
			{
				PropertyInfo propertyInfo = Property(_creatureType, "Hp");
				int val = ((propertyInfo != null) ? Convert.ToInt32(propertyInfo.GetValue(creature, null)) : int.MaxValue);
				if (damage >= Math.Max(1, val))
				{
					MarkRareProgressCandidate(creature);
				}
			}
			catch
			{
			}
		}

		private static void MarkRareProgressCandidate(object creature)
		{
			if (!GuaranteedRare || creature == null)
			{
				return;
			}
			try
			{
				_rareProgressCandidates.Add(UnityId(creature));
			}
			catch
			{
			}
		}

		private static void CreatureOnDeathRareProgressPostfix(object __instance)
		{
			if (GuaranteedRare && __instance != null)
			{
				int item = UnityId(__instance);
				if (_rareProgressCandidates.Contains(item))
				{
					_rareProgressCandidates.Remove(item);
					RegisterForcedDripProgress(__instance, IsRemoteClientSession() ? "remote forced kill" : "host/local kill");
				}
			}
		}

		private static void FishingUIOnNewFishCaughtRareProgressPostfix(object creature)
		{
			if (GuaranteedRare && creature != null)
			{
				RegisterForcedDripProgress(creature, IsRemoteClientSession() ? "remote forced catch" : "host/local catch");
			}
		}

		private static void RegisterForcedDripProgress(object creature, string source)
		{
			if (!GuaranteedRare || creature == null || _saveManagerType == null || _itemType == null)
			{
				return;
			}
			try
			{
				PropertyInfo propertyInfo = Property(_creatureType, "ExcludeFromJournal");
				if (propertyInfo != null && Convert.ToBoolean(propertyInfo.GetValue(creature, null)))
				{
					return;
				}
				PropertyInfo propertyInfo2 = Property(_itemType, "ID");
				if (propertyInfo2 == null)
				{
					return;
				}
				byte b = Convert.ToByte(propertyInfo2.GetValue(creature, null));
				object obj = FindFirst(_saveManagerType);
				if (obj == null)
				{
					MelonLogger.Warning("[Rare] Journal registration skipped: SaveManager not ready.");
					return;
				}
				object obj2 = null;
				MethodInfo methodInfo = Method(_saveManagerType, "GetSavedCreature", 1);
				if (methodInfo != null)
				{
					try
					{
						obj2 = methodInfo.Invoke(obj, new object[1] { creature });
					}
					catch
					{
					}
				}
				FieldInfo fieldInfo = Field(_saveManagerType, "_curLocalSave");
				object obj4 = ((fieldInfo != null) ? fieldInfo.GetValue(obj) : null);
				if (obj2 == null && obj4 != null)
				{
					FieldInfo fieldInfo2 = Field(obj4.GetType(), "Creatures");
					IDictionary dictionary = ((fieldInfo2 != null) ? (fieldInfo2.GetValue(obj4) as IDictionary) : null);
					if (dictionary != null && dictionary.Contains(b))
					{
						obj2 = dictionary[b];
					}
				}
				if (obj2 == null && obj4 != null && _savedCreatureType != null)
				{
					object obj5 = Activator.CreateInstance(_savedCreatureType);
					FieldInfo fieldInfo3 = Field(_savedCreatureType, "ID");
					if (fieldInfo3 != null)
					{
						fieldInfo3.SetValue(obj5, b);
					}
					FieldInfo fieldInfo4 = Field(obj4.GetType(), "Creatures");
					IDictionary dictionary2 = ((fieldInfo4 != null) ? (fieldInfo4.GetValue(obj4) as IDictionary) : null);
					if (dictionary2 != null && !dictionary2.Contains(b))
					{
						dictionary2.Add(b, obj5);
					}
					FieldInfo fieldInfo5 = Field(obj4.GetType(), "CreaturesToList");
					((fieldInfo5 != null) ? (fieldInfo5.GetValue(obj4) as IList) : null)?.Add(obj5);
					obj2 = obj5;
				}
				if (obj2 == null)
				{
					MelonLogger.Warning("[Rare] Journal registration skipped for ID=" + b + ": SavedCreature unavailable.");
					return;
				}
				Type type = obj2.GetType();
				FieldInfo fieldInfo6 = Field(type, "BeenKilled");
				FieldInfo fieldInfo7 = Field(type, "KilledDrip");
				bool flag = fieldInfo6 != null && Convert.ToBoolean(fieldInfo6.GetValue(obj2));
				bool flag2 = fieldInfo7 != null && Convert.ToBoolean(fieldInfo7.GetValue(obj2));
				if (fieldInfo6 != null)
				{
					fieldInfo6.SetValue(obj2, true);
				}
				if (fieldInfo7 != null)
				{
					fieldInfo7.SetValue(obj2, true);
				}
				if (!flag || !flag2)
				{
					MethodInfo methodInfo2 = Method(_saveManagerType, "SaveLocal", 0);
					if (methodInfo2 != null)
					{
						methodInfo2.Invoke(obj, null);
					}
				}
				bool flag3 = false;
				MethodInfo methodInfo3 = Method(_saveManagerType, "HasKilledCreature", 2);
				if (methodInfo3 != null)
				{
					try
					{
						flag3 = Convert.ToBoolean(methodInfo3.Invoke(obj, new object[2] { b, true }));
					}
					catch
					{
					}
				}
				string text = "Creature";
				try
				{
					UnityEngine.Object @object = creature as UnityEngine.Object;
					if (@object != null)
					{
						text = @object.name;
					}
				}
				catch
				{
				}
				MelonLogger.Msg("[Rare] DRIP JOURNAL REGISTERED -> " + text + " | ID=" + b + " | source=" + source + " | BeenKilled=true | KilledDrip=true | verify=" + flag3 + ".");
			}
			catch (Exception ex)
			{
				MelonLogger.Warning("[Rare] Drip journal registration failed: " + RootMessage(ex));
			}
		}

		private static void MoneyCanAffordPostfix(ref bool __result)
		{
			if (InfiniteMoney)
			{
				__result = true;
			}
		}

		private static void MoneyOnChangePostfix(object __instance, int prev, int next, bool asServer)
		{
			if (!InfiniteMoney || __instance == null || _moneyRestoreGuard)
			{
				return;
			}
			try
			{
				if (asServer && !IsRemoteClientSession())
				{
					object player = FindLocalPlayerStatic();
					EnsureAuthoritativeMoneyFloor(__instance, player, 999999);
				}
				else if (!asServer && !IsRemoteClientSession())
				{
				}
			}
			catch
			{
			}
		}

		private static void ServerBuyBulletUpgradePrefix(object weapon)
		{
			if (InfiniteMoney && weapon != null && IsRemoteClientSession())
			{
				MelonLogger.Msg("[MoneyFix] BuyBulletUpgrade client RPC detected (no client cost parameter exposed).");
			}
		}

		private static bool ShouldForceFreePurchase(object player)
		{
			if (!InfiniteMoney)
			{
				return false;
			}
			if (IsRemoteClientSession())
			{
				return true;
			}
			return true;
		}

		private static void ServerBuyItemPrefix(object player, ref bool isFree)
		{
			if (ShouldForceFreePurchase(player))
			{
				if (!isFree)
				{
					MelonLogger.Msg("[ClientFix] INFINITE MONEY -> BuyItem outbound packet forced isFree=true.");
				}
				isFree = true;
			}
		}

		private static void ServerBuyBaitPrefix(object player, ref int cost)
		{
			if (ShouldForceFreePurchase(player))
			{
				if (cost != 0)
				{
					MelonLogger.Msg("[ClientFix] INFINITE MONEY -> BuyBait outbound cost " + cost + " -> 0.");
				}
				cost = 0;
			}
		}

		private static void ServerBuyBoatMotorPrefix(object player, ref int cost)
		{
			if (ShouldForceFreePurchase(player))
			{
				if (cost != 0)
				{
					MelonLogger.Msg("[ClientFix] INFINITE MONEY -> BuyBoatMotor outbound cost " + cost + " -> 0.");
				}
				cost = 0;
			}
		}

		private static void ServerBuyBoatRadarPrefix(object player, ref int cost)
		{
			if (ShouldForceFreePurchase(player))
			{
				if (cost != 0)
				{
					MelonLogger.Msg("[ClientFix] INFINITE MONEY -> BuyBoatRadar outbound cost " + cost + " -> 0.");
				}
				cost = 0;
			}
		}

		private static void PlayerInventoryOwnedBaitPostfix(object __instance, int index, int oldAmount, int newAmount)
		{
			if (!InfiniteBait || newAmount >= oldAmount || index < 0 || index > 255)
			{
				return;
			}
			try
			{
				FieldInfo fieldInfo = Field(_playerInventoryType, "_player");
				object obj = ((fieldInfo != null) ? fieldInfo.GetValue(__instance) : null);
				if (IsLocalPlayerObject(obj))
				{
					InvokeServerRpcForced("BuyBait", "RpcWriter___BuyBait", 3, new object[3]
					{
						obj,
						(byte)index,
						0
					}, "infinite bait replenish");
				}
			}
			catch
			{
			}
		}

		private static bool ServerReleaseItemFromBaitPrefix(object rod)
		{
			if (!NeverLoseFish)
			{
				return true;
			}
			try
			{
				object player = FindLocalPlayerStatic();
				object heldSubItemStatic = GetHeldSubItemStatic(player, "FishingRod");
				if (heldSubItemStatic != null && SameUnityObject(heldSubItemStatic, rod))
				{
					MelonLogger.Msg("[ClientFix] Never Lose Fish -> blocked outbound ReleaseItemFromBait.");
					return false;
				}
			}
			catch
			{
			}
			return true;
		}

		private static bool KeepInventoryDropAllRpcPrefix(object player)
		{
			if (!KeepInventory)
			{
				return true;
			}
			if (IsRemoteClientSession())
			{
				try
				{
					if (player != null)
					{
						CaptureClientInventorySnapshot(player);
					}
				}
				catch (Exception ex)
				{
					MelonLogger.Warning("[ClientFix] Keep Inventory pre-drop snapshot: " + RootMessage(ex));
				}
				MelonLogger.Msg("[ClientFix] KEEP INVENTORY CLIENT BLOCK -> outbound DropAllItems cancelled before host drop.");
				return false;
			}
			if (IsLocalPlayerObject(player))
			{
				MelonLogger.Msg("[ClientFix] Keep Inventory -> blocked DropAllItems for local host player.");
				return false;
			}
			return true;
		}

		private static bool KeepInventoryRespawnRpcPrefix(object player)
		{
			if (!KeepInventory || !IsRemoteClientSession() || _clientKeepInventorySnapshot.Count == 0)
			{
				return true;
			}
			float unscaledTime = Time.unscaledTime;
			if (_clientKeepWaitingForRespawn || _clientKeepRecoveryStart > unscaledTime + 5f)
			{
				_clientKeepWaitingForRespawn = false;
				_clientKeepRecoveryStart = unscaledTime + 0.55f;
				_clientKeepRecoveryUntil = unscaledTime + 28f;
				_clientKeepNextGlobalAttempt = _clientKeepRecoveryStart;
				MelonLogger.Msg("[ClientFix] Keep Inventory RESPAWN DETECTED -> server recreation armed for " + _clientKeepInventorySnapshot.Count + " saved item(s).");
			}
			return true;
		}

		private static bool PlayerDyingServerDiePrefix(object __instance)
		{
			if (KeepInventory && __instance != null)
			{
				KeepInventoryDeathPrefix(__instance);
			}
			return true;
		}

		private static bool ClientDeathRpcTransportPrefix()
		{
			return true;
		}

		private static void PlayerVitalsOnHealthChangePostfix(object __instance, int prev, int next, bool asServer)
		{
			if (!SwimNoDrown || __instance == null || asServer || !IsLocalOwnedComponent(__instance))
			{
				return;
			}
			try
			{
				if (next >= prev)
				{
					return;
				}
				Component component = __instance as Component;
				object obj = ((component != null) ? GetComponent(component, _playerMovementType) : null);
				FieldInfo fieldInfo = Field(_playerMovementType, "_isSwimming");
				bool flag = obj != null && fieldInfo != null && Convert.ToBoolean(fieldInfo.GetValue(obj));
				int num = Math.Max(0, prev - next);
				if (flag && _knownWaterDamage > 0 && num == _knownWaterDamage)
				{
					ForceSyncVarLocalValue(__instance, "_syncedHealth", prev);
					FieldInfo fieldInfo2 = Field(_playerVitalsType, "_prevHealth");
					if (fieldInfo2 != null)
					{
						fieldInfo2.SetValue(__instance, prev);
					}
				}
			}
			catch
			{
			}
		}

		private static bool ClientLocalDieBlockPrefix(object __instance)
		{
			if (!SwimNoDrown || __instance == null || !IsLocalOwnedComponent(__instance))
			{
				return true;
			}
			if (SwimNoDrown)
			{
				try
				{
					Component component = __instance as Component;
					object obj = ((component != null) ? GetComponent(component, _playerMovementType) : null);
					FieldInfo fieldInfo = Field(_playerMovementType, "_isSwimming");
					if (obj != null && fieldInfo != null && Convert.ToBoolean(fieldInfo.GetValue(obj)))
					{
						MelonLogger.Msg("[ClientFix] Swim + No Drowning -> blocked underwater LocalDie.");
						return false;
					}
				}
				catch
				{
				}
			}
			return true;
		}

		private static void CasinoPlaceBetArgsPrefix(object[] __args)
		{
			if (!RigCasino || __args == null || __args.Length < 1)
			{
				return;
			}
			try
			{
				_casinoChosenBetColor = Convert.ToByte(__args[0]);
				_casinoBetTracked = true;
				_casinoRouletteLockReady = false;
				_casinoRouletteLockLogged = false;
				_casinoForceResultUntil = 0f;
				_nextCasinoAuthorityPush = 0f;
				_casinoPreBetWorth = ReadCasinoTotalWorth();
				MelonLogger.Msg("[Rig Casino] BET TRACKED -> color=" + _casinoChosenBetColor + " preBetWorth=" + _casinoPreBetWorth + (IsRemoteClientSession() ? " // remote authority takeover armed." : " // host authority armed."));
			}
			catch (Exception ex)
			{
				MelonLogger.Warning("[Rig Casino] bet tracking failed: " + RootMessage(ex));
			}
		}

		private static void CasinoStartBetEffectsArgsPrefix(object[] __args)
		{
			if (!RigCasino || __args == null || __args.Length < 1)
			{
				return;
			}
			try
			{
				_casinoChosenBetColor = Convert.ToByte(__args[0]);
				_casinoBetTracked = true;
				_casinoRouletteLockReady = false;
				_casinoRouletteLockLogged = false;
				_nextCasinoAuthorityPush = 0f;
				int num = ReadCasinoTotalWorth();
				if (num > 0)
				{
					_casinoPreBetWorth = Math.Max(_casinoPreBetWorth, num);
				}
			}
			catch
			{
			}
		}

		private static void CasinoCalculateWorthArgsPrefix(object[] __args)
		{
			if (!RigCasino || __args == null || __args.Length < 1)
			{
				return;
			}
			try
			{
				__args[0] = true;
			}
			catch
			{
			}
		}

		private static void CasinoBetResultEffectsArgsPrefix(object __instance, object[] __args)
		{
			if (!RigCasino || __instance == null || __args == null || __args.Length < 2)
			{
				return;
			}
			try
			{
				bool flag = Convert.ToBoolean(__args[1]);
				__args[1] = true;
				_casinoForceResultUntil = Time.unscaledTime + 2.5f;
				int incoming = ReadCasinoTotalWorth();
				int num = CalculateCasinoWinningWorthFloor(incoming);
				if (IsRemoteClientSession())
				{
					ForceCasinoTotalWorthAggressive(num);
				}
				if (!flag)
				{
					MelonLogger.Msg("[Rig Casino] REMOTE RESULT TAKEOVER -> host/client result bool forced WIN; winning worth authority push=" + num + ".");
				}
			}
			catch (Exception ex)
			{
				MelonLogger.Warning("[Rig Casino] result force failed: " + RootMessage(ex));
			}
		}

		private static void CasinoUpdateTotalWorthArgsPrefix(object __instance, object[] __args)
		{
			if (!RigCasino || __instance == null || __args == null || __args.Length < 2)
			{
				return;
			}
			try
			{
				int num = Convert.ToInt32(__args[0]);
				bool flag = Convert.ToBoolean(__args[1]);
				int num2 = CalculateCasinoWinningWorthFloor(num);
				__args[0] = num2;
				__args[1] = true;
				_casinoForceResultUntil = Time.unscaledTime + 2.5f;
				if (IsRemoteClientSession())
				{
					ForceCasinoTotalWorthAggressive(num2);
				}
				if (!flag || num2 != num)
				{
					MelonLogger.Msg("[Rig Casino] PAYOUT TAKEOVER -> worth " + num + " -> " + num2 + ", won=true.");
				}
			}
			catch (Exception ex)
			{
				if (Time.unscaledTime >= _nextCasinoAuthorityLog)
				{
					_nextCasinoAuthorityLog = Time.unscaledTime + 1.5f;
					MelonLogger.Warning("[Rig Casino] payout force failed: " + RootMessage(ex));
				}
			}
		}

		private static void CasinoUpdateRouletteArgsPrefix(object[] __args)
		{
			if (!RigCasino || !IsRemoteClientSession() || !_casinoRouletteLockReady || __args == null || __args.Length < 2)
			{
				return;
			}
			try
			{
				__args[0] = _casinoRouletteLockBallPos;
				__args[1] = _casinoRouletteLockWheelRot;
			}
			catch
			{
			}
		}

		private static int ReadCasinoTotalWorth()
		{
			try
			{
				object casinoManagerInstance = GetCasinoManagerInstance();
				if (casinoManagerInstance == null)
				{
					return 0;
				}
				PropertyInfo propertyInfo = Property(_casinoManagerType, "TotalWorth");
				if (propertyInfo != null)
				{
					return Math.Max(0, Convert.ToInt32(propertyInfo.GetValue(casinoManagerInstance, null)));
				}
				FieldInfo fieldInfo = Field(_casinoManagerType, "_totalWorth");
				object obj = ((fieldInfo != null) ? fieldInfo.GetValue(casinoManagerInstance) : null);
				PropertyInfo propertyInfo2 = ((obj != null) ? Property(obj.GetType(), "Value") : null);
				if (propertyInfo2 != null)
				{
					return Math.Max(0, Convert.ToInt32(propertyInfo2.GetValue(obj, null)));
				}
			}
			catch
			{
			}
			return 0;
		}

		private static int CalculateCasinoWinningWorthFloor(int incoming)
		{
			long num = Math.Max(_casinoPreBetWorth, Math.Max(0L, incoming));
			if (_casinoPreBetWorth > 0)
			{
				num = Math.Max(num, (long)_casinoPreBetWorth * 2L);
			}
			if (num > int.MaxValue)
			{
				num = 2147483647L;
			}
			return (int)num;
		}

		private static object GetCasinoManagerInstance()
		{
			if (_casinoManagerType == null)
			{
				return null;
			}
			try
			{
				FieldInfo fieldInfo = Field(_casinoManagerType, "Instance");
				object obj = ((fieldInfo != null) ? fieldInfo.GetValue(null) : null);
				if (UnityObjectExists(obj))
				{
					return obj;
				}
			}
			catch
			{
			}
			try
			{
				UnityEngine.Object[] array = FindObjects(_casinoManagerType);
				for (int i = 0; i < array.Length; i++)
				{
					if (UnityObjectExists(array[i]))
					{
						return array[i];
					}
				}
			}
			catch
			{
			}
			return null;
		}

		private static object GetLocalCasinoInstance()
		{
			if (_localCasinoType == null)
			{
				return null;
			}
			try
			{
				FieldInfo fieldInfo = Field(_localCasinoType, "Instance");
				object obj = ((fieldInfo != null) ? fieldInfo.GetValue(null) : null);
				if (UnityObjectExists(obj))
				{
					return obj;
				}
			}
			catch
			{
			}
			try
			{
				UnityEngine.Object[] array = FindObjects(_localCasinoType);
				for (int i = 0; i < array.Length; i++)
				{
					if (UnityObjectExists(array[i]))
					{
						return array[i];
					}
				}
			}
			catch
			{
			}
			return null;
		}

		private static void ApplyAggressiveClientCasinoAuthority()
		{
			if (!RigCasino || !IsRemoteClientSession() || !_casinoBetTracked || Time.unscaledTime < _nextCasinoAuthorityPush)
			{
				return;
			}
			_nextCasinoAuthorityPush = Time.unscaledTime + 0.05f;
			try
			{
				object casinoManagerInstance = GetCasinoManagerInstance();
				if (casinoManagerInstance == null)
				{
					return;
				}
				bool flag = true;
				PropertyInfo propertyInfo = Property(_casinoManagerType, "IsBetting");
				PropertyInfo propertyInfo2 = Property(_casinoManagerType, "HasPlacedBet");
				bool flag2 = propertyInfo != null && Convert.ToBoolean(propertyInfo.GetValue(casinoManagerInstance, null));
				bool flag3 = propertyInfo2 != null && Convert.ToBoolean(propertyInfo2.GetValue(casinoManagerInstance, null));
				if (propertyInfo != null || propertyInfo2 != null)
				{
					flag = flag2 || flag3;
				}
				if (!flag && Time.unscaledTime > _casinoForceResultUntil)
				{
					return;
				}
				object localCasinoInstance = GetLocalCasinoInstance();
				if (localCasinoInstance != null && _casinoChosenBetColor != byte.MaxValue)
				{
					FieldInfo fieldInfo = Field(_localCasinoType, "_curColor");
					object obj = ((fieldInfo != null) ? fieldInfo.GetValue(localCasinoInstance) : null);
					if (obj != null && Convert.ToByte(obj) == _casinoChosenBetColor)
					{
						FieldInfo fieldInfo2 = Field(_localCasinoType, "_serverBallPos");
						FieldInfo fieldInfo3 = Field(_localCasinoType, "_serverWheelRot");
						if (fieldInfo2 != null && fieldInfo3 != null)
						{
							Vector3 vector = (Vector3)fieldInfo2.GetValue(localCasinoInstance);
							float casinoRouletteLockWheelRot = Convert.ToSingle(fieldInfo3.GetValue(localCasinoInstance));
							_casinoRouletteLockBallPos = vector;
							_casinoRouletteLockWheelRot = casinoRouletteLockWheelRot;
							_casinoRouletteLockReady = true;
							if (!_casinoRouletteLockLogged)
							{
								_casinoRouletteLockLogged = true;
								MelonLogger.Msg(string.Concat("[Rig Casino] ROULETTE AUTHORITY LOCK ACQUIRED -> selected color=", _casinoChosenBetColor, " | pinning ballPos=", vector, " wheelRot=", casinoRouletteLockWheelRot.ToString("0.###"), " to host."));
							}
						}
					}
				}
				if (_casinoRouletteLockReady)
				{
					InvokeServerRpcForcedSilent("UpdateRoulette", "RpcWriter___UpdateRoulette", 2, new object[2] { _casinoRouletteLockBallPos, _casinoRouletteLockWheelRot });
				}
				if (Time.unscaledTime <= _casinoForceResultUntil)
				{
					ForceCasinoTotalWorthAggressive(CalculateCasinoWinningWorthFloor(ReadCasinoTotalWorth()));
				}
			}
			catch (Exception ex)
			{
				if (Time.unscaledTime >= _nextCasinoAuthorityLog)
				{
					_nextCasinoAuthorityLog = Time.unscaledTime + 1.5f;
					MelonLogger.Warning("[Rig Casino] aggressive client authority failed: " + RootMessage(ex));
				}
			}
		}

		private static void ForceCasinoTotalWorthAggressive(int targetWorth)
		{
			if (!RigCasino || !IsRemoteClientSession() || _casinoManagerType == null)
			{
				return;
			}
			try
			{
				object casinoManagerInstance = GetCasinoManagerInstance();
				if (casinoManagerInstance == null)
				{
					return;
				}
				FieldInfo fieldInfo = Field(_casinoManagerType, "_totalWorth");
				object obj = ((fieldInfo != null) ? fieldInfo.GetValue(casinoManagerInstance) : null);
				if (obj == null)
				{
					return;
				}
				if (!_casinoOriginalPermissionCaptured)
				{
					object obj2 = null;
					Type type = obj.GetType();
					while (type != null && obj2 == null)
					{
						FieldInfo field = type.GetField("Settings", BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic);
						if (field != null)
						{
							try
							{
								obj2 = field.GetValue(obj);
							}
							catch
							{
							}
						}
						type = type.BaseType;
					}
					if (obj2 != null)
					{
						FieldInfo fieldInfo2 = Field(obj2.GetType(), "WritePermission");
						_casinoOriginalWritePermission = ((fieldInfo2 != null) ? fieldInfo2.GetValue(obj2) : null);
						_casinoOriginalPermissionCaptured = _casinoOriginalWritePermission != null;
					}
				}
				MethodInfo methodInfo = Method(obj.GetType(), "UpdatePermissions", 1);
				if (methodInfo != null)
				{
					ParameterInfo[] parameters = methodInfo.GetParameters();
					if (parameters.Length == 1 && parameters[0].ParameterType.IsEnum)
					{
						object obj4 = Enum.Parse(parameters[0].ParameterType, "ClientUnsynchronized");
						methodInfo.Invoke(obj, new object[1] { obj4 });
					}
				}
				MethodInfo methodInfo2 = Method(obj.GetType(), "UpdateSendRate", 1);
				if (methodInfo2 != null)
				{
					try
					{
						methodInfo2.Invoke(obj, new object[1] { 0f });
					}
					catch
					{
					}
				}
				MethodInfo methodInfo3 = Method(obj.GetType(), "SetValue", 3);
				if (methodInfo3 != null)
				{
					methodInfo3.Invoke(obj, new object[3]
					{
						Math.Max(0, targetWorth),
						true,
						true
					});
				}
				MethodInfo methodInfo4 = Method(obj.GetType(), "DirtyAll", 0);
				if (methodInfo4 != null)
				{
					try
					{
						methodInfo4.Invoke(obj, null);
					}
					catch
					{
					}
				}
				MethodInfo methodInfo5 = Method(casinoManagerInstance.GetType(), "DirtySyncType", 0);
				if (methodInfo5 != null)
				{
					try
					{
						methodInfo5.Invoke(casinoManagerInstance, null);
					}
					catch
					{
					}
				}
				if (Time.unscaledTime >= _nextCasinoAuthorityLog)
				{
					_nextCasinoAuthorityLog = Time.unscaledTime + 1.5f;
					MelonLogger.Msg("[Rig Casino] REMOTE PAYOUT AUTHORITY FORGE -> _totalWorth=" + Math.Max(0, targetWorth) + " | permission=ClientUnsynchronized | SetValue(value,true,true) + DirtyAll.");
				}
			}
			catch (Exception ex)
			{
				if (Time.unscaledTime >= _nextCasinoAuthorityLog)
				{
					_nextCasinoAuthorityLog = Time.unscaledTime + 1.5f;
					MelonLogger.Warning("[Rig Casino] payout authority forge failed: " + RootMessage(ex));
				}
			}
		}

		private static void RestoreCasinoAuthorityPermissions()
		{
			try
			{
				if (_casinoOriginalPermissionCaptured && _casinoOriginalWritePermission != null)
				{
					object casinoManagerInstance = GetCasinoManagerInstance();
					FieldInfo fieldInfo = Field(_casinoManagerType, "_totalWorth");
					object obj = ((casinoManagerInstance != null && fieldInfo != null) ? fieldInfo.GetValue(casinoManagerInstance) : null);
					if (obj != null)
					{
						MethodInfo methodInfo = Method(obj.GetType(), "UpdatePermissions", 1);
						if (methodInfo != null)
						{
							try
							{
								methodInfo.Invoke(obj, new object[1] { _casinoOriginalWritePermission });
							}
							catch
							{
							}
						}
					}
				}
			}
			catch
			{
			}
			_casinoOriginalWritePermission = null;
			_casinoOriginalPermissionCaptured = false;
			_casinoChosenBetColor = byte.MaxValue;
			_casinoBetTracked = false;
			_casinoPreBetWorth = 0;
			_casinoRouletteLockReady = false;
			_casinoRouletteLockLogged = false;
			_casinoForceResultUntil = 0f;
			_nextCasinoAuthorityPush = 0f;
		}

		private static bool IsLocalFishingRodInstance(object rod)
		{
			if (rod == null)
			{
				return false;
			}
			object obj = FindLocalPlayerStatic();
			if (obj == null)
			{
				return false;
			}
			try
			{
				object heldSubItemStatic = GetHeldSubItemStatic(obj, "FishingRod");
				if (heldSubItemStatic != null && SameUnityObject(heldSubItemStatic, rod))
				{
					return true;
				}
			}
			catch
			{
			}
			try
			{
				Component component = rod as Component;
				object obj3 = ((component != null) ? GetComponent(component, _itemType) : null);
				if (obj3 != null)
				{
					PropertyInfo propertyInfo = Property(_itemType, "SyncedHolder");
					object obj4 = ((propertyInfo != null) ? propertyInfo.GetValue(obj3, null) : null);
					if (obj4 != null && SameUnityObject(obj4, obj))
					{
						return true;
					}
					FieldInfo fieldInfo = Field(_itemType, "_holder");
					obj4 = ((fieldInfo != null) ? fieldInfo.GetValue(obj3) : null);
					if (obj4 != null && SameUnityObject(obj4, obj))
					{
						return true;
					}
				}
			}
			catch
			{
			}
			return false;
		}

		private static void FishingRodDecreaseLineLengthPrefix(object __instance, ref int amount)
		{
			if (!FastReel || __instance == null || amount <= 0)
			{
				return;
			}
			try
			{
				if (IsLocalFishingRodInstance(__instance))
				{
					long num = (long)amount * 10L;
					amount = (int)((num > int.MaxValue) ? int.MaxValue : num);
				}
			}
			catch
			{
			}
		}

		private static void FishingRodFastReelPostfix(object __instance)
		{
			if (!FastReel || __instance == null)
			{
				return;
			}
			try
			{
				if (!IsLocalFishingRodInstance(__instance))
				{
					return;
				}
				FieldInfo fieldInfo = Field(_fishingRodType, "_isReelingIn");
				if (fieldInfo == null || !Convert.ToBoolean(fieldInfo.GetValue(__instance)))
				{
					return;
				}
				int frameCount = Time.frameCount;
				int num = UnityId(__instance);
				if (_fastReelLastFrame == frameCount && _fastReelLastRodId == num)
				{
					return;
				}
				_fastReelLastFrame = frameCount;
				_fastReelLastRodId = num;
				MethodInfo methodInfo = Method(_fishingRodType, "DecreaseLineLength", 1);
				if (methodInfo != null)
				{
					methodInfo.Invoke(__instance, new object[1] { 1 });
				}
				FieldInfo fieldInfo2 = Field(_fishingRodType, "_curReelSpeedMulti");
				if (fieldInfo2 != null)
				{
					float num2 = Convert.ToSingle(fieldInfo2.GetValue(__instance));
					if (num2 < 12f)
					{
						fieldInfo2.SetValue(__instance, 12f);
					}
				}
				FieldInfo fieldInfo3 = Field(_fishingRodType, "_holdReelTimer");
				if (fieldInfo3 != null)
				{
					float num3 = Convert.ToSingle(fieldInfo3.GetValue(__instance));
					if (num3 < 10f)
					{
						fieldInfo3.SetValue(__instance, 10f);
					}
				}
				if (Time.unscaledTime >= _nextFastReelLog)
				{
					_nextFastReelLog = Time.unscaledTime + 1f;
					FieldInfo fieldInfo4 = Field(_fishingRodType, "_curLineLengthMulti");
					object obj = ((fieldInfo4 != null) ? fieldInfo4.GetValue(__instance) : null);
					MelonLogger.Msg("[FastReel] ACTIVE -> native DecreaseLineLength forced; lineMulti=" + ((obj != null) ? obj.ToString() : "?"));
				}
			}
			catch (Exception ex)
			{
				if (Time.unscaledTime >= _nextFastReelLog)
				{
					_nextFastReelLog = Time.unscaledTime + 2f;
					MelonLogger.Warning("[FastReel] runtime force failed: " + RootMessage(ex));
				}
			}
		}

		private static bool PlayerMovementTeleportToLandPrefix(object __instance)
		{
			if (!SwimNoDrown || __instance == null)
			{
				return true;
			}
			if (IsLocalOwnedComponent(__instance))
			{
				MelonLogger.Msg("[ClientFix] Swim + No Drowning -> blocked TeleportToLand for local player.");
				return false;
			}
			return true;
		}

		private static bool NoRecoilPrefix()
		{
			return !NoRecoilSpread;
		}

		private static void CloseItemsShouldHidePostfix(object item, ref bool __result)
		{
			if (!HighlightFish || item == null)
			{
				return;
			}
			try
			{
				PropertyInfo propertyInfo = Property(_itemType, "Creature");
				if (propertyInfo != null && propertyInfo.GetValue(item, null) != null)
				{
					__result = false;
				}
			}
			catch
			{
			}
		}

		private static bool MapDotHidePrefix()
		{
			return true;
		}

		private static void BossMaxHpPostfix(ref int __result)
		{
			if (BossHealthPercent != 100)
			{
				__result = Math.Max(1, (int)Math.Round((float)__result * ((float)BossHealthPercent / 100f)));
			}
		}

		private static void CasinoServerRouletteResultPrefix(object __instance, object[] __args)
		{
			if (!RigCasino || __instance == null || __args == null || __args.Length < 1)
			{
				return;
			}
			try
			{
				FieldInfo fieldInfo = AccessTools.Field(__instance.GetType(), "_curBetColor");
				if (fieldInfo == null)
				{
					MelonLogger.Warning("[Rig Casino] _curBetColor field was not found.");
					return;
				}
				object val = __args[0];
				object val2 = fieldInfo.GetValue(__instance);
				__args[0] = val2;
				MelonLogger.Msg(string.Concat("[Rig Casino] FORCED roulette result: ", val, " -> ", val2));
			}
			catch (Exception ex)
			{
				MelonLogger.Warning("[Rig Casino] " + RootMessage(ex));
			}
		}

		private static bool KeepInventoryServerDropAllPrefix()
		{
			return !KeepInventory;
		}

		private static void KeepInventoryDeathPrefix(object __instance)
		{
			if (!KeepInventory || __instance == null)
			{
				return;
			}
			try
			{
				FieldInfo fieldInfo = AccessTools.Field(_playerDyingType, "_player");
				object obj = ((fieldInfo != null) ? fieldInfo.GetValue(__instance) : null);
				if (IsRemoteClientSession())
				{
					object obj2 = FindLocalPlayerStatic();
					if (obj2 != null)
					{
						obj = obj2;
					}
					if (obj != null)
					{
						CaptureClientInventorySnapshot(obj);
					}
				}
				StashHeldItemBeforeDeath(obj);
			}
			catch (Exception ex)
			{
				MelonLogger.Warning("[Keep Inventory] death stash: " + RootMessage(ex));
			}
		}

		private static void StashHeldItemBeforeDeath(object player)
		{
			if (!KeepInventory || player == null)
			{
				return;
			}
			try
			{
				PropertyInfo propertyInfo = Property(player.GetType(), "Holding");
				object obj = ((propertyInfo != null) ? propertyInfo.GetValue(player, null) : null);
				if (obj == null)
				{
					return;
				}
				PropertyInfo propertyInfo2 = Property(obj.GetType(), "HeldItem");
				object obj2 = ((propertyInfo2 != null) ? propertyInfo2.GetValue(obj, null) : null);
				if (!UnityObjectExists(obj2))
				{
					return;
				}
				PropertyInfo propertyInfo3 = Property(obj2.GetType(), "DeadPlayer");
				object value = ((propertyInfo3 != null) ? propertyInfo3.GetValue(obj2, null) : null);
				if (UnityObjectExists(value))
				{
					return;
				}
				if (TryPutHeldItemInInventory(player, obj2))
				{
					MethodInfo methodInfo = Method(obj2.GetType(), "PutInInventory", 0);
					if (methodInfo != null)
					{
						methodInfo.Invoke(obj2, null);
					}
					PropertyInfo propertyInfo4 = Property(player.GetType(), "Hands");
					object obj3 = ((propertyInfo4 != null) ? propertyInfo4.GetValue(player, null) : null);
					if (obj3 != null)
					{
						MethodInfo methodInfo2 = Method(obj3.GetType(), "DropItem", 2);
						if (methodInfo2 != null)
						{
							methodInfo2.Invoke(obj3, new object[2] { true, obj2 });
						}
					}
					MethodInfo methodInfo3 = Method(obj.GetType(), "SetHeldItem", 1);
					if (methodInfo3 != null)
					{
						object[] parameters = new object[1];
						methodInfo3.Invoke(obj, parameters);
					}
					return;
				}
				PropertyInfo propertyInfo5 = Property(obj2.GetType(), "Holder");
				object a = ((propertyInfo5 != null) ? propertyInfo5.GetValue(obj2, null) : null);
				if (SameUnityObject(a, player))
				{
					MethodInfo methodInfo4 = Method(obj2.GetType(), "Drop", 3);
					if (methodInfo4 != null)
					{
						methodInfo4.Invoke(obj2, new object[3]
						{
							true,
							Vector3.zero,
							Vector3.zero
						});
					}
				}
			}
			catch (Exception ex)
			{
				MelonLogger.Warning("[Keep Inventory] held item stash: " + RootMessage(ex));
			}
		}

		private static bool TryPutHeldItemInInventory(object player, object item)
		{
			if (player == null || item == null)
			{
				return false;
			}
			try
			{
				PropertyInfo propertyInfo = Property(player.GetType(), "Inventory");
				object obj = ((propertyInfo != null) ? propertyInfo.GetValue(player, null) : null);
				if (obj == null)
				{
					return false;
				}
				MethodInfo methodInfo = Method(obj.GetType(), "HasItemInInventory", 1);
				if (methodInfo != null && Convert.ToBoolean(methodInfo.Invoke(obj, new object[1] { item })))
				{
					return true;
				}
				MethodInfo methodInfo2 = Method(obj.GetType(), "ServerTryStoreHeldItem", 1);
				if (methodInfo2 != null && Convert.ToBoolean(methodInfo2.Invoke(obj, new object[1] { item })))
				{
					return true;
				}
				MethodInfo methodInfo3 = Method(obj.GetType(), "GetOpenSlot", 1);
				int num = ((methodInfo3 != null) ? Convert.ToInt32(methodInfo3.Invoke(obj, new object[1] { 0 })) : (-1));
				if (num < 0)
				{
					return false;
				}
				return InvokeServerRpcForced("PutItemInInventory", "RpcWriter___PutItemInInventory", 3, new object[3]
				{
					player,
					item,
					(byte)num
				}, "keep inventory held item");
			}
			catch
			{
				return false;
			}
		}

		private static bool UnityObjectExists(object value)
		{
			if (value == null)
			{
				return false;
			}
			try
			{
				UnityEngine.Object @object = value as UnityEngine.Object;
				if (@object != null)
				{
					return true;
				}
			}
			catch
			{
			}
			return !(value is UnityEngine.Object);
		}

		private static bool SameUnityObject(object a, object b)
		{
			if (object.ReferenceEquals(a, b))
			{
				return true;
			}
			try
			{
				UnityEngine.Object @object = a as UnityEngine.Object;
				UnityEngine.Object object2 = b as UnityEngine.Object;
				if (@object != null && object2 != null)
				{
					return @object == object2;
				}
			}
			catch
			{
			}
			return false;
		}

		private static void MoneySellPrefix()
		{
			_inSellContext = true;
		}

		private static void MoneySellPostfix()
		{
			_inSellContext = false;
		}

		private static void ItemTotalWorthPostfix(ref int __result)
		{
			if (_inSellContext && Math.Abs(SellPriceMultiplier - 1f) > 0.001f)
			{
				__result = Math.Max(0, (int)Math.Round((float)__result * SellPriceMultiplier));
			}
		}

		private void LogNetworkRoleOnce()
		{
			if (!_networkRoleLogged)
			{
				object serverInstanceStrong = GetServerInstanceStrong();
				if (serverInstanceStrong != null)
				{
					bool flag = GetNetworkBool(serverInstanceStrong, "IsServerStarted") || GetNetworkBool(serverInstanceStrong, "IsServerInitialized");
					bool flag2 = GetNetworkBool(serverInstanceStrong, "IsClientStarted") || GetNetworkBool(serverInstanceStrong, "IsClientInitialized");
					_networkRoleLogged = true;
					MelonLogger.Msg("[ClientFix] NETWORK ROLE -> server=" + flag + " client=" + flag2 + " remoteClient=" + (flag2 && !flag));
				}
			}
		}

		internal static bool IsRemoteClientSession()
		{
			object serverInstanceStrong = GetServerInstanceStrong();
			if (serverInstanceStrong == null)
			{
				return false;
			}
			bool flag = GetNetworkBool(serverInstanceStrong, "IsServerStarted") || GetNetworkBool(serverInstanceStrong, "IsServerInitialized");
			bool flag2 = GetNetworkBool(serverInstanceStrong, "IsClientStarted") || GetNetworkBool(serverInstanceStrong, "IsClientInitialized");
			bool networkBool = GetNetworkBool(serverInstanceStrong, "IsOffline");
			if (flag2 && !flag)
			{
				return !networkBool;
			}
			return false;
		}

		private static object GetServerInstanceStrong()
		{
			if (_serverType == null)
			{
				return null;
			}
			try
			{
				PropertyInfo propertyInfo = Property(_serverType, "Instance");
				if (propertyInfo != null)
				{
					object value = propertyInfo.GetValue(null, null);
					if (value != null)
					{
						return value;
					}
				}
			}
			catch
			{
			}
			try
			{
				FieldInfo fieldInfo = Field(_serverType, "<Instance>k__BackingField");
				if (fieldInfo != null)
				{
					object value2 = fieldInfo.GetValue(null);
					if (value2 != null)
					{
						return value2;
					}
				}
			}
			catch
			{
			}
			UnityEngine.Object[] array = FindObjects(_serverType);
			object obj3 = null;
			for (int i = 0; i < array.Length; i++)
			{
				Component component = array[i] as Component;
				if (!(component == null) && !(component.gameObject == null) && component.gameObject.activeInHierarchy)
				{
					if (obj3 == null)
					{
						obj3 = array[i];
					}
					string transformPath = GetTransformPath(component.transform);
					if (transformPath.IndexOf("Client(Clone)/Server(Clone)", StringComparison.OrdinalIgnoreCase) >= 0)
					{
						return array[i];
					}
				}
			}
			return obj3;
		}

		private static MethodInfo FindMethodStartsWith(Type type, string prefix, int parameterCount)
		{
			if (type == null)
			{
				return null;
			}
			MethodInfo[] methods = type.GetMethods(BindingFlags.Instance | BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic);
			foreach (MethodInfo methodInfo in methods)
			{
				if (methodInfo != null && methodInfo.Name.StartsWith(prefix, StringComparison.Ordinal) && methodInfo.GetParameters().Length == parameterCount)
				{
					return methodInfo;
				}
			}
			return null;
		}

		private static bool InvokeServerRpcForced(string publicMethodName, string writerPrefix, int parameterCount, object[] args, string reason)
		{
			object serverInstanceStrong = GetServerInstanceStrong();
			if (serverInstanceStrong == null)
			{
				return false;
			}
			try
			{
				if (IsRemoteClientSession())
				{
					MethodInfo methodInfo = FindMethodStartsWith(_serverType, writerPrefix, parameterCount);
					if (methodInfo != null)
					{
						methodInfo.Invoke(serverInstanceStrong, args);
						MelonLogger.Msg("[ClientFix] RPC WRITER -> " + methodInfo.Name + " // " + reason);
						return true;
					}
				}
				MethodInfo methodInfo2 = Method(_serverType, publicMethodName, parameterCount);
				if (methodInfo2 != null)
				{
					methodInfo2.Invoke(serverInstanceStrong, args);
					MelonLogger.Msg("[ClientFix] SERVER ROUTE -> " + publicMethodName + " // " + reason);
					return true;
				}
			}
			catch (TargetInvocationException ex)
			{
				Exception ex2 = ((ex.InnerException != null) ? ex.InnerException : ex);
				MelonLogger.Warning("[ClientFix] " + reason + " failed: " + ex2.GetType().Name + ": " + ex2.Message);
			}
			catch (Exception ex3)
			{
				MelonLogger.Warning("[ClientFix] " + reason + " failed: " + ex3.GetType().Name + ": " + ex3.Message);
			}
			return false;
		}

		private static bool InvokeServerRpcForcedSilent(string publicMethodName, string writerPrefix, int parameterCount, object[] args)
		{
			object serverInstanceStrong = GetServerInstanceStrong();
			if (serverInstanceStrong == null)
			{
				return false;
			}
			try
			{
				if (IsRemoteClientSession())
				{
					MethodInfo methodInfo = FindMethodStartsWith(_serverType, writerPrefix, parameterCount);
					if (methodInfo != null)
					{
						methodInfo.Invoke(serverInstanceStrong, args);
						return true;
					}
				}
				MethodInfo methodInfo2 = Method(_serverType, publicMethodName, parameterCount);
				if (methodInfo2 != null)
				{
					methodInfo2.Invoke(serverInstanceStrong, args);
					return true;
				}
			}
			catch (Exception ex)
			{
				if (Time.unscaledTime >= _nextCasinoAuthorityLog)
				{
					_nextCasinoAuthorityLog = Time.unscaledTime + 1.5f;
					Exception ex2 = ((ex is TargetInvocationException && ((TargetInvocationException)ex).InnerException != null) ? ((TargetInvocationException)ex).InnerException : ex);
					MelonLogger.Warning("[Rig Casino] silent RPC authority push failed: " + ex2.GetType().Name + ": " + ex2.Message);
				}
			}
			return false;
		}

		private void ApplyClientSellMultiplier(object player)
		{
			if (!IsRemoteClientSession() || player == null)
			{
				return;
			}
			List<object> list = CollectLocalInventoryItems(player);
			float sellPriceMultiplier = SellPriceMultiplier;
			for (int i = 0; i < list.Count; i++)
			{
				object obj = list[i];
				if (UnityObjectExists(obj))
				{
					int key = UnityId(obj);
					float value;
					if ((!_clientSellMultiplierApplied.TryGetValue(key, out value) || !(Math.Abs(value - sellPriceMultiplier) < 0.001f)) && InvokeServerRpcForced("SetItemMultiplier", "RpcWriter___SetItemMultiplier", 2, new object[2] { obj, sellPriceMultiplier }, "sell multiplier " + sellPriceMultiplier.ToString("0.#") + "x"))
					{
						_clientSellMultiplierApplied[key] = sellPriceMultiplier;
						MelonLogger.Msg("[ClientFix] SELL MULTIPLIER -> " + GetUnityName(obj) + " = " + sellPriceMultiplier.ToString("0.#") + "x");
					}
				}
			}
		}

		private static List<object> CollectLocalInventoryItems(object player)
		{
			List<object> list = new List<object>();
			if (player == null)
			{
				return list;
			}
			try
			{
				PropertyInfo propertyInfo = Property(_playerType, "Inventory");
				object obj = ((propertyInfo != null) ? propertyInfo.GetValue(player, null) : null);
				if (obj != null)
				{
					FieldInfo fieldInfo = Field(_playerInventoryType, "_items");
					object obj2 = ((fieldInfo != null) ? fieldInfo.GetValue(obj) : null);
					IEnumerable enumerable = obj2 as IEnumerable;
					if (enumerable != null)
					{
						foreach (object item in enumerable)
						{
							if (item != null)
							{
								PropertyInfo propertyInfo2 = Property(item.GetType(), "Value");
								object obj3 = ((propertyInfo2 != null) ? propertyInfo2.GetValue(item, null) : null);
								if (UnityObjectExists(obj3) && !ContainsUnityObject(list, obj3))
								{
									list.Add(obj3);
								}
							}
						}
					}
				}
				object obj4 = null;
				PropertyInfo propertyInfo3 = Property(player.GetType(), "Holding");
				object obj5 = ((propertyInfo3 != null) ? propertyInfo3.GetValue(player, null) : null);
				PropertyInfo propertyInfo4 = ((obj5 != null) ? Property(obj5.GetType(), "HeldItem") : null);
				obj4 = ((propertyInfo4 != null) ? propertyInfo4.GetValue(obj5, null) : null);
				if (UnityObjectExists(obj4) && !ContainsUnityObject(list, obj4))
				{
					list.Add(obj4);
				}
			}
			catch
			{
			}
			return list;
		}

		private static bool ContainsUnityObject(List<object> list, object value)
		{
			for (int i = 0; i < list.Count; i++)
			{
				if (SameUnityObject(list[i], value))
				{
					return true;
				}
			}
			return false;
		}

		private static int GetOpenInventorySlot(object player)
		{
			try
			{
				PropertyInfo propertyInfo = Property(_playerType, "Inventory");
				object obj = ((propertyInfo != null) ? propertyInfo.GetValue(player, null) : null);
				MethodInfo methodInfo = ((obj != null) ? Method(obj.GetType(), "GetOpenSlot", 1) : null);
				if (methodInfo != null)
				{
					return Convert.ToInt32(methodInfo.Invoke(obj, new object[1] { 0 }));
				}
			}
			catch
			{
			}
			return -1;
		}

		private static bool ClientSnapshotContainsItem(object item)
		{
			if (!UnityObjectExists(item))
			{
				return false;
			}
			for (int i = 0; i < _clientKeepInventorySnapshot.Count; i++)
			{
				ClientInventorySnapshotItem clientInventorySnapshotItem = _clientKeepInventorySnapshot[i];
				if (clientInventorySnapshotItem != null && SameUnityObject(clientInventorySnapshotItem.Item, item))
				{
					return true;
				}
			}
			return false;
		}

		private static void CaptureClientInventorySnapshot(object player)
		{
			if (player == null)
			{
				return;
			}
			bool flag = _clientKeepInventorySnapshot.Count > 0 && Time.unscaledTime <= _clientKeepRecoveryUntil;
			if (!flag)
			{
				_clientKeepInventorySnapshot.Clear();
				_clientKeepRecoveryCursor = 0;
			}
			try
			{
				PropertyInfo propertyInfo = Property(_playerType, "Inventory");
				object obj = ((propertyInfo != null) ? propertyInfo.GetValue(player, null) : null);
				if (obj != null)
				{
					FieldInfo fieldInfo = Field(_playerInventoryType, "_items");
					object obj2 = ((fieldInfo != null) ? fieldInfo.GetValue(obj) : null);
					IEnumerable enumerable = obj2 as IEnumerable;
					if (enumerable != null)
					{
						foreach (object item in enumerable)
						{
							if (item == null)
							{
								continue;
							}
							PropertyInfo propertyInfo2 = Property(item.GetType(), "Key");
							PropertyInfo propertyInfo3 = Property(item.GetType(), "Value");
							object obj3 = ((propertyInfo3 != null) ? propertyInfo3.GetValue(item, null) : null);
							if (UnityObjectExists(obj3) && !ClientSnapshotContainsItem(obj3))
							{
								int num = ((propertyInfo2 != null) ? Convert.ToInt32(propertyInfo2.GetValue(item, null)) : (-1));
								if (num >= 0 && num <= 255)
								{
									_clientKeepInventorySnapshot.Add(new ClientInventorySnapshotItem(obj3, (byte)num, false));
								}
							}
						}
					}
				}
				PropertyInfo propertyInfo4 = Property(player.GetType(), "Holding");
				object obj4 = ((propertyInfo4 != null) ? propertyInfo4.GetValue(player, null) : null);
				PropertyInfo propertyInfo5 = ((obj4 != null) ? Property(obj4.GetType(), "HeldItem") : null);
				object obj5 = ((propertyInfo5 != null) ? propertyInfo5.GetValue(obj4, null) : null);
				if (UnityObjectExists(obj5) && !ClientSnapshotContainsItem(obj5))
				{
					_clientKeepInventorySnapshot.Add(new ClientInventorySnapshotItem(obj5, byte.MaxValue, true));
				}
			}
			catch (Exception ex)
			{
				MelonLogger.Warning("[ClientFix] Keep Inventory snapshot scan: " + RootMessage(ex));
			}
			if (_clientKeepInventorySnapshot.Count > 0)
			{
				_clientKeepWaitingForRespawn = true;
				_clientKeepRecoveryStart = float.MaxValue;
				_clientKeepRecoveryUntil = Time.unscaledTime + 60f;
				_clientKeepNextGlobalAttempt = float.MaxValue;
			}
			MelonLogger.Msg("[ClientFix] Keep Inventory snapshot -> " + _clientKeepInventorySnapshot.Count + " unique network item(s)." + (flag ? " (merged)" : ""));
		}

		private static object GetPlayerInventoryObject(object player)
		{
			try
			{
				if (player == null)
				{
					return null;
				}
				PropertyInfo propertyInfo = Property(player.GetType(), "Inventory");
				return (propertyInfo != null) ? propertyInfo.GetValue(player, null) : null;
			}
			catch
			{
				return null;
			}
		}

		private static bool PlayerInventorySlotContainsExactItem(object player, int slot, object item)
		{
			if (player == null || slot < 0 || slot > 255 || !UnityObjectExists(item))
			{
				return false;
			}
			try
			{
				object playerInventoryObject = GetPlayerInventoryObject(player);
				if (playerInventoryObject == null)
				{
					return false;
				}
				FieldInfo fieldInfo = Field(playerInventoryObject.GetType(), "_items");
				object obj = ((fieldInfo != null) ? fieldInfo.GetValue(playerInventoryObject) : null);
				IEnumerable enumerable = obj as IEnumerable;
				if (enumerable == null)
				{
					return false;
				}
				foreach (object item2 in enumerable)
				{
					if (item2 == null)
					{
						continue;
					}
					PropertyInfo propertyInfo = Property(item2.GetType(), "Key");
					PropertyInfo propertyInfo2 = Property(item2.GetType(), "Value");
					if (!(propertyInfo == null) && !(propertyInfo2 == null))
					{
						int num = Convert.ToInt32(propertyInfo.GetValue(item2, null));
						if (num == slot)
						{
							object value = propertyInfo2.GetValue(item2, null);
							return SameUnityObject(value, item);
						}
					}
				}
			}
			catch
			{
			}
			return false;
		}

		private static bool PlayerInventorySlotIsAvailable(object player, byte slot, object sameItem)
		{
			try
			{
				object playerInventoryObject = GetPlayerInventoryObject(player);
				if (playerInventoryObject == null)
				{
					return false;
				}
				FieldInfo fieldInfo = Field(playerInventoryObject.GetType(), "_items");
				object obj = ((fieldInfo != null) ? fieldInfo.GetValue(playerInventoryObject) : null);
				IEnumerable enumerable = obj as IEnumerable;
				if (enumerable == null)
				{
					return true;
				}
				foreach (object item in enumerable)
				{
					if (item == null)
					{
						continue;
					}
					PropertyInfo propertyInfo = Property(item.GetType(), "Key");
					PropertyInfo propertyInfo2 = Property(item.GetType(), "Value");
					if (!(propertyInfo == null))
					{
						int num = Convert.ToInt32(propertyInfo.GetValue(item, null));
						if (num == slot)
						{
							object obj2 = ((propertyInfo2 != null) ? propertyInfo2.GetValue(item, null) : null);
							return obj2 == null || SameUnityObject(obj2, sameItem);
						}
					}
				}
			}
			catch
			{
			}
			return true;
		}

		private static int GetRestoreInventorySlot(object player, ClientInventorySnapshotItem entry)
		{
			if (player == null || entry == null)
			{
				return -1;
			}
			if (!entry.WasHeld)
			{
				entry.RestoreSlot = entry.Slot;
				return entry.RestoreSlot;
			}
			if (entry.RestoreSlot >= 0 && entry.RestoreSlot <= 255)
			{
				return entry.RestoreSlot;
			}
			int openInventorySlot = GetOpenInventorySlot(player);
			if (openInventorySlot >= 0 && openInventorySlot <= 255)
			{
				entry.RestoreSlot = openInventorySlot;
				return openInventorySlot;
			}
			return -1;
		}

		private static bool TryGetRecoveryItemId(object item, out byte id)
		{
			id = 0;
			if (!UnityObjectExists(item))
			{
				return false;
			}
			try
			{
				PropertyInfo propertyInfo = Property(item.GetType(), "ID");
				if (propertyInfo == null && _itemType != null)
				{
					propertyInfo = Property(_itemType, "ID");
				}
				if (propertyInfo == null)
				{
					return false;
				}
				id = Convert.ToByte(propertyInfo.GetValue(item, null));
				return true;
			}
			catch
			{
				return false;
			}
		}

		private static object GetHeldItemForRecovery(object player)
		{
			if (player == null)
			{
				return null;
			}
			try
			{
				PropertyInfo propertyInfo = Property(player.GetType(), "Holding");
				object obj = ((propertyInfo != null) ? propertyInfo.GetValue(player, null) : null);
				PropertyInfo propertyInfo2 = ((obj != null) ? Property(obj.GetType(), "HeldItem") : null);
				return (propertyInfo2 != null) ? propertyInfo2.GetValue(obj, null) : null;
			}
			catch
			{
				return null;
			}
		}

		private static bool FreshRecoveryItemAlreadyAssigned(object item, ClientInventorySnapshotItem except)
		{
			if (!UnityObjectExists(item))
			{
				return false;
			}
			for (int i = 0; i < _clientKeepInventorySnapshot.Count; i++)
			{
				ClientInventorySnapshotItem clientInventorySnapshotItem = _clientKeepInventorySnapshot[i];
				if (clientInventorySnapshotItem != null && !object.ReferenceEquals(clientInventorySnapshotItem, except) && UnityObjectExists(clientInventorySnapshotItem.FreshItem) && SameUnityObject(clientInventorySnapshotItem.FreshItem, item))
				{
					return true;
				}
			}
			return false;
		}

		private static bool IsFreshRecoveryCandidate(ClientInventorySnapshotItem entry, object item)
		{
			if (entry == null || !entry.HasItemId || !UnityObjectExists(item))
			{
				return false;
			}
			if (UnityObjectExists(entry.Item) && SameUnityObject(entry.Item, item))
			{
				return false;
			}
			if (FreshRecoveryItemAlreadyAssigned(item, entry))
			{
				return false;
			}
			byte id;
			if (TryGetRecoveryItemId(item, out id))
			{
				return id == entry.ItemId;
			}
			return false;
		}

		private static object FindFreshRecoveryItem(object player, ClientInventorySnapshotItem entry)
		{
			if (player == null || entry == null)
			{
				return null;
			}
			object heldItemForRecovery = GetHeldItemForRecovery(player);
			if (IsFreshRecoveryCandidate(entry, heldItemForRecovery))
			{
				return heldItemForRecovery;
			}
			try
			{
				object playerInventoryObject = GetPlayerInventoryObject(player);
				FieldInfo fieldInfo = ((playerInventoryObject != null) ? Field(playerInventoryObject.GetType(), "_items") : null);
				IEnumerable enumerable = ((fieldInfo != null) ? (fieldInfo.GetValue(playerInventoryObject) as IEnumerable) : null);
				if (enumerable != null)
				{
					foreach (object item in enumerable)
					{
						if (item != null)
						{
							PropertyInfo propertyInfo = Property(item.GetType(), "Value");
							object obj = ((propertyInfo != null) ? propertyInfo.GetValue(item, null) : null);
							if (IsFreshRecoveryCandidate(entry, obj))
							{
								return obj;
							}
						}
					}
				}
			}
			catch
			{
			}
			UnityEngine.Object[] array = FindObjects(_itemType);
			foreach (object obj3 in array)
			{
				if (!IsFreshRecoveryCandidate(entry, obj3))
				{
					continue;
				}
				try
				{
					PropertyInfo propertyInfo2 = Property(obj3.GetType(), "SyncedHolder");
					object obj4 = ((propertyInfo2 != null) ? propertyInfo2.GetValue(obj3, null) : null);
					if (obj4 != null && SameUnityObject(obj4, player))
					{
						return obj3;
					}
					FieldInfo fieldInfo2 = Field(obj3.GetType(), "_holder");
					obj4 = ((fieldInfo2 != null) ? fieldInfo2.GetValue(obj3) : null);
					if (obj4 != null && SameUnityObject(obj4, player))
					{
						return obj3;
					}
				}
				catch
				{
				}
			}
			return null;
		}

		private static bool SendRecoveryBuyItem(object player, ClientInventorySnapshotItem entry)
		{
			if (player == null || entry == null || !entry.HasItemId)
			{
				return false;
			}
			Vector3 vector = Vector3.zero;
			Quaternion quaternion = Quaternion.identity;
			Component component = player as Component;
			if (component != null && component.transform != null)
			{
				vector = component.transform.position + component.transform.forward * 0.75f + Vector3.up * 0.35f;
				quaternion = component.transform.rotation;
			}
			return InvokeServerRpcForced("BuyItem", "RpcWriter___BuyItem", 6, new object[6] { entry.ItemId, player, null, vector, quaternion, true }, "keep inventory server recreate");
		}

		private static void ProcessClientKeepInventoryRecovery(object player)
		{
			if (_clientKeepInventorySnapshot.Count == 0 || player == null)
			{
				return;
			}
			float unscaledTime = Time.unscaledTime;
			if (_clientKeepWaitingForRespawn || unscaledTime < _clientKeepRecoveryStart)
			{
				return;
			}
			if (unscaledTime > _clientKeepRecoveryUntil)
			{
				int num = 0;
				for (int i = 0; i < _clientKeepInventorySnapshot.Count; i++)
				{
					ClientInventorySnapshotItem clientInventorySnapshotItem = _clientKeepInventorySnapshot[i];
					if (clientInventorySnapshotItem != null && !clientInventorySnapshotItem.Recovered)
					{
						num++;
					}
				}
				MelonLogger.Warning("[ClientFix] Keep Inventory SERVER-RECREATE timeout -> " + num + " item(s) were not restored.");
				_clientKeepInventorySnapshot.Clear();
				_clientKeepRecoveryCursor = 0;
				_clientKeepWaitingForRespawn = false;
				return;
			}
			bool flag = true;
			int num2 = 0;
			for (int j = 0; j < _clientKeepInventorySnapshot.Count; j++)
			{
				ClientInventorySnapshotItem clientInventorySnapshotItem2 = _clientKeepInventorySnapshot[j];
				if (clientInventorySnapshotItem2 != null)
				{
					if (clientInventorySnapshotItem2.Failed)
					{
						num2++;
					}
					if (!clientInventorySnapshotItem2.Recovered && !clientInventorySnapshotItem2.Failed)
					{
						flag = false;
					}
				}
			}
			if (flag)
			{
				MelonLogger.Msg("[ClientFix] Keep Inventory SERVER-RECREATE complete -> " + (_clientKeepInventorySnapshot.Count - num2) + " restored, " + num2 + " failed.");
				_clientKeepInventorySnapshot.Clear();
				_clientKeepRecoveryCursor = 0;
				_clientKeepWaitingForRespawn = false;
			}
			else
			{
				if (unscaledTime < _clientKeepNextGlobalAttempt)
				{
					return;
				}
				_clientKeepNextGlobalAttempt = unscaledTime + 0.1f;
				ClientInventorySnapshotItem clientInventorySnapshotItem3 = null;
				for (int k = 0; k < _clientKeepInventorySnapshot.Count; k++)
				{
					ClientInventorySnapshotItem clientInventorySnapshotItem4 = _clientKeepInventorySnapshot[k];
					if (clientInventorySnapshotItem4 != null && !clientInventorySnapshotItem4.Recovered && !clientInventorySnapshotItem4.Failed)
					{
						clientInventorySnapshotItem3 = clientInventorySnapshotItem4;
						break;
					}
				}
				if (clientInventorySnapshotItem3 == null || unscaledTime < clientInventorySnapshotItem3.NextAttemptAt)
				{
					return;
				}
				if (!clientInventorySnapshotItem3.HasItemId)
				{
					clientInventorySnapshotItem3.Failed = true;
					MelonLogger.Warning("[ClientFix] Keep Inventory SERVER-RECREATE -> no Item.ID for " + clientInventorySnapshotItem3.NameAtSnapshot + "; cannot recreate it on the host.");
				}
				else if (clientInventorySnapshotItem3.RecoveryPhase == 0)
				{
					clientInventorySnapshotItem3.PurchaseAttempts++;
					bool flag2 = SendRecoveryBuyItem(player, clientInventorySnapshotItem3);
					clientInventorySnapshotItem3.RecoveryPhase = 1;
					clientInventorySnapshotItem3.NextAttemptAt = unscaledTime + 0.7f;
					if (flag2)
					{
						MelonLogger.Msg("[ClientFix] Keep Inventory BUY FORCE -> " + clientInventorySnapshotItem3.NameAtSnapshot + " id=" + clientInventorySnapshotItem3.ItemId + " savedSlot=" + clientInventorySnapshotItem3.Slot + " held=" + clientInventorySnapshotItem3.WasHeld + " attempt=" + clientInventorySnapshotItem3.PurchaseAttempts + "/4");
					}
					else
					{
						MelonLogger.Warning("[ClientFix] Keep Inventory BUY FORCE writer unavailable -> " + clientInventorySnapshotItem3.NameAtSnapshot + " id=" + clientInventorySnapshotItem3.ItemId);
					}
				}
				else if (clientInventorySnapshotItem3.RecoveryPhase == 1)
				{
					object obj = FindFreshRecoveryItem(player, clientInventorySnapshotItem3);
					if (UnityObjectExists(obj))
					{
						clientInventorySnapshotItem3.FreshItem = obj;
						if (clientInventorySnapshotItem3.WasHeld)
						{
							clientInventorySnapshotItem3.Recovered = true;
							MelonLogger.Msg("[ClientFix] Keep Inventory RESTORED HELD -> " + clientInventorySnapshotItem3.NameAtSnapshot + " id=" + clientInventorySnapshotItem3.ItemId);
						}
						else
						{
							clientInventorySnapshotItem3.RecoveryPhase = 2;
							clientInventorySnapshotItem3.NextAttemptAt = unscaledTime + 0.1f;
							MelonLogger.Msg("[ClientFix] Keep Inventory FRESH ITEM FOUND -> " + clientInventorySnapshotItem3.NameAtSnapshot + " id=" + clientInventorySnapshotItem3.ItemId + " -> moving to slot " + clientInventorySnapshotItem3.Slot);
						}
					}
					else if (clientInventorySnapshotItem3.PurchaseAttempts < 4)
					{
						clientInventorySnapshotItem3.RecoveryPhase = 0;
						clientInventorySnapshotItem3.NextAttemptAt = unscaledTime + 0.25f;
					}
					else
					{
						clientInventorySnapshotItem3.Failed = true;
						MelonLogger.Warning("[ClientFix] Keep Inventory BUY FORCE FAILED -> host never replicated " + clientInventorySnapshotItem3.NameAtSnapshot + " id=" + clientInventorySnapshotItem3.ItemId + " after 4 attempts.");
					}
				}
				else if (clientInventorySnapshotItem3.RecoveryPhase == 2)
				{
					if (!UnityObjectExists(clientInventorySnapshotItem3.FreshItem))
					{
						clientInventorySnapshotItem3.Failed = true;
						MelonLogger.Warning("[ClientFix] Keep Inventory fresh item vanished before slot restore -> " + clientInventorySnapshotItem3.NameAtSnapshot);
						return;
					}
					clientInventorySnapshotItem3.PutAttempts++;
					bool flag3 = InvokeServerRpcForced("PutItemInInventory", "RpcWriter___PutItemInInventory", 3, new object[3] { player, clientInventorySnapshotItem3.FreshItem, clientInventorySnapshotItem3.Slot }, "keep inventory fresh item slot restore");
					clientInventorySnapshotItem3.RecoveryPhase = 3;
					clientInventorySnapshotItem3.NextAttemptAt = unscaledTime + 0.65f;
					if (flag3)
					{
						MelonLogger.Msg("[ClientFix] Keep Inventory SLOT FORCE -> " + clientInventorySnapshotItem3.NameAtSnapshot + " slot=" + clientInventorySnapshotItem3.Slot + " attempt=" + clientInventorySnapshotItem3.PutAttempts + "/4");
					}
				}
				else if (clientInventorySnapshotItem3.RecoveryPhase == 3)
				{
					if (PlayerInventorySlotContainsExactItem(player, clientInventorySnapshotItem3.Slot, clientInventorySnapshotItem3.FreshItem))
					{
						clientInventorySnapshotItem3.Recovered = true;
						MelonLogger.Msg("[ClientFix] Keep Inventory RESTORED SLOT -> " + clientInventorySnapshotItem3.NameAtSnapshot + " slot=" + clientInventorySnapshotItem3.Slot + " id=" + clientInventorySnapshotItem3.ItemId);
					}
					else if (clientInventorySnapshotItem3.PutAttempts < 4)
					{
						clientInventorySnapshotItem3.RecoveryPhase = 2;
						clientInventorySnapshotItem3.NextAttemptAt = unscaledTime + 0.2f;
					}
					else
					{
						clientInventorySnapshotItem3.Failed = true;
						MelonLogger.Warning("[ClientFix] Keep Inventory SLOT FORCE FAILED -> " + clientInventorySnapshotItem3.NameAtSnapshot + " could not be placed into slot " + clientInventorySnapshotItem3.Slot + " after 4 attempts.");
					}
				}
			}
		}

		private static void ApplyClientIslandUnlockAuthority()
		{
			if (!_clientAllIslandsOverride || !IsRemoteClientSession())
			{
				return;
			}
			try
			{
				object onlineIslandManager = FindFirstActive(_onlineIslandManagerType);
				object saveManager = FindFirst(_saveManagerType);
				ForceLocalOnlineIslandUnlock(onlineIslandManager, _clientAllIslandsMax);
				ForceLocalServerSaveIsland(saveManager, _clientAllIslandsMax);
				if (Time.unscaledTime >= _nextIslandAuthorityPush)
				{
					_nextIslandAuthorityPush = Time.unscaledTime + 0.75f;
					ForceRemoteIslandUnlockAuthorityAggressive(onlineIslandManager, _clientAllIslandsMax);
				}
			}
			catch
			{
			}
		}

		private static void ForceRemoteIslandUnlockAuthorityAggressive(object onlineIslandManager, byte maxIsland)
		{
			if (!_clientAllIslandsOverride || !IsRemoteClientSession() || onlineIslandManager == null)
			{
				return;
			}
			try
			{
				FieldInfo fieldInfo = Field(onlineIslandManager.GetType(), "_maxIslandUnlocked");
				object obj = ((fieldInfo != null) ? fieldInfo.GetValue(onlineIslandManager) : null);
				if (obj == null)
				{
					return;
				}
				if (!_islandOriginalPermissionCaptured)
				{
					object obj2 = null;
					Type type = obj.GetType();
					while (type != null && obj2 == null)
					{
						FieldInfo field = type.GetField("Settings", BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic);
						if (field != null)
						{
							try
							{
								obj2 = field.GetValue(obj);
							}
							catch
							{
							}
						}
						type = type.BaseType;
					}
					if (obj2 != null)
					{
						FieldInfo fieldInfo2 = Field(obj2.GetType(), "WritePermission");
						_islandOriginalWritePermission = ((fieldInfo2 != null) ? fieldInfo2.GetValue(obj2) : null);
						_islandOriginalPermissionCaptured = _islandOriginalWritePermission != null;
					}
				}
				MethodInfo methodInfo = Method(obj.GetType(), "UpdatePermissions", 1);
				if (methodInfo != null)
				{
					ParameterInfo[] parameters = methodInfo.GetParameters();
					if (parameters.Length == 1 && parameters[0].ParameterType.IsEnum)
					{
						object obj4 = Enum.Parse(parameters[0].ParameterType, "ClientUnsynchronized");
						methodInfo.Invoke(obj, new object[1] { obj4 });
					}
				}
				MethodInfo methodInfo2 = Method(obj.GetType(), "UpdateSendRate", 1);
				if (methodInfo2 != null)
				{
					try
					{
						methodInfo2.Invoke(obj, new object[1] { 0f });
					}
					catch
					{
					}
				}
				MethodInfo methodInfo3 = Method(obj.GetType(), "SetValue", 3);
				if (methodInfo3 != null)
				{
					methodInfo3.Invoke(obj, new object[3] { maxIsland, true, true });
				}
				MethodInfo methodInfo4 = Method(obj.GetType(), "DirtyAll", 0);
				if (methodInfo4 != null)
				{
					try
					{
						methodInfo4.Invoke(obj, null);
					}
					catch
					{
					}
				}
				MethodInfo methodInfo5 = Method(onlineIslandManager.GetType(), "DirtySyncType", 0);
				if (methodInfo5 != null)
				{
					try
					{
						methodInfo5.Invoke(onlineIslandManager, null);
					}
					catch
					{
					}
				}
				if (Time.unscaledTime >= _nextIslandAuthorityLog)
				{
					_nextIslandAuthorityLog = Time.unscaledTime + 2f;
					MelonLogger.Msg("[ClientFix] ISLAND AUTHORITY FORGE -> _maxIslandUnlocked=" + maxIsland + " | getter override + ClientUnsynchronized SetValue(value,true,true) + DirtyAll.");
				}
			}
			catch (Exception ex)
			{
				if (Time.unscaledTime >= _nextIslandAuthorityLog)
				{
					_nextIslandAuthorityLog = Time.unscaledTime + 2f;
					MelonLogger.Warning("[ClientFix] island authority forge failed: " + RootMessage(ex));
				}
			}
		}

		private static void RestoreIslandAuthorityPermissions()
		{
			try
			{
				if (_islandOriginalPermissionCaptured && _islandOriginalWritePermission != null)
				{
					object obj = FindFirstActive(_onlineIslandManagerType);
					FieldInfo fieldInfo = ((obj != null) ? Field(obj.GetType(), "_maxIslandUnlocked") : null);
					object obj2 = ((obj != null && fieldInfo != null) ? fieldInfo.GetValue(obj) : null);
					if (obj2 != null)
					{
						MethodInfo methodInfo = Method(obj2.GetType(), "UpdatePermissions", 1);
						if (methodInfo != null)
						{
							try
							{
								methodInfo.Invoke(obj2, new object[1] { _islandOriginalWritePermission });
							}
							catch
							{
							}
						}
					}
				}
			}
			catch
			{
			}
			_clientAllIslandsOverride = false;
			_clientAllIslandsMax = 0;
			_islandOriginalWritePermission = null;
			_islandOriginalPermissionCaptured = false;
			_nextIslandAuthorityPush = 0f;
		}

		private static void ForceLocalOnlineIslandUnlock(object onlineIslandManager, byte maxIsland)
		{
			if (onlineIslandManager != null)
			{
				ForceSyncVarLocalValue(onlineIslandManager, "_maxIslandUnlocked", maxIsland);
			}
		}

		private static void ForceLocalServerSaveIsland(object saveManager, byte maxIsland)
		{
			if (saveManager == null)
			{
				return;
			}
			try
			{
				PropertyInfo propertyInfo = Property(_saveManagerType, "CurServerSave");
				object obj = ((propertyInfo != null) ? propertyInfo.GetValue(saveManager, null) : null);
				FieldInfo fieldInfo = ((obj != null) ? Field(obj.GetType(), "MaxIsland") : null);
				if (fieldInfo != null)
				{
					fieldInfo.SetValue(obj, maxIsland);
				}
			}
			catch
			{
			}
		}

		private static void ForceSyncVarLocalValue(object owner, string fieldName, object value)
		{
			if (owner == null)
			{
				return;
			}
			try
			{
				FieldInfo fieldInfo = Field(owner.GetType(), fieldName);
				object obj = ((fieldInfo != null) ? fieldInfo.GetValue(owner) : null);
				if (obj == null)
				{
					return;
				}
				MethodInfo methodInfo = Method(obj.GetType(), "SetValue", 3);
				if (methodInfo != null)
				{
					methodInfo.Invoke(obj, new object[3] { value, false, false });
				}
				else
				{
					FieldInfo fieldInfo2 = Field(obj.GetType(), "_value");
					if (fieldInfo2 != null)
					{
						fieldInfo2.SetValue(obj, value);
					}
				}
			}
			catch
			{
			}
		}

		private static string GetTransformPath(Transform t)
		{
			if (t == null)
			{
				return "";
			}
			string text = t.name;
			Transform parent = t.parent;
			while (parent != null)
			{
				text = parent.name + "/" + text;
				parent = parent.parent;
			}
			return text;
		}

		private static string GetUnityName(object obj)
		{
			try
			{
				UnityEngine.Object @object = obj as UnityEngine.Object;
				if (@object != null)
				{
					return @object.name;
				}
			}
			catch
			{
			}
			if (obj == null)
			{
				return "<null>";
			}
			return obj.GetType().Name;
		}

		private static Type T(string name)
		{
			if (!(_gameAssembly != null))
			{
				return null;
			}
			return _gameAssembly.GetType(name, false);
		}

		private static bool GetNetworkBool(object obj, string propertyName)
		{
			if (obj == null)
			{
				return false;
			}
			try
			{
				PropertyInfo propertyInfo = Property(obj.GetType(), propertyName);
				return propertyInfo != null && Convert.ToBoolean(propertyInfo.GetValue(obj, null));
			}
			catch
			{
				return false;
			}
		}

		private static bool IsLocalWeapon(object weapon)
		{
			object obj = FindLocalPlayerStatic();
			if (obj == null)
			{
				return false;
			}
			object heldSubItemStatic = GetHeldSubItemStatic(obj, "Weapon");
			return object.ReferenceEquals(heldSubItemStatic, weapon);
		}

		private static bool IsLocalInventory(object inventory)
		{
			if (inventory == null)
			{
				return false;
			}
			try
			{
				FieldInfo fieldInfo = Field(_playerInventoryType, "_player");
				object player = ((fieldInfo != null) ? fieldInfo.GetValue(inventory) : null);
				return IsLocalPlayerObject(player);
			}
			catch
			{
				return false;
			}
		}

		private static bool IsLocalOwnedComponent(object component)
		{
			if (component == null || _playerType == null)
			{
				return false;
			}
			try
			{
				Component component2 = component as Component;
				if (component2 == null)
				{
					return false;
				}
				object obj = null;
				try
				{
					obj = component2.GetComponent(_playerType);
				}
				catch
				{
				}
				if (obj == null)
				{
					try
					{
						obj = component2.GetComponentInParent(_playerType);
					}
					catch
					{
					}
				}
				if (obj == null)
				{
					try
					{
						obj = component2.GetComponentInChildren(_playerType);
					}
					catch
					{
					}
				}
				if (IsLocalPlayerObject(obj))
				{
					return true;
				}
				object obj5 = FindLocalPlayerStatic();
				if (obj5 == null)
				{
					return false;
				}
				Component component3 = obj5 as Component;
				if (component3 != null && component2.transform != null && component3.transform != null)
				{
					Transform transform = component2.transform;
					while (transform != null)
					{
						if (transform == component3.transform)
						{
							return true;
						}
						transform = transform.parent;
					}
				}
			}
			catch
			{
			}
			return false;
		}

		private static bool IsOwnerObject(object player)
		{
			if (player == null)
			{
				return false;
			}
			try
			{
				PropertyInfo property = player.GetType().GetProperty("IsOwner", BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic);
				if (property != null)
				{
					return Convert.ToBoolean(property.GetValue(player, null));
				}
			}
			catch
			{
			}
			return false;
		}

		internal static bool IsLocalPlayerObject(object player)
		{
			if (player == null)
			{
				return false;
			}
			if (IsOwnerObject(player))
			{
				return true;
			}
			object obj = FindLocalPlayerStatic(false);
			if (obj != null)
			{
				return SameUnityObject(obj, player);
			}
			return false;
		}

		private object FindLocalPlayer()
		{
			return FindLocalPlayerStatic();
		}

		internal static object FindLocalPlayerStatic()
		{
			return FindLocalPlayerStatic(true);
		}

		private static object FindLocalPlayerStatic(bool allowOwnerShortcut)
		{
			if (_playerType == null)
			{
				return null;
			}
			UnityEngine.Object[] array = FindObjects(_playerType);
			object result = null;
			int num = int.MinValue;
			PropertyInfo propertyInfo = Property(_playerType, "Camera");
			foreach (object obj in array)
			{
				Component component = obj as Component;
				if (component == null || component.gameObject == null)
				{
					continue;
				}
				int num2 = 0;
				string transformPath = GetTransformPath(component.transform);
				num2 = ((!component.gameObject.activeInHierarchy) ? (num2 - 1000) : (num2 + 300));
				num2 = ((!component.gameObject.scene.IsValid()) ? (num2 - 1000) : (num2 + 200));
				if (IsOwnerObject(obj))
				{
					if (allowOwnerShortcut)
					{
						return obj;
					}
					num2 += 3000;
				}
				if (GetNetworkBool(obj, "IsClientInitialized") || GetNetworkBool(obj, "IsClientStarted"))
				{
					num2 += 150;
				}
				if (transformPath.IndexOf("Client(Clone)/PlayerHolder(Clone)", StringComparison.OrdinalIgnoreCase) >= 0)
				{
					num2 += 1200;
				}
				else if (transformPath.IndexOf("PlayerHolder(Clone)", StringComparison.OrdinalIgnoreCase) >= 0)
				{
					num2 += 600;
				}
				if (transformPath.IndexOf("Backup", StringComparison.OrdinalIgnoreCase) >= 0)
				{
					num2 -= 2500;
				}
				try
				{
					object obj2 = ((propertyInfo != null) ? propertyInfo.GetValue(obj, null) : null);
					Behaviour behaviour = obj2 as Behaviour;
					Component component2 = obj2 as Component;
					if (component2 != null && component2.gameObject != null && component2.gameObject.activeInHierarchy && (behaviour == null || behaviour.enabled))
					{
						num2 += 1600;
					}
				}
				catch
				{
				}
				if (num2 > num)
				{
					num = num2;
					result = obj;
				}
			}
			return result;
		}

		private object GetHeldSubItem(object player, string propertyName)
		{
			return GetHeldSubItemStatic(player, propertyName);
		}

		internal static object GetHeldSubItemStatic(object player, string propertyName)
		{
			try
			{
				if (player == null)
				{
					return null;
				}
				PropertyInfo propertyInfo = Property(_playerType, "Inventory");
				object obj = ((propertyInfo != null) ? propertyInfo.GetValue(player, null) : null);
				if (obj == null)
				{
					return null;
				}
				PropertyInfo propertyInfo2 = Property(_playerInventoryType, "SyncedCurItem");
				object obj2 = ((propertyInfo2 != null) ? propertyInfo2.GetValue(obj, null) : null);
				if (obj2 == null)
				{
					return null;
				}
				PropertyInfo propertyInfo3 = Property(_itemType, propertyName);
				return (propertyInfo3 != null) ? propertyInfo3.GetValue(obj2, null) : null;
			}
			catch
			{
				return null;
			}
		}

		internal static object GetComponent(object component, Type wanted)
		{
			if (component == null || wanted == null)
			{
				return null;
			}
			try
			{
				Component component2 = component as Component;
				if (component2 == null)
				{
					return null;
				}
				object obj = null;
				try
				{
					obj = component2.GetComponent(wanted);
				}
				catch
				{
				}
				if (obj == null)
				{
					try
					{
						obj = component2.GetComponentInChildren(wanted);
					}
					catch
					{
					}
				}
				if (obj == null)
				{
					try
					{
						obj = component2.GetComponentInParent(wanted);
					}
					catch
					{
					}
				}
				if (obj != null)
				{
					return obj;
				}
				UnityEngine.Object[] array = FindObjects(wanted);
				object obj5 = null;
				int num = 0;
				for (int i = 0; i < array.Length; i++)
				{
					Component component3 = array[i] as Component;
					if (component3 != null && component3.gameObject != null && component3.gameObject.activeInHierarchy)
					{
						num++;
						obj5 = array[i];
					}
				}
				return (num == 1) ? obj5 : null;
			}
			catch
			{
				return null;
			}
		}

		private static UnityEngine.Object[] FindObjects(Type type)
		{
			if (type == null)
			{
				return new UnityEngine.Object[0];
			}
			try
			{
				return Resources.FindObjectsOfTypeAll(type);
			}
			catch
			{
				return new UnityEngine.Object[0];
			}
		}

		private static object FindFirstActive(Type type)
		{
			if (type == null)
			{
				return null;
			}
			UnityEngine.Object[] array = FindObjects(type);
			foreach (UnityEngine.Object @object in array)
			{
				if (@object == null)
				{
					continue;
				}
				Component component = @object as Component;
				if (component != null)
				{
					if (component.gameObject != null && component.gameObject.activeInHierarchy)
					{
						return @object;
					}
					continue;
				}
				GameObject gameObject = @object as GameObject;
				if (gameObject != null)
				{
					if (gameObject.activeInHierarchy)
					{
						return @object;
					}
					continue;
				}
				return @object;
			}
			return null;
		}

		private static object FindFirst(Type type)
		{
			UnityEngine.Object[] array = FindObjects(type);
			for (int i = 0; i < array.Length; i++)
			{
				Component component = array[i] as Component;
				if (component == null || component.gameObject == null || component.gameObject.activeInHierarchy)
				{
					return array[i];
				}
			}
			if (array.Length <= 0)
			{
				return null;
			}
			return array[0];
		}

		private static Assembly FindAssembly(string name)
		{
			Assembly[] assemblies = AppDomain.CurrentDomain.GetAssemblies();
			for (int i = 0; i < assemblies.Length; i++)
			{
				try
				{
					if (string.Equals(assemblies[i].GetName().Name, name, StringComparison.OrdinalIgnoreCase))
					{
						return assemblies[i];
					}
				}
				catch
				{
				}
			}
			return null;
		}

		private static FieldInfo Field(Type t, string name)
		{
			if (t == null)
			{
				return null;
			}
			return t.GetField(name, BindingFlags.Instance | BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic);
		}

		private static PropertyInfo Property(Type t, string name)
		{
			if (t == null)
			{
				return null;
			}
			return t.GetProperty(name, BindingFlags.Instance | BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic);
		}

		private static MethodInfo Method(Type t, string name, int parameterCount)
		{
			if (t == null)
			{
				return null;
			}
			MethodInfo[] methods = t.GetMethods(BindingFlags.Instance | BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic);
			for (int i = 0; i < methods.Length; i++)
			{
				if (methods[i].Name == name && methods[i].GetParameters().Length == parameterCount)
				{
					return methods[i];
				}
			}
			return null;
		}

		private static int UnityId(object obj)
		{
			try
			{
				UnityEngine.Object @object = obj as UnityEngine.Object;
				return (@object != null) ? @object.GetInstanceID() : obj.GetHashCode();
			}
			catch
			{
				return obj?.GetHashCode() ?? 0;
			}
		}

		private static bool IsEnabled(Feature feature)
		{
			switch (feature)
			{
			case Feature.InfiniteHealth:
				return InfiniteHealth;
			case Feature.KeepInventory:
				return KeepInventory;
			case Feature.SwimNoDrown:
				return SwimNoDrown;
			case Feature.NeverLoseFish:
				return NeverLoseFish;
			case Feature.InstantCatch:
				return InstantCatch;
			case Feature.AutoPerfectReel:
				return AutoPerfectReel;
			case Feature.InfiniteBait:
				return InfiniteBait;
			case Feature.BirdsNeverSteal:
				return BirdsNeverSteal;
			case Feature.GuaranteedRare:
				return GuaranteedRare;
			case Feature.HighlightFish:
				return HighlightFish;
			case Feature.FastReel:
				return FastReel;
			case Feature.InfiniteAmmo:
				return InfiniteAmmo;
			case Feature.NoReload:
				return NoReload;
			case Feature.NoRecoilSpread:
				return NoRecoilSpread;
			case Feature.OneHitKill:
				return OneHitKill;
			case Feature.InfiniteMoney:
				return InfiniteMoney;
			case Feature.RigCasino:
				return RigCasino;
			case Feature.RevealMap:
				return RevealMap;
			case Feature.HideInterface:
				return HideInterface;
			case Feature.DisableScreenShake:
				return DisableScreenShake;
			default:
				return false;
			}
		}

		private static void SetEnabled(Feature feature, bool value)
		{
			switch (feature)
			{
			case Feature.InfiniteHealth:
				InfiniteHealth = value;
				if (value)
				{
					_demiGodServerAfkSent = false;
					_nextDemiGodAfkSyncTime = 0f;
					if (IsRemoteClientSession())
					{
						SetClientDemiGodServerAfk(true);
					}
					MelonLogger.Msg(IsRemoteClientSession() ? "[ClientFix] GodMode ON -> server AFK damage/hunger shield + outbound HitPlayer damage=0." : "[Health] GodMode ON -> authoritative local TakeDamage will be blocked.");
				}
				else
				{
					_demiGodServerAfkSent = false;
					_nextDemiGodAfkSyncTime = 0f;
					if (IsRemoteClientSession())
					{
						SetClientDemiGodServerAfk(false);
					}
					MelonLogger.Msg("[Health] GodMode OFF.");
				}
				break;
			case Feature.KeepInventory:
				KeepInventory = value;
				break;
			case Feature.SwimNoDrown:
				SwimNoDrown = value;
				break;
			case Feature.NeverLoseFish:
				NeverLoseFish = value;
				break;
			case Feature.InstantCatch:
				InstantCatch = value;
				break;
			case Feature.AutoPerfectReel:
				AutoPerfectReel = value;
				break;
			case Feature.InfiniteBait:
				InfiniteBait = value;
				break;
			case Feature.BirdsNeverSteal:
				BirdsNeverSteal = value;
				break;
			case Feature.GuaranteedRare:
				GuaranteedRare = value;
				break;
			case Feature.HighlightFish:
				HighlightFish = value;
				break;
			case Feature.FastReel:
				FastReel = value;
				break;
			case Feature.InfiniteAmmo:
				InfiniteAmmo = value;
				break;
			case Feature.NoReload:
				NoReload = value;
				break;
			case Feature.NoRecoilSpread:
				NoRecoilSpread = value;
				break;
			case Feature.OneHitKill:
				OneHitKill = value;
				break;
			case Feature.InfiniteMoney:
				InfiniteMoney = value;
				break;
			case Feature.RigCasino:
				RigCasino = value;
				if (value)
				{
					_casinoChosenBetColor = byte.MaxValue;
					_casinoBetTracked = false;
					_casinoPreBetWorth = 0;
					_casinoRouletteLockReady = false;
					_casinoRouletteLockLogged = false;
					_casinoForceResultUntil = 0f;
					_nextCasinoAuthorityPush = 0f;
					MelonLogger.Msg(IsRemoteClientSession() ? "[Rig Casino] ON -> remote authority takeover armed: roulette-state RPC lock + forced win + forged payout SyncVar." : "[Rig Casino] ON -> host authoritative roulette result + winning payout path forced.");
				}
				else
				{
					RestoreCasinoAuthorityPermissions();
					MelonLogger.Msg("[Rig Casino] OFF -> casino SyncVar permission/state restored.");
				}
				break;
			case Feature.RevealMap:
				RevealMap = false;
				break;
			case Feature.HideInterface:
				HideInterface = value;
				break;
			case Feature.DisableScreenShake:
				DisableScreenShake = value;
				break;
			}
		}

		private void ResetEverything()
		{
			bool flag = InfiniteHealth && IsRemoteClientSession();
			InfiniteHealth = false;
			if (flag)
			{
				SetClientDemiGodServerAfk(false);
			}
			_demiGodServerAfkSent = false;
			_nextDemiGodAfkSyncTime = 0f;
			KeepInventory = false;
			_clientKeepWaitingForRespawn = false;
			_clientKeepInventorySnapshot.Clear();
			SwimNoDrown = false;
			NeverLoseFish = false;
			InstantCatch = false;
			AutoPerfectReel = false;
			InfiniteBait = false;
			BirdsNeverSteal = false;
			RestoreRareAuthorityPermissions();
			GuaranteedRare = false;
			HighlightFish = false;
			FastReel = false;
			InfiniteAmmo = false;
			NoReload = false;
			NoRecoilSpread = false;
			OneHitKill = false;
			InfiniteMoney = false;
			RestoreIslandAuthorityPermissions();
			RestoreCasinoAuthorityPermissions();
			RigCasino = false;
			RevealMap = false;
			_pendingFriendTeleportUntil = 0f;
			_nextFriendTeleportReinforce = 0f;
			HideInterface = false;
			DisableScreenShake = false;
			FishSizeMultiplier = 1f;
			BiteDelayMultiplier = 1f;
			DamageMultiplier = 1f;
			BossHealthPercent = 100;
			SellPriceMultiplier = 1f;
			Fov = 90;
			RestoreBirdFlags();
			RestoreFishHighlight();
			RestoreFishScales();
			RestoreBaitInfos();
			RestoreAllWeapons();
			RestoreAllRods();
			RestoreInterface();
			RestoreRuntimeTunings();
		}

		private void ApplyClientBirdReclaim()
		{
			if (!BirdsNeverSteal || !IsRemoteClientSession() || _itemType == null)
			{
				return;
			}
			object obj = FindLocalPlayerStatic();
			if (obj == null)
			{
				return;
			}
			object heldItemForRecovery = GetHeldItemForRecovery(obj);
			UnityEngine.Object[] array = FindObjects(_itemType);
			foreach (object obj2 in array)
			{
				if (!UnityObjectExists(obj2))
				{
					continue;
				}
				string unityName = GetUnityName(obj2);
				if ((_deadPlayerType != null && _deadPlayerType.IsAssignableFrom(obj2.GetType())) || (!string.IsNullOrEmpty(unityName) && unityName.StartsWith("DeadPlayer", StringComparison.OrdinalIgnoreCase)) || (UnityObjectExists(heldItemForRecovery) && SameUnityObject(obj2, heldItemForRecovery)))
				{
					continue;
				}
				object obj3 = null;
				try
				{
					PropertyInfo propertyInfo = Property(obj2.GetType(), "BirdHolder");
					if (propertyInfo == null)
					{
						propertyInfo = Property(_itemType, "BirdHolder");
					}
					if (propertyInfo != null)
					{
						obj3 = propertyInfo.GetValue(obj2, null);
					}
				}
				catch
				{
				}
				if (!UnityObjectExists(obj3) || (_birdType != null && !_birdType.IsAssignableFrom(obj3.GetType())))
				{
					continue;
				}
				object obj5 = null;
				try
				{
					PropertyInfo propertyInfo2 = Property(obj2.GetType(), "LastHolder");
					if (propertyInfo2 == null)
					{
						propertyInfo2 = Property(_itemType, "LastHolder");
					}
					if (propertyInfo2 != null)
					{
						obj5 = propertyInfo2.GetValue(obj2, null);
					}
				}
				catch
				{
				}
				if (!UnityObjectExists(obj5) || !IsLocalPlayerObject(obj5) || PlayerInventoryContainsExactItemSafe(obj, obj2))
				{
					continue;
				}
				int key = UnityId(obj2);
				float value;
				if (_clientBirdReclaimLastAttempt.TryGetValue(key, out value) && Time.unscaledTime - value < 2f)
				{
					continue;
				}
				int openInventorySlot = GetOpenInventorySlot(obj);
				if (openInventorySlot >= 0 && openInventorySlot <= 255)
				{
					_clientBirdReclaimLastAttempt[key] = Time.unscaledTime;
					if (InvokeServerRpcForced("PutItemInInventory", "RpcWriter___PutItemInInventory", 3, new object[3]
					{
						obj,
						obj2,
						(byte)openInventorySlot
					}, "bird reclaim safe client"))
					{
						MelonLogger.Msg("[ClientFix] Birds Never Steal SAFE CLIENT -> reclaimed " + unityName + " into free slot=" + openInventorySlot);
					}
				}
			}
		}

		private static bool PlayerInventoryContainsExactItemSafe(object player, object item)
		{
			if (player == null || !UnityObjectExists(item))
			{
				return false;
			}
			try
			{
				object playerInventoryObject = GetPlayerInventoryObject(player);
				if (playerInventoryObject == null)
				{
					return false;
				}
				FieldInfo fieldInfo = Field(playerInventoryObject.GetType(), "_items");
				IEnumerable enumerable = ((fieldInfo != null) ? (fieldInfo.GetValue(playerInventoryObject) as IEnumerable) : null);
				if (enumerable == null)
				{
					return false;
				}
				foreach (object item2 in enumerable)
				{
					if (item2 != null)
					{
						PropertyInfo propertyInfo = Property(item2.GetType(), "Value");
						object a = ((propertyInfo != null) ? propertyInfo.GetValue(item2, null) : null);
						if (SameUnityObject(a, item))
						{
							return true;
						}
					}
				}
			}
			catch
			{
			}
			return false;
		}

		private void RestoreBirdFlags()
		{
			if (_itemType == null || _birdOriginals.Count == 0)
			{
				return;
			}
			FieldInfo fieldInfo = Field(_itemType, "_ignoredBySeagulls");
			if (fieldInfo == null)
			{
				_birdOriginals.Clear();
				return;
			}
			UnityEngine.Object[] array = FindObjects(_itemType);
			foreach (object obj in array)
			{
				bool value;
				if (_birdOriginals.TryGetValue(UnityId(obj), out value))
				{
					try
					{
						fieldInfo.SetValue(obj, value);
					}
					catch
					{
					}
				}
			}
			_birdOriginals.Clear();
		}

		private void RestoreFishHighlight()
		{
			if (_itemType == null || _closeDotOriginals.Count == 0)
			{
				return;
			}
			FieldInfo fieldInfo = Field(_itemType, "_ignoredByCloseDots");
			if (fieldInfo == null)
			{
				_closeDotOriginals.Clear();
				return;
			}
			UnityEngine.Object[] array = FindObjects(_itemType);
			for (int i = 0; i < array.Length; i++)
			{
				bool value;
				if (_closeDotOriginals.TryGetValue(UnityId(array[i]), out value))
				{
					try
					{
						fieldInfo.SetValue(array[i], value);
					}
					catch
					{
					}
				}
			}
			_closeDotOriginals.Clear();
			if (!_itemDotsOriginalEnabled.HasValue)
			{
				return;
			}
			object obj2 = FindFirst(_closeItemsUIType);
			MethodInfo methodInfo = Method(_closeItemsUIType, "ToggleItemDots", 1);
			try
			{
				if (obj2 != null && methodInfo != null)
				{
					methodInfo.Invoke(obj2, new object[1] { _itemDotsOriginalEnabled.Value });
				}
			}
			catch
			{
			}
			_itemDotsOriginalEnabled = null;
		}

		private void RestoreBaitInfos()
		{
			if (_baitInfoType == null || _baitInfoOriginals.Count == 0)
			{
				return;
			}
			FieldInfo fieldInfo = Field(_baitInfoType, "_lostOnBaitChance");
			FieldInfo fieldInfo2 = Field(_baitInfoType, "_catchTimeMinMax");
			FieldInfo fieldInfo3 = Field(_baitInfoType, "_requireReelingToCatch");
			UnityEngine.Object[] array = FindObjects(_baitInfoType);
			for (int i = 0; i < array.Length; i++)
			{
				BaitInfoTuning value;
				if (!_baitInfoOriginals.TryGetValue(UnityId(array[i]), out value))
				{
					continue;
				}
				try
				{
					if (fieldInfo != null)
					{
						fieldInfo.SetValue(array[i], value.LostChance);
					}
				}
				catch
				{
				}
				try
				{
					if (fieldInfo2 != null)
					{
						fieldInfo2.SetValue(array[i], value.CatchTime);
					}
				}
				catch
				{
				}
				try
				{
					if (fieldInfo3 != null)
					{
						fieldInfo3.SetValue(array[i], value.RequireReeling);
					}
				}
				catch
				{
				}
			}
			_baitInfoOriginals.Clear();
		}

		private void RestoreAllWeapons()
		{
			if (_weaponType == null || _weaponOriginals.Count == 0)
			{
				return;
			}
			FieldInfo fieldInfo = Field(_weaponType, "_spread");
			FieldInfo fieldInfo2 = Field(_weaponType, "_recoilKnockback");
			UnityEngine.Object[] array = FindObjects(_weaponType);
			for (int i = 0; i < array.Length; i++)
			{
				WeaponTuning value;
				if (!_weaponOriginals.TryGetValue(UnityId(array[i]), out value))
				{
					continue;
				}
				try
				{
					if (fieldInfo != null)
					{
						fieldInfo.SetValue(array[i], value.Spread);
					}
				}
				catch
				{
				}
				try
				{
					if (fieldInfo2 != null)
					{
						fieldInfo2.SetValue(array[i], value.Recoil);
					}
				}
				catch
				{
				}
			}
			_weaponOriginals.Clear();
		}

		private void RestoreAllRods()
		{
			if (_fishingRodType == null || _rodOriginals.Count == 0)
			{
				return;
			}
			FieldInfo fieldInfo = Field(_fishingRodType, "_holdReelSpeed");
			FieldInfo fieldInfo2 = Field(_fishingRodType, "_lineReelStepLength");
			FieldInfo fieldInfo3 = Field(_fishingRodType, "_reelMultiIncreaseSpeed");
			UnityEngine.Object[] array = FindObjects(_fishingRodType);
			for (int i = 0; i < array.Length; i++)
			{
				RodTuning value;
				if (!_rodOriginals.TryGetValue(UnityId(array[i]), out value))
				{
					continue;
				}
				try
				{
					if (fieldInfo != null)
					{
						fieldInfo.SetValue(array[i], value.HoldSpeed);
					}
				}
				catch
				{
				}
				try
				{
					if (fieldInfo2 != null)
					{
						fieldInfo2.SetValue(array[i], value.Step);
					}
				}
				catch
				{
				}
				try
				{
					if (fieldInfo3 != null)
					{
						fieldInfo3.SetValue(array[i], value.Increase);
					}
				}
				catch
				{
				}
			}
			_rodOriginals.Clear();
		}

		private void RestoreRuntimeTunings()
		{
			try
			{
				object obj = FindLocalPlayer();
				if (obj != null)
				{
					ApplyMovement(obj);
					ApplyWeapon(obj);
					ApplyRod(obj);
					ApplyScreenShake(obj);
					ApplyHideInterface();
				}
			}
			catch
			{
			}
			_movementOriginals.Clear();
			_weaponOriginals.Clear();
			_rodOriginals.Clear();
			_shakeOriginals.Clear();
			if (_rareChanceOriginal.HasValue)
			{
				object obj3 = FindFirst(_creatureManagerType);
				FieldInfo fieldInfo = Field(_creatureManagerType, "_shinyCreatureChance");
				try
				{
					if (obj3 != null && fieldInfo != null)
					{
						fieldInfo.SetValue(obj3, _rareChanceOriginal.Value);
					}
				}
				catch
				{
				}
			}
			_rareChanceOriginal = null;
		}

		private void EnsureStyles()
		{
			if (_boxStyle == null)
			{
				RebuildGuiTextures();
				_boxStyle = new GUIStyle(GUI.skin.box);
				_boxStyle.normal.background = _panelTex;
				_titleStyle = new GUIStyle(GUI.skin.label);
				_titleStyle.fontSize = 18;
				_titleStyle.fontStyle = FontStyle.Bold;
				_titleStyle.normal.textColor = new Color(1f, 0.76f, 0.1f, 1f);
				_subTitleStyle = new GUIStyle(GUI.skin.label);
				_subTitleStyle.fontSize = 11;
				_subTitleStyle.fontStyle = FontStyle.Bold;
				_subTitleStyle.normal.textColor = new Color(0.88f, 0.88f, 0.88f, 1f);
				_normalStyle = new GUIStyle(GUI.skin.label);
				_normalStyle.fontSize = 14;
				_normalStyle.normal.textColor = new Color(0.92f, 0.92f, 0.92f, 1f);
				_dimStyle = new GUIStyle(_normalStyle);
				_dimStyle.normal.textColor = new Color(0.48f, 0.48f, 0.48f, 1f);
				_enabledStyle = new GUIStyle(_normalStyle);
				_enabledStyle.fontStyle = FontStyle.Bold;
				_enabledStyle.normal.textColor = new Color(1f, 0.75f, 0.1f, 1f);
				_selectedStyle = new GUIStyle(_normalStyle);
				_selectedStyle.fontStyle = FontStyle.Bold;
				_selectedStyle.normal.textColor = Color.white;
				_selectedEnabledStyle = new GUIStyle(_selectedStyle);
				_selectedEnabledStyle.normal.textColor = Color.white;
				_footerStyle = new GUIStyle(GUI.skin.label);
				_footerStyle.fontSize = 11;
				_footerStyle.wordWrap = true;
				_footerStyle.normal.textColor = new Color(0.72f, 0.72f, 0.72f, 1f);
			}
		}

		private void RebuildGuiTextures()
		{
			float num = (float)OverlayOpacityPercent / 100f;
			_panelTex = MakeTex(new Color(0.025f, 0.03f, 0.035f, num));
			_selectedTex = MakeTex(new Color(0.78f, 0.52f, 0.05f, Math.Min(0.82f, num)));
			_dividerTex = MakeTex(new Color(1f, 0.72f, 0.08f, num));
		}

		private static Texture2D MakeTex(Color color)
		{
			Texture2D texture2D = new Texture2D(1, 1);
			texture2D.SetPixel(0, 0, color);
			texture2D.Apply();
			return texture2D;
		}

		private static int NextInt(int[] values, int current)
		{
			for (int i = 0; i < values.Length; i++)
			{
				if (values[i] == current)
				{
					return values[(i + 1) % values.Length];
				}
			}
			return values[0];
		}

		private static float NextFloat(float[] values, float current)
		{
			for (int i = 0; i < values.Length; i++)
			{
				if (Math.Abs(values[i] - current) < 0.001f)
				{
					return values[(i + 1) % values.Length];
				}
			}
			return values[0];
		}

		private static bool KeyDown(int vk)
		{
			return (GetAsyncKeyState(vk) & 0x8000) != 0;
		}

		internal static bool IsGameForeground()
		{
			try
			{
				IntPtr foregroundWindow = GetForegroundWindow();
				if (foregroundWindow == IntPtr.Zero)
				{
					return false;
				}
				uint processId;
				GetWindowThreadProcessId(foregroundWindow, out processId);
				return processId == (uint)Process.GetCurrentProcess().Id;
			}
			catch
			{
				return true;
			}
		}

		private static string RootMessage(Exception ex)
		{
			Exception ex2 = ex;
			while (ex2 != null && ex2.InnerException != null)
			{
				ex2 = ex2.InnerException;
			}
			if (ex2 == null || string.IsNullOrEmpty(ex2.Message))
			{
				return "unknown error";
			}
			return ex2.Message;
		}
	}
}

