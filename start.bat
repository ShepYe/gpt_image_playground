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
title GPT Image Playground 启动器
cd /d "%~dp0"

echo.
echo ============================================================
echo   GPT Image Playground   一键启动
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
for /f "tokens=1 delims=." %%a in ("!NODE_VER:~1!") do set "NODE_MAJOR=%%a"

if !NODE_MAJOR! LSS 18 (
    echo       [失败] Node.js 版本过低：!NODE_VER!
    echo       本项目需要 Node.js 18 或更高版本，请升级后重试。
    echo.
    pause
    exit /b 1
)
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

REM ==================== 3/4 检查代理配置 ====================
echo.
echo [3/4] 检查开发代理配置

if exist "dev-proxy.config.json" (
    echo       dev-proxy.config.json 已就绪
) else (
    if exist "dev-proxy.config.example.json" (
        copy /y "dev-proxy.config.example.json" "dev-proxy.config.json" >nul
        echo       已根据示例创建 dev-proxy.config.json
        echo       如需调整代理目标，请编辑该文件后重新运行
    ) else (
        echo       未找到 dev-proxy.config.json，本次将不启用本地代理
    )
)

REM ==================== 4/4 检查端口占用 ====================
echo.
echo [4/4] 检查端口 5173

set "PORT_PID="
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /r /c:":5173 .*LISTENING"') do (
    if not defined PORT_PID set "PORT_PID=%%p"
)

if not defined PORT_PID (
    echo       端口 5173 空闲
) else (
    echo.
    echo       [警告] 端口 5173 已被占用（PID !PORT_PID!）
    echo       这通常是上一次没有正常退出的开发服务器。
    echo.
    set "ANSWER="
    set /p "ANSWER=      是否结束该进程并继续？[Y/N] "
    if /i "!ANSWER!"=="Y" (
        taskkill /f /pid !PORT_PID! >nul 2>nul
        if errorlevel 1 (
            echo.
            echo       [失败] 无法结束进程 !PORT_PID!，请手动关闭后重试
            echo.
            pause
            exit /b 1
        )
        echo       已结束进程 !PORT_PID!，端口已释放
    ) else (
        echo.
        echo       已取消启动
        echo.
        pause
        exit /b 1
    )
)

REM ==================== 启动开发服务器 ====================
echo.
echo ============================================================
echo   正在启动开发服务器，浏览器将自动打开...
echo.
echo   访问地址：http://localhost:5173
echo   停止服务：在本窗口按 Ctrl+C
echo ============================================================
echo.

call npm run dev -- --open

echo.
echo ============================================================
echo   开发服务器已停止
echo ============================================================
echo.
pause
