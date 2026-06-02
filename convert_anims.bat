@echo off
set BLENDER="C:\Program Files\Blender Foundation\Blender 5.1\blender.exe"
set SCRIPT=%~dp0strip_skin.py
set ANIM_DIR=%~dp0animations

echo === FBX Skin Strip (Blender headless) ===
echo.

for %%F in ("%ANIM_DIR%\*.fbx") do (
    echo Processing: %%~nxF
    %BLENDER% --background --python "%SCRIPT%" -- "%%F" "%%F.tmp" 2>nul
    if exist "%%F.tmp" (
        move /y "%%F.tmp" "%%F" >nul
        echo   Done: %%~nxF
    ) else (
        echo   Failed: %%~nxF
    )
    echo.
)

echo === Complete ===
pause
