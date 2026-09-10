@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

rem Relaunch under the UTF-8 code page before any non-ASCII line is parsed.
if not defined GP_RELAUNCH (
    set "GP_RELAUNCH=1"
    cmd /c "%~f0" %*
    exit /b !ERRORLEVEL!
)

rem ---------------------------------------------------------------
rem 上面那段必须有：cmd 解析批处理文件时用的是「控制台代码页」，
rem 双击运行时控制台默认是 GBK(936)，会把本文件的 UTF-8 中文字节
rem 解析错位、吞掉部分提示文字。先切到 UTF-8 重启自身一次，
rem 下面的中文才能被完整正确地读取。
rem ---------------------------------------------------------------
title GPT Image Playground 部署器
cd /d "%~dp0"

echo.
echo ============================================================
echo   GPT Image Playground   部署到 Cloudflare Workers
echo ============================================================
echo.
echo   项目目录：%CD%
echo.

REM ==================== 1/4 检查运行环境 ====================
echo [1/4] 检查运行环境

where node >nul 2>nul
if errorlevel 1 (
    echo       [失败] 未检测到 Node.js
    echo.
    echo       请先安装 Node.js 18 或更高版本，然后重新运行本脚本：
    echo       https://nodejs.org/
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set "NODE_VER=%%v"
echo       Node.js !NODE_VER!  [正常]

REM ==================== 2/4 检查项目依赖 ====================
echo.
echo [2/4] 检查项目依赖

if exist "node_modules\" (
    echo       node_modules 已就绪
) else (
    echo       首次运行，正在安装依赖，请稍候（可能需要几分钟）...
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo       [失败] 依赖安装失败
        echo       请检查网络连接，或手动执行：npm install
        echo.
        pause
        exit /b 1
    )
    echo.
    echo       依赖安装完成
)

REM ==================== 3/4 检查 Cloudflare 登录状态 ====================
echo.
echo [3/4] 检查 Cloudflare 登录状态

call npx wrangler whoami >nul 2>&1
if errorlevel 1 (
    echo       [失败] 未登录 Cloudflare，无法部署
    echo.
    echo       请先在本目录执行登录命令，完成浏览器授权后重新运行本脚本：
    echo.
    echo           npx wrangler login
    echo.
    pause
    exit /b 1
)
echo       已登录 Cloudflare  [正常]

REM ==================== 4/4 检查预置配置 ====================
echo.
echo [4/4] 检查预置配置

set "PRESET_URL="
if exist ".env.local" (
    for /f "usebackq tokens=1,* delims==" %%a in (".env.local") do (
        if /i "%%a"=="VITE_DEFAULT_API_URL" set "PRESET_URL=%%b"
    )
)

if defined PRESET_URL (
    echo       VITE_DEFAULT_API_URL = !PRESET_URL!
    echo       该地址将作为预置配置写入构建产物
) else (
    echo       [提示] 未设置 VITE_DEFAULT_API_URL
    echo       部署后的应用不会预置任何 API 配置，用户需手动填写
)
echo.
echo       注意：Cloudflare 不会在部署后改写静态文件，
echo       预置地址必须在构建前确定，如需修改请编辑 .env.local 后重新部署。
echo.
pause

REM ==================== 构建 ====================
echo.
echo ============================================================
echo   正在构建生产版本...
echo ============================================================
echo.

call npm run build
if errorlevel 1 (
    echo.
    echo ============================================================
    echo   [失败] 构建失败，部署已中止
    echo   ^(类型检查或打包出错，请根据上方信息修复后重试^)
    echo ============================================================
    echo.
    pause
    exit /b 1
)

echo.
echo       构建完成

REM ==================== 部署 ====================
echo.
echo ============================================================
echo   正在上传到 Cloudflare Workers...
echo ============================================================
echo.

call npx wrangler deploy
if errorlevel 1 (
    echo.
    echo ============================================================
    echo   [失败] 部署失败
    echo   请根据上方 wrangler 输出的错误信息排查后重试
    echo ============================================================
    echo.
    pause
    exit /b 1
)

echo.
echo ============================================================
echo   部署完成
echo.
echo   访问地址见上方 wrangler 输出中的 triggers 行
echo ============================================================
echo.
pause
