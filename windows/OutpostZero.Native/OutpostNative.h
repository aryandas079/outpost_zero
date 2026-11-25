#pragma once

#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <cstdint>
#include <windows.h>

#ifdef OUTPOST_NATIVE_EXPORTS
#define OPZ_API extern "C" __declspec(dllexport)
#else
#define OPZ_API extern "C" __declspec(dllimport)
#endif

#pragma pack(push, 8)
struct OpzGpuInfo {
  wchar_t adapterName[128];
  uint32_t dedicatedVramMb;
  uint32_t sharedMemoryMb;
  uint32_t refreshRateHz;
};
#pragma pack(pop)

OPZ_API int32_t opz_query_gpu_info(OpzGpuInfo* outInfo);
OPZ_API uint32_t opz_get_display_refresh_hz(HWND hwnd);
OPZ_API int32_t opz_set_cursor_confinement(HWND hwnd, int32_t active);
OPZ_API int32_t opz_enable_high_res_timer(int32_t enable);
OPZ_API uint64_t opz_qpc_now_us();
