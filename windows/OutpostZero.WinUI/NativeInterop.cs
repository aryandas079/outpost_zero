using System;
using System.Runtime.InteropServices;

namespace OutpostZero.WinUI;

[StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode, Pack = 8)]
internal struct OpzGpuInfo
{
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)]
    public string AdapterName;
    public uint DedicatedVramMb;
    public uint SharedMemoryMb;
    public uint RefreshRateHz;
}

internal static class NativeInterop
{
    private const string DllName = "OutpostZero.Native.dll";

    [DllImport(DllName, CallingConvention = CallingConvention.Cdecl)]
    internal static extern int opz_query_gpu_info(out OpzGpuInfo outInfo);

    [DllImport(DllName, CallingConvention = CallingConvention.Cdecl)]
    internal static extern uint opz_get_display_refresh_hz(IntPtr hwnd);

    [DllImport(DllName, CallingConvention = CallingConvention.Cdecl)]
    internal static extern int opz_set_cursor_confinement(IntPtr hwnd, int active);

    [DllImport(DllName, CallingConvention = CallingConvention.Cdecl)]
    internal static extern int opz_enable_high_res_timer(int enable);

    [DllImport(DllName, CallingConvention = CallingConvention.Cdecl)]
    internal static extern ulong opz_qpc_now_us();

    internal static OpzGpuInfo SafeQueryGpuInfo(IntPtr hwnd)
    {
        try
        {
            opz_query_gpu_info(out var info);
            if (hwnd != IntPtr.Zero)
            {
                var monHz = opz_get_display_refresh_hz(hwnd);
                if (monHz >= 24 && monHz <= 500) info.RefreshRateHz = monHz;
            }
            if (string.IsNullOrWhiteSpace(info.AdapterName))
            {
                info.AdapterName = "Direct3D Hardware GPU";
            }
            return info;
        }
        catch
        {
            return new OpzGpuInfo
            {
                AdapterName = "Direct3D / WebGL2 GPU",
                DedicatedVramMb = 0,
                SharedMemoryMb = 0,
                RefreshRateHz = 60,
            };
        }
    }
}
