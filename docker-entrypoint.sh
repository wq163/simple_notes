#!/bin/sh
set -e

# 确保数据目录和配置目录存在
mkdir -p /app/data
mkdir -p /app/config

# 如果 config/default.json 不存在（被空卷挂载覆盖），从备份中恢复
if [ ! -f /app/config/default.json ]; then
  echo "⚙️  配置文件不存在，正在从默认配置初始化..."
  cp /app/.default-config/default.json /app/config/default.json
  echo "✅ 已生成 /app/config/default.json"
fi

# 如果以 root 身份运行，将目录所有权交给 node 用户后降权执行
if [ "$(id -u)" = "0" ]; then
  chown -R node:node /app/data /app/config
  exec gosu node "$@"
else
  exec "$@"
fi
