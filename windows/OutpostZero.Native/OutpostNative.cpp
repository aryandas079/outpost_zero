#define OUTPOST_NATIVE_EXPORTS
#include "OutpostNative.h"

#include <dxgi.h>
#include <mmsystem.h>
#include <avrt.h>
#include <cwchar>
#include <algorithm>

#pragma comment(lib, "dxgi.lib")
#pragma comment(lib, "winmm.lib")
#pragma comment(lib, "avrt.lib")
#pragma comment(lib, "user32.lib")

namespace {
HANDLE g_mmcssHandle = nullptr;
bool g_timerPeriodActive = false;

uint32_t QueryPrimaryRefreshRateHz() {
  DEVMODEW mode{};
  mode.dmSize = sizeof(DEVMODEW);
  if (EnumDisplaySettingsW(nullptr, ENUM_CURRENT_SETTINGS, &mode) && mode.dmDisplayFrequency > 1) {
    return static_cast<uint32_t>(mode.dmDisplayFrequency);
  }
  return 60;
}
} // namespace

OPZ_API int32_t opz_query_gpu_info(OpzGpuInfo* outInfo) {
  if (!outInfo) return -1;
  ZeroMemory(outInfo, sizeof(OpzGpuInfo));
  outInfo->refreshRateHz = QueryPrimaryRefreshRateHz();
  wcsncpy_s(outInfo->adapterName, L"DirectX 12 / WebGL2 GPU", _TRUNCATE);

  IDXGIFactory1* factory = nullptr;
  if (FAILED(CreateDXGIFactory1(__uuidof(IDXGIFactory1), reinterpret_cast<void**>(&factory))) || !factory) {
    return 1; // Partial success with display info
  }

  IDXGIAdapter1* bestAdapter = nullptr;
  SIZE_T bestVram = 0;

  for (UINT idx = 0;; ++idx) {
    IDXGIAdapter1* adapter = nullptr;
    if (factory->EnumAdapters1(idx, &adapter) == DXGI_ERROR_NOT_FOUND) break;
    if (!adapter) continue;

    DXGI_ADAPTER_DESC1 desc{};
    if (SUCCEEDED(adapter->GetDesc1(&desc))) {
      const bool isSoftware = (desc.Flags & DXGI_ADAPTER_FLAG_SOFTWARE) != 0;
      if (!isSoftware && (bestAdapter == nullptr || desc.DedicatedVideoMemory > bestVram)) {
        if (bestAdapter) bestAdapter->Release();
        bestAdapter = adapter;
        bestVram = desc.DedicatedVideoMemory;
        adapter = nullptr;
      } else if (!bestAdapter) {
        bestAdapter = adapter;
        bestVram = desc.DedicatedVideoMemory;
        adapter = nullptr;
      }
    }
    if (adapter) adapter->Release();
  }

  if (bestAdapter) {
    DXGI_ADAPTER_DESC1 bestDesc{};
    if (SUCCEEDED(bestAdapter->GetDesc1(&bestDesc))) {
      wcsncpy_s(outInfo->adapterName, bestDesc.Description, _TRUNCATE);
      outInfo->dedicatedVramMb = static_cast<uint32_t>(bestDesc.DedicatedVideoMemory / (1024ULL * 1024ULL));
      outInfo->sharedMemoryMb = static_cast<uint32_t>(bestDesc.SharedSystemMemory / (1024ULL * 1024ULL));
    }
    bestAdapter->Release();
  }

  factory->Release();
  return 0;
}

OPZ_API uint32_t opz_get_display_refresh_hz(HWND hwnd) {
  if (!hwnd || !IsWindow(hwnd)) {
    return QueryPrimaryRefreshRateHz();
  }
  HMONITOR mon = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
  if (!mon) return QueryPrimaryRefreshRateHz();

  MONITORINFOEXW mi{};
  mi.cbSize = sizeof(MONITORINFOEXW);
  if (!GetMonitorInfoW(mon, &mi)) {
    return QueryPrimaryRefreshRateHz();
  }

  DEVMODEW dm{};
  dm.dmSize = sizeof(DEVMODEW);
  if (EnumDisplaySettingsW(mi.szDevice, ENUM_CURRENT_SETTINGS, &dm) && dm.dmDisplayFrequency > 1) {
    return static_cast<uint32_t>(dm.dmDisplayFrequency);
  }
  return QueryPrimaryRefreshRateHz();
}

OPZ_API int32_t opz_set_cursor_confinement(HWND hwnd, int32_t active) {
  if (!active || !hwnd || !IsWindow(hwnd)) {
    ClipCursor(nullptr);
    return 0;
  }

  RECT clientRect{};
  if (!GetClientRect(hwnd, &clientRect)) {
    return -1;
  }

  POINT topLeft{ clientRect.left, clientRect.top };
  POINT bottomRight{ clientRect.right, clientRect.bottom };
  if (!ClientToScreen(hwnd, &topLeft) || !ClientToScreen(hwnd, &bottomRight)) {
    return -2;
  }

  RECT clipRect{
    topLeft.x + 2,
    topLeft.y + 2,
    std::max(topLeft.x + 4L, bottomRight.x - 2),
    std::max(topLeft.y + 4L, bottomRight.y - 2)
  };
  return ClipCursor(&clipRect) ? 0 : -3;
}

OPZ_API int32_t opz_enable_high_res_timer(int32_t enable) {
  if (enable) {
    if (!g_timerPeriodActive) {
      if (timeBeginPeriod(1) == TIMERR_NOERROR) {
        g_timerPeriodActive = true;
      }
    }
    if (!g_mmcssHandle) {
      DWORD taskIndex = 0;
      g_mmcssHandle = AvSetMmThreadCharacteristicsW(L"Games", &taskIndex);
    }
    return 0;
  }

  if (g_mmcssHandle) {
    AvRevertMmThreadCharacteristics(g_mmcssHandle);
    g_mmcssHandle = nullptr;
  }
  if (g_timerPeriodActive) {
    timeEndPeriod(1);
    g_timerPeriodActive = false;
  }
  return 0;
}

OPZ_API uint64_t opz_qpc_now_us() {
  static LARGE_INTEGER freq = [] {
    LARGE_INTEGER f{};
    QueryPerformanceFrequency(&f);
    return f;
  }();
  LARGE_INTEGER counter{};
  QueryPerformanceCounter(&counter);
  if (freq.QuadPart <= 0) return 0;
  return static_cast<uint64_t>((counter.QuadPart * 1000000ULL) / static_cast<uint64_t>(freq.QuadPart));
}
