# Mantém o terminal visível sem pausar o Node ao selecionar texto com o mouse.
$ErrorActionPreference = 'Stop'
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class NordenConsoleMode {
    [DllImport("kernel32.dll")] public static extern IntPtr GetStdHandle(int handle);
    [DllImport("kernel32.dll")] public static extern bool GetConsoleMode(IntPtr handle, out uint mode);
    [DllImport("kernel32.dll")] public static extern bool SetConsoleMode(IntPtr handle, uint mode);
}
'@
$nordenInput = [NordenConsoleMode]::GetStdHandle(-10)
[uint32]$nordenMode = 0
if ([NordenConsoleMode]::GetConsoleMode($nordenInput, [ref]$nordenMode)) {
    # ENABLE_EXTENDED_FLAGS ativo; ENABLE_QUICK_EDIT_MODE desativado.
    [void][NordenConsoleMode]::SetConsoleMode($nordenInput, (($nordenMode -bor 0x80) -band (-bnot 0x40)))
}
Set-Location -LiteralPath $PSScriptRoot
& npm.cmd start
