#!/bin/bash

# 获取当前时间戳（例如：20260331_200543）
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# 定义压缩包的名称
OUTPUT="simplenotes-${TIMESTAMP}.tar.gz"

echo "开始打包项目文件..."
echo "目标压缩包：${OUTPUT}"

# 确保在执行压缩前 dist 目录存在（避免报错）
# if [ ! -d "dist" ]; then
#     echo "错误：找不到 dist 目录，请先执行 npm run build 进行项目编译！"
#     exit 1
# fi
npm run build

# 执行归档压缩操作
# -c: 建立新的压缩文件
# -z: 使用 gzip 过滤归档
# -v: 详细地列出处理的文件
# -f: 使用归档文件
tar -czvf "${OUTPUT}" \
    dist \
    config \
    package.json \
    package-lock.json \
    Dockerfile \
    docker-entrypoint.sh

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ 打包成功！"
    echo "压缩包位置: $(pwd)/${OUTPUT}"
    echo "您现在可以将此压缩包传输至服务器进行部署。"
else
    echo "❌ 打包失败，请检查文件权限或终端是否支持 tar 环境。"
    exit 1
fi
