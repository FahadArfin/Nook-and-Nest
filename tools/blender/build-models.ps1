$ErrorActionPreference = "Stop"
$blender = Get-ChildItem "C:\Program Files\Blender Foundation" -Filter blender.exe -Recurse |
  Sort-Object FullName -Descending |
  Select-Object -First 1

if (-not $blender) {
  throw "Blender is not installed."
}

& $blender.FullName --background --python "$PSScriptRoot\build_quality_models.py"
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}
