# Native SDK COFF reproduction

Minimal Windows Native SDK app with exactly one TypeScript core and one Native markup view:

- `src/core.ts`: bounded counter model and two messages.
- `src/app.native`: binds `count` and dispatches the two messages.
- No backend, FFI, services, frontend, or app-specific native code.
- `app.json` targets Windows only and has one GPU surface.

## Prerequisites

Windows, Bun, Node.js, and Zig must be available. This reproduction was run with Bun 1.4.2, Node.js 24.18.0, Zig 0.16.0, and Native SDK CLI/core 0.10.1. The installed LLVM and MinGW paths used during diagnosis were `C:\Program Files\LLVM\bin` and `C:\Strawberry\c\x86_64-w64-mingw32`.

## Commands

Run from this directory. These invoke the upstream CLI directly; no repository wrapper scripts are involved.

```powershell
bun install --frozen-lockfile
bunx --no-install native version
bunx --no-install native check .
@('{"kind":"increment"}','{"kind":"reset"}') | bunx --no-install native dev . --core
bunx --no-install native test . --yes
bunx --no-install native build . --yes
```

Observed results:

- `bun install --frozen-lockfile`: exit 0; installs `@native-sdk/cli@0.10.1` and `@native-sdk/core@0.10.1` (`10 packages installed`).
- `bunx --no-install native version`: exit 0; `native 0.10.1 (commit 064ca98, automation protocol 0x51f7889bbe3305e7)`.
- `native check .`: exit 0; `checked 1 markup file, app.json and src/core.ts (subset checker clean)` on a fresh tree; after a model contract exists, the wording includes `against the model contract`.
- `native dev . --core`: exit 0; final line `model {"count":0}`.
- Bare `native test . --yes` and `native build . --yes` initially exit 1 because this environment has no `clang` on `PATH`: `spawn clang ENOENT`.

## Two distinct build failures

### 1. Early external-core compiler failure: missing `inttypes.h`

With the real LLVM installation made visible, but without copying or creating headers:

```powershell
$env:Path = "C:\Program Files\LLVM\bin;$env:Path"
bunx --no-install native test . --yes
```

The command exits 1 in ScriptC while compiling the external core runtime. The observed diagnostic is:

```text
fatal error: 'inttypes.h' file not found
```

This is before Native SDK app-object analysis or linking. Adding the installed MinGW include directory through process-local `CPATH`/`C_INCLUDE_PATH` did not make the bare MSVC-targeted `clang` lane valid; the real MinGW headers then produced `expected ';' after top level declarator`. No header was added to this repository and no global compiler setting was changed.

### 2. Later Native linker failure: COFF multiple-object input

`scriptc` supports an explicit Zig-cc lane. With this process-local configuration, Zig supplies its bundled Windows GNU toolchain and the core compile gets past the missing-header stage:

```powershell
$env:SCRIPTC_CC = 'zigcc'
bunx --no-install native test . --yes
bunx --no-install native build . --yes
```

Both commands exit 1 with the exact linker diagnostic:

```text
error: coff does not support linking multiple objects into one
```

For `native test`, the core compile and `native-sdk-coff-repro-model-contract` run succeed before the generated `native-sdk-coff-repro-analysis` object step fails. For `native build`, the failure is at the generated `native-sdk-coff-repro-app-code` object step. This is the reproduced COFF failure, distinct from the earlier `inttypes.h` compiler failure.

Generated `.native`, `.zig-cache`, `zig-out`, and `node_modules` are ignored and are not part of the committed reproduction.

## Complete `native test` capture and interpretation

The exact direct CLI reproduction was:

```powershell
$env:SCRIPTC_CC = 'zigcc'
bunx --no-install native test . --yes
```

ANSI color removed, the complete output was:

```text
test
+- compile obj native-sdk-coff-repro-analysis Debug native failure
error: error: coff does not support linking multiple objects into one

error: process exited with error code 1
failed command: "C:\Users\mynameistito\AppData\Local\Microsoft\WinGet\Packages\zig.zig_Microsoft.Winget.Source_8wekyb3d8bbwe\zig-x86_64-windows-0.16.0\zig.exe" build-obj -fllvm -ODebug --dep app ".native\build\.zig-cache\o\e8cbca2a335e81363bd59f33bdb9117a\app_analysis.zig" ".native\build\.zig-cache\o\fff10f6a4a9c07c62561e26938abf9e8\libnative_sdk_coff_repro_core.a" ".native\build\.zig-cache\o\0db825a5b88570e1f16a4095b5b02425\native-app-markup-data.obj" -ODebug -I ".native\build\.zig-cache\o\2fb5824d4233e9fe32370ab196a5b16d" --dep native_sdk --dep runner --dep app_manifest_zon "-Mapp=.native\build\.zig-cache\o\627de73124621f5124c9223c264d3261\main.zig" -ODebug -I ".native/build\..\..\node_modules\@native-sdk\cli\third_party\sqlite" --dep geometry --dep assets --dep app_dirs --dep trace --dep app_manifest --dep diagnostics --dep platform_info --dep json --dep canvas --dep terminal_vt "-Mnative_sdk=node_modules\@native-sdk\cli\src\root.zig" -ODebug --dep native_sdk --dep build_options --dep app_manifest_zon --dep relational_migrations "-Mrunner=node_modules\@native-sdk\cli\src\app_runner\root.zig" "-Mapp_manifest_zon=.native\build\.zig-cache\o\34ec30cdbfb6ccabec8f40ee33ce3979\app_manifest.zon" -ODebug "-Mgeometry=node_modules\@native-sdk\cli\src\primitives\geometry\root.zig" -ODebug "-Massets=node_modules\@native-sdk\cli\src\primitives\assets\root.zig" -ODebug "-Mapp_dirs=node_modules\@native-sdk\cli\src\primitives\app_dirs\root.zig" -ODebug "-Mtrace=node_modules\@native-sdk\cli\src\primitives\trace\root.zig" -ODebug "-Mapp_manifest=node_modules\@native-sdk\cli\src\primitives\app_manifest\root.zig" -ODebug "-Mdiagnostics=node_modules\@native-sdk\cli\src\primitives\diagnostics\root.zig" -ODebug "-Mplatform_info=node_modules\@native-sdk\cli\src\primitives\platform_info\root.zig" -ODebug "-Mjson=node_modules\@native-sdk\cli\src\primitives\json\root.zig" -ODebug --dep geometry --dep json "-Mcanvas=node_modules\@native-sdk\cli\src\primitives\canvas\root.zig" -ODebug "-Mterminal_vt=node_modules\@native-sdk\cli\src\runtime\terminal_vt_stub.zig" "-Mbuild_options=.native\build\.zig-cache\c\6f26e4ce7b980dc6ab817dadc9f34575\options.zig" -ODebug --dep native_sdk "-Mrelational_migrations=node_modules\@native-sdk\cli\src\app_runner\no_migrations.zig" -lc -fno-emit-bin --cache-dir ".native\build\.zig-cache" --global-cache-dir "C:\Users\mynameistito\AppData\Local\zig" --name native-sdk-coff-repro-analysis --zig-lib-dir "C:\Users\mynameistito\AppData\Local\Microsoft\WinGet\Packages\zig.zig_Microsoft.Winget.Source_8wekyb3d8bbwe\zig-x86_64-windows-0.16.0\lib\" --listen=-

Build Summary: 19/21 steps succeeded (1 failed)
test transitive failure
+- run test success 104ms MaxRSS:11M
|  +- compile test Debug native success 6s MaxRSS:334M
|     +- WriteFile core.zig success
|     |  +- native corewire (compiled-core mirror) success 46ms
|     |     +- compile exe corewire Debug native success 5s MaxRSS:410M
|     |     +- native scriptc core compile success 4s
|     |        +- native stage TypeScript core success 57ms
|     |        |  +- native corewire (core facade + profile) success 70ms
|     |        |  |  +- compile exe corewire Debug native (reused)
|     |        |  |  +- stabilize generated core.contract.json success
|     |        |  |     +- native ts frontend (core + service contracts) success 653ms
|     |        |  +- native corewire (core facade + profile) (+2 more reused dependencies)
|     |        +- stabilize generated core.contract.json (+1 more reused dependencies)
|     +- WriteFile success
|     +- compile obj native-app-markup-data Debug native success 138ms MaxRSS:39M
|     |  +- native embed primary markup data success 648ms
|     +- native scriptc core compile (+2 more reused dependencies)
|     +- compile obj native-app-markup-data Debug native (+1 more reused dependencies)
|     +- WriteFile app_manifest.zon success
|     +- options success
+- compile obj native-sdk-coff-repro-analysis Debug native failure
|  +- WriteFile app_analysis.zig success
|  +- WriteFile core.zig (+1 more reused dependencies)
|  +- WriteFile (reused)
|  +- compile obj native-app-markup-data Debug native (+1 more reused dependencies)
|  +- native scriptc core compile (+2 more reused dependencies)
|  +- compile obj native-app-markup-data Debug native (+1 more reused dependencies)
|  +- WriteFile app_manifest.zon (reused)
|  +- options (reused)
+- run exe native-sdk-coff-repro-model-contract success 63ms
   +- compile exe native-sdk-coff-repro-model-contract Debug native success 6s MaxRSS:334M
      +- WriteFile model_contract_emit.zig success
      +- WriteFile core.zig (+1 more reused dependencies)
      +- WriteFile (reused)
      +- compile obj native-app-markup-data Debug native (+1 more reused dependencies)
      +- native scriptc core compile (+2 more reused dependencies)
      +- compile obj native-app-markup-data Debug native (+1 more reused dependencies)
      +- WriteFile app_manifest.zon (reused)
      +- options (reused)

error: the following build command failed with exit code 1:
.native\build\.zig-cache\o\8724cd1048ec59f014a0062780fc499f\build.exe C:\Users\mynameistito\AppData\Local\Microsoft\WinGet\Packages\zig.zig_Microsoft.Winget.Source_8wekyb3d8bbwe\zig-x86_64-windows-0.16.0\zig.exe C:\Users\mynameistito\AppData\Local\Microsoft\WinGet\Packages\zig.zig_Microsoft.Winget.Source_8wekyb3d8bbwe\zig-x86_64-windows-0.16.0\lib .native/build .native\build\.zig-cache C:\Users\mynameistito\AppData\Local\zig --seed 0x9ba5a26e -Z0dc43a2d8aa745d3 --prefix C:\Users\mynameistito\code\worktrees\native-sdk-coff-repro\zig-out test --summary all
native test: `zig build` step failed (exit code 1)
if the errors above name missing std members, the code may use pre-0.16 Zig idioms - run `native skills get zig` or see https://native-sdk.dev/zig
if generated core wiring exceeds Zig's eval branch quota, do not regenerate the TypeScript contract or add an app-side quota - update or report the SDK-generated scan
```

The first/root failure is the COFF diagnostic on the `native-sdk-coff-repro-analysis` object step. The core compiler, generated contract, markup object, and model-contract executable all succeed; the later `Build Summary`, transitive-failure line, failed `build.exe` invocation, and `native test: zig build step failed` line are consequences. The two final `if ...` lines are generic Native CLI hints and do not describe this failure: there are no missing `std` members, eval-branch-quota diagnostics, `_fltused` errors, or networking/unresolved Windows symbols in this run.

The `failed command` is an expected internal command emitted by `native test`'s generated `zig build`; it is not a command the user is expected to run manually. Its important inputs are `app_analysis.zig`, `libnative_sdk_coff_repro_core.a`, and `native-app-markup-data.obj` passed to one Windows-COFF `zig build-obj` invocation. Zig 0.16 rejects that multiple-object combination. The corrected upstream guidance is to track/fix the Native build graph or Zig COFF path so those inputs are compiled/linked using a COFF-compatible strategy; changing app code, regenerating the TypeScript contract, increasing eval quota, or chasing `_fltused`/network libraries is not a remedy.


