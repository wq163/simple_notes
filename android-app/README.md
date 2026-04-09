# Simple Notes Android App

这个模块是 Simple Notes 的官方 Android 原生客户端套壳。它能够完美嵌套您的个人服务端地址，并提供了基础浏览器（甚至 PWA 安装版）所无法实现的原生特性：

*   **真正的文件与图片长传代理**：通过原生 File Chooser 调起系统相册/文件管理器。
*   **下载管理器连接**：附件点击后，调用原生的 `DownloadManager`，将文件安静地下载到“下载中心”。
*   **局域网 IP 突破**：不受现代 Android 强制 HTTPS 的困扰，允许顺畅访问您的本地部署服务器 (如 `http://192.168.x.x:3000`)。
*   **动态地址设置**：长按桌面图标立刻修改绑定的后端地址，或在断网时展示优雅的原生异常状态页。

---

## 🚀 如何自动编译生成 APK

考虑到不需要要求所有人都在电脑上安装巨大的 Android Studio 环境，我们推荐您使用 **Docker** 作为编译环境一键完成构建！

如果您已经安装了 Docker，只需在项目的根目录运行：

### 方法 1：使用提供的 Docker 打包脚本（推荐）
在项目根目录（`simple_notes`目录，而不是这个 `android-app` 目录），我们为您准备了一键编译脚本。

**对于 Windows/Powershell 用户:**
```powershell
# 在根目录运行
docker run --rm -v ${PWD}/android-app:/home/gradle/project -w /home/gradle/project gradle:8-jdk17 gradle assembleDebug
```

**对于 Linux/Mac 用户:**
```bash
docker run --rm -v $(pwd)/android-app:/home/gradle/project -w /home/gradle/project gradle:8.4.0-jdk17 gradle assembleDebug
```

执行完毕后，你的 APK 会生成在：
`android-app/app/build/outputs/apk/debug/app-debug.apk`

您可以直接将此 APK 发送至手机并安装。

### 方法 2：使用 Android Studio 开发调试
1. 下载并安装最新版的 [Android Studio](https://developer.android.com/studio)。
2. 选择 `Open Project`，直接选中本 `android-app` 这个目录。
3. 等待 Gradle Sync 完成后，点击工具栏中的绿色小三角形 🚀 即可在真机或模拟器上运行。

## ⚙️ 首次使用指南

1. 安装好 App 并首次点开，将出现由于“未配置 URL” 所重定向成的设置中心。
2. 填入您的后端 URL，格式如 `http://你的电脑IP:3000` 或 `https://你的域名.com`。
3. 点击“保存”后，系统会自动拉起服务端主页，在之后的启动中也不会提示（它将会像一个纯原生的 App 一样顺畅进入页面）。
4. 如果您的 IP 变更而造成无法打开，系统会捕获网络超时，重新展示“修改服务器地址”的按钮。您也可以选择长按桌面 App 图标进入“设置”。
