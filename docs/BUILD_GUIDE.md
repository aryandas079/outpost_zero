# OUTPOST ZERO — Native Windows C++20 / DirectX 12 Build Guide

## 1. Prerequisites
- Windows 10/11 x64 (`10.0.22621`+ / SDK `10.0.26100.0` verified)
- Visual Studio 2022+ (`MSVC v143+` / tested on VS `18.11.12328.437` + `MSVC 19.51`) with **Desktop development with C++**
- CMake `>= 3.24` (`4.3.1` bundled in VS), Ninja (`1.13.2` bundled in VS), Windows SDK `dxc.exe` (`1.9.2602.17` verified)
- Optional (Phase 2+ vcpkg packages declared in `vcpkg.json`): bundled VS `vcpkg` (`2026-07-27`)

---

## 2. Reproducible Commands

```powershell
# 1. Verify toolchain discovery (vswhere, vcvars64, cmake, ninja, dxc)
powershell -ExecutionPolicy Bypass -File scripts\setup.ps1

# 2. Configure & build Release or Debug (with offline HLSL SM 6.0 compilation)
powershell -ExecutionPolicy Bypass -File scripts\build.ps1 -Configuration Release
powershell -ExecutionPolicy Bypass -File scripts\build.ps1 -Configuration Debug

# 3. Run C++20 & DX12 CTest suite
powershell -ExecutionPolicy Bypass -File scripts\test.ps1 -Configuration Release
powershell -ExecutionPolicy Bypass -File scripts\test.ps1 -Configuration Debug

# 4. Run native DirectX 12 game window interactively
powershell -ExecutionPolicy Bypass -File scripts\run.ps1 -Configuration Release

# 5. Stage standalone portable Windows x64 package (out/package/OutpostZero/)
powershell -ExecutionPolicy Bypass -File scripts\package.ps1 -Configuration Release
```

Optional Phase 2+ vcpkg dependency configure toggle:
```powershell
powershell -ExecutionPolicy Bypass -File scripts\configure.ps1 -Configuration Release -EnableVcpkgDeps
```

---

## 3. Native Executable Runtime CLI Flags (`OutpostZero.exe`)
- `--width <px>` / `--height <px>`: Initial window client dimensions (`640..7680` x `480..4320`)
- `--fullscreen`: Launch in borderless fullscreen (`F11` or `Alt+Enter` toggles live)
- `--no-vsync`: Disable VSync (uses `DXGI_PRESENT_ALLOW_TEARING` when supported)
- `--warp`: Force Microsoft WARP software adapter fallback
- `--d3d-debug` / `--gpu-validation`: Enable D3D12 Debug Layer / GPU-based validation
- `--smoke-frames <N>`: Render `N` frames through the full loop and exit cleanly (`0` = interactive)
- `--capture-bmp <path>`: Perform DX12 GPU backbuffer readback capture to 24-bit BMP
