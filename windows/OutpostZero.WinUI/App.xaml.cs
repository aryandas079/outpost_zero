using System;
using System.IO;
using Microsoft.UI.Xaml;

namespace OutpostZero.WinUI;

public partial class App : Application
{
    private MainWindow? _window;

    public App()
    {
        InitializeComponent();

        // Configure dedicated GPU WebGL2/WebAudio flags & isolated profile prior to CoreWebView2 bootstrap
        var appDataRoot = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "OutpostZero",
            "WebView2"
        );
        Directory.CreateDirectory(appDataRoot);
        Environment.SetEnvironmentVariable("WEBVIEW2_USER_DATA_FOLDER", appDataRoot);
        Environment.SetEnvironmentVariable(
            "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
            "--enable-gpu-rasterization --ignore-gpu-blocklist --disable-renderer-backgrounding --autoplay-policy=no-user-gesture-required"
        );
    }

    protected override void OnLaunched(LaunchActivatedEventArgs args)
    {
        try
        {
            NativeInterop.opz_enable_high_res_timer(1);
        }
        catch
        {
            // Continue safely if native DLL is not loaded yet
        }

        _window = new MainWindow();
        _window.Activate();
    }
}
