@echo off
chcp 65001 >nul
 echo 正在连接知学 AI VPS。连接期间请保留此窗口。
 echo 浏览器地址：http://localhost:18300
ssh -N -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -o IPQoS=none -L 127.0.0.1:18300:127.0.0.1:18180 vps
pause
