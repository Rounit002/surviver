# Convenience wrapper. Examples:
#   .\render.ps1                                   # preview still, default camera
#   .\render.ps1 -Quality final -Camera hero_front34,side_profile
#   .\render.ps1 -Camera all -Quality draft
#   .\render.ps1 -Anim turntable -Frames 240 -Quality preview
#   .\render.ps1 -NoRender -Glb exports\f1car.glb   # just rebuild the .blend / glTF
param(
    [string]$Quality = "preview",
    [string[]]$Camera = @(),
    [string]$Anim = "",
    [int]$Frames = 240,
    [string]$Parts = "",
    [string]$Glb = "",
    [switch]$NoRender,
    [switch]$Cpu
)
$blender = if ($env:F1_BLENDER) { $env:F1_BLENDER } else { "D:\BlenderL\blender.exe" }
$args_ = @("-b", "--factory-startup", "-P", (Join-Path $PSScriptRoot "build.py"), "--", "--quality", $Quality)
if ($Camera.Count) { $args_ += @("--camera") + $Camera }
if ($Anim) { $args_ += @("--anim", $Anim, "--frames", $Frames) }
if ($Parts) { $args_ += @("--parts", $Parts) }
if ($Glb) { $args_ += @("--glb", $Glb) }
if ($NoRender) { $args_ += "--no-render" }
if ($Cpu) { $args_ += "--cpu" }
& $blender @args_
