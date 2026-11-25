using System;
using System.IO;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.UI;
using Microsoft.UI.Windowing;
using Microsoft.UI.Xaml;
using Microsoft.Web.WebView2.Core;
using Windows.Graphics;
using WinRT.Interop;

namespace OutpostZero.WinUI;

internal sealed class HostWindowState
{
    public int Width { get; set; } = 1600;
    public int Height { get; set; } = 900;
    public bool Fullscreen { get; set; }
}

public sealed partial class MainWindow : Window
{
    private const string VirtualHostName = "outpostzero.app";
    private readonly IntPtr _hwnd;
    private readonly AppWindow _appWindow;
    private readonly string _statePath;
    private bool _isFullscreen;
    private bool _pointerConfined;
    private OpzGpuInfo _gpuInfo;

    public MainWindow()
    {
        InitializeComponent();

        _hwnd = WindowNative.GetWindowHandle(this);
        var windowId = Win32Interop.GetWindowIdFromWindow(_hwnd);
        _appWindow = AppWindow.GetFromWindowId(windowId);

        _statePath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "OutpostZero",
            "host-state.json"
        );

        ConfigureWindowChromeAndBounds();
        _gpuInfo = NativeInterop.SafeQueryGpuInfo(_hwnd);
        UpdateHardwareLabels();

        Closed += OnWindowClosed;
        Activated += OnWindowActivated;
        _ = InitializeWebViewAsync();
    }

    private void ConfigureWindowChromeAndBounds()
    {
        var state = LoadWindowState();
        _appWindow.Resize(new SizeInt32(Math.Max(1024, state.Width), Math.Max(640, state.Height)));

        if (_appWindow.TitleBar is { } tb && AppWindowTitleBar.IsCustomizationSupported())
        {
            tb.BackgroundColor = ColorHelper.FromArgb(255, 16, 22, 29);
            tb.ForegroundColor = ColorHelper.FromArgb(255, 242, 244, 245);
            tb.InactiveBackgroundColor = ColorHelper.FromArgb(255, 11, 16, 22);
            tb.ButtonBackgroundColor = ColorHelper.FromArgb(255, 16, 22, 29);
            tb.ButtonForegroundColor = ColorHelper.FromArgb(255, 242, 244, 245);
        }

        if (state.Fullscreen)
        {
            SetFullscreen(true);
        }
    }

    private void UpdateHardwareLabels()
    {
        var shortGpu = _gpuInfo.AdapterName.Length > 34
            ? _gpuInfo.AdapterName[..34] + "..."
            : _gpuInfo.AdapterName;
        GpuStatusText.Text = $"{shortGpu} · {_gpuInfo.RefreshRateHz} Hz";
        DiagnosticsDetailText.Text =
            $"{_gpuInfo.AdapterName} | VRAM {_gpuInfo.DedicatedVramMb} MB | Shared {_gpuInfo.SharedMemoryMb} MB | {_gpuInfo.RefreshRateHz} Hz";
    }

    private async System.Threading.Tasks.Task InitializeWebViewAsync()
    {
        await GameWebView.EnsureCoreWebView2Async();
        var core = GameWebView.CoreWebView2;

        core.Settings.AreDefaultContextMenusEnabled = false;
        core.Settings.IsStatusBarEnabled = false;
        core.Settings.IsZoomControlEnabled = false;
        core.Settings.AreBrowserAcceleratorKeysEnabled = true;

        core.WebMessageReceived += OnWebMessageReceived;
        core.ProcessFailed += OnWebViewProcessFailed;

        // Intercept host shortcuts (F9 diagnostics / F11 borderless fullscreen) cleanly at host level
        GameWebView.KeyDown += (_, e) =>
        {
            if (e.Key == Windows.System.VirtualKey.F11)
            {
                SetFullscreen(!_isFullscreen);
                e.Handled = true;
            }
            else if (e.Key == Windows.System.VirtualKey.F9)
            {
                ToggleDiagnosticsStrip();
                e.Handled = true;
            }
        };

        NavigateToGameContent(core);
    }

    private void NavigateToGameContent(CoreWebView2 core)
    {
        var devUrl = Environment.GetEnvironmentVariable("OUTPOST_DEV_URL");
        if (!string.IsNullOrWhiteSpace(devUrl))
        {
            core.Navigate(devUrl.Trim());
            return;
        }

        var distPath = ResolveDistPath();
        core.SetVirtualHostNameToFolderMapping(
            VirtualHostName,
            distPath,
            CoreWebView2HostResourceAccessKind.Allow
        );
        core.Navigate($"https://{VirtualHostName}/index.html");
    }

    private static string ResolveDistPath()
    {
        var baseDir = AppContext.BaseDirectory;
        var bundled = Path.Combine(baseDir, "Assets", "GameDist");
        if (File.Exists(Path.Combine(bundled, "index.html"))) return bundled;

        var repoDist = Path.GetFullPath(Path.Combine(baseDir, "..", "..", "..", "..", "..", "dist"));
        if (File.Exists(Path.Combine(repoDist, "index.html"))) return repoDist;

        return bundled;
    }

    private void OnWebMessageReceived(CoreWebView2 sender, CoreWebView2WebMessageReceivedEventArgs args)
    {
        try
        {
            var raw = args.TryGetWebMessageAsString();
            var node = JsonNode.Parse(raw);
            var type = node?["type"]?.GetValue<string>();
            if (string.IsNullOrEmpty(type)) return;

            switch (type)
            {
                case "host:ready":
                    PostGpuInfoToWeb(sender);
                    break;
                case "host:pointer-capture":
                    var active = node?["active"]?.GetValue<bool>() ?? false;
                    SetPointerCaptureState(active);
                    break;
                case "host:toggle-fullscreen":
                    SetFullscreen(!_isFullscreen);
                    break;
                case "host:toggle-diagnostics":
                    ToggleDiagnosticsStrip();
                    break;
                case "host:exit":
                    Close();
                    break;
            }
        }
        catch
        {
            // Ignore malformed client messages safely
        }
    }

    private void PostGpuInfoToWeb(CoreWebView2 core)
    {
        _gpuInfo = NativeInterop.SafeQueryGpuInfo(_hwnd);
        UpdateHardwareLabels();
        var payload = JsonSerializer.Serialize(new
        {
            type = "native:gpu-info",
            adapterName = _gpuInfo.AdapterName,
            dedicatedVramMb = _gpuInfo.DedicatedVramMb,
            sharedMemoryMb = _gpuInfo.SharedMemoryMb,
            refreshRateHz = _gpuInfo.RefreshRateHz,
        });
        core.PostWebMessageAsJson(payload);
    }

    private void SetPointerCaptureState(bool active)
    {
        _pointerConfined = active;
        NativeInterop.opz_set_cursor_confinement(_hwnd, active ? 1 : 0);
    }

    private void SetFullscreen(bool fullscreen)
    {
        _isFullscreen = fullscreen;
        _appWindow.SetPresenter(fullscreen ? AppWindowPresenterKind.FullScreen : AppWindowPresenterKind.Overlapped);
        NativeTopBar.Visibility = fullscreen ? Visibility.Collapsed : Visibility.Visible;
        if (_pointerConfined)
        {
            NativeInterop.opz_set_cursor_confinement(_hwnd, 1);
        }
    }

    private void ToggleDiagnosticsStrip()
    {
        NativeTopBar.Visibility = Visibility.Visible;
        DiagnosticsStrip.Visibility = DiagnosticsStrip.Visibility == Visibility.Visible
            ? Visibility.Collapsed
            : Visibility.Visible;
    }

    private void OnWebViewProcessFailed(CoreWebView2 sender, CoreWebView2ProcessFailedEventArgs args)
    {
        SetPointerCaptureState(false);
        RecoveryOverlay.Visibility = Visibility.Visible;
    }

    private void OnWindowActivated(object sender, WindowActivatedEventArgs args)
    {
        if (args.WindowActivationState == WindowActivationState.Deactivated && _pointerConfined)
        {
            SetPointerCaptureState(false);
        }
    }

    private void OnReloadClick(object sender, RoutedEventArgs e)
    {
        RecoveryOverlay.Visibility = Visibility.Collapsed;
        if (GameWebView.CoreWebView2 is { } core)
        {
            NavigateToGameContent(core);
        }
    }

    private void OnFullscreenClick(object sender, RoutedEventArgs e)
    {
        SetFullscreen(!_isFullscreen);
    }

    private void OnToggleStatsClick(object sender, RoutedEventArgs e)
    {
        ToggleDiagnosticsStrip();
    }

    private void OnExitClick(object sender, RoutedEventArgs e)
    {
        Close();
    }

    private void OnWindowClosed(object sender, WindowEventArgs args)
    {
        SetPointerCaptureState(false);
        try
        {
            NativeInterop.opz_enable_high_res_timer(0);
        }
        catch
        {
            // Ignore shutdown cleanup errors
        }
        SaveWindowState();
    }

    private HostWindowState LoadWindowState()
    {
        try
        {
            if (File.Exists(_statePath))
            {
                var parsed = JsonSerializer.Deserialize<HostWindowState>(File.ReadAllText(_statePath));
                if (parsed is not null) return parsed;
            }
        }
        catch
        {
            // Fall back to defaults
        }
        return new HostWindowState();
    }

    private void SaveWindowState()
    {
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(_statePath)!);
            var size = _appWindow.Size;
            var state = new HostWindowState
            {
                Width = _isFullscreen ? 1600 : size.Width,
                Height = _isFullscreen ? 900 : size.Height,
                Fullscreen = _isFullscreen,
            };
            File.WriteAllText(_statePath, JsonSerializer.Serialize(state));
        }
        catch
        {
            // Ignore write errors on shutdown
        }
    }
}
