Write-Host ">>> 开始使用 Docker 编译 Android APK <<<"
Write-Host "确保 Docker Desktop 正在运行..."

docker run --rm -v "${PWD}/android-app:/home/gradle/project" -w /home/gradle/project gradle:8-jdk17 gradle assembleDebug

if ($LASTEXITCODE -eq 0) {
    Write-Host ">>> 编译成功！ <<<" -ForegroundColor Green
    Write-Host "APK 安装包已生成至路径: .\android-app\app\build\outputs\apk\debug\app-debug.apk" -ForegroundColor Green
} else {
    Write-Host ">>> 编译失败，请检查上面输出的错误日志。 <<<" -ForegroundColor Red
}
