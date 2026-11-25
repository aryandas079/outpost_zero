#include "OutpostNative.h"
#include <cassert>
#include <cstdio>
#include <cwchar>

int main() {
  OpzGpuInfo gpu{};
  const int32_t gpuRc = opz_query_gpu_info(&gpu);
  assert(gpuRc >= 0);
  assert(gpu.refreshRateHz >= 24 && gpu.refreshRateHz <= 500);
  assert(gpu.adapterName[0] != L'\0');

  const uint32_t hz = opz_get_display_refresh_hz(nullptr);
  assert(hz >= 24 && hz <= 500);

  const int32_t timerOnRc = opz_enable_high_res_timer(1);
  assert(timerOnRc == 0);

  const uint64_t t1 = opz_qpc_now_us();
  const uint64_t t2 = opz_qpc_now_us();
  assert(t2 >= t1);

  const int32_t unclipRc = opz_set_cursor_confinement(nullptr, 0);
  assert(unclipRc == 0);

  const int32_t timerOffRc = opz_enable_high_res_timer(0);
  assert(timerOffRc == 0);

  std::wprintf(
    L"[OutpostZero.Native.Tests] PASS | GPU=%ls | VRAM=%u MB | Refresh=%u Hz | QPC_Delta=%llu us\n",
    gpu.adapterName,
    gpu.dedicatedVramMb,
    gpu.refreshRateHz,
    static_cast<unsigned long long>(t2 - t1)
  );
  return 0;
}
