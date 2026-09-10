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


