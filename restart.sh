#!/usr/bin/env bash
# ============================================================
#  观文 · 一键重启前后端服务
#  用法：./restart.sh
#  作用：杀掉旧的后端/Expo 进程 → 用 coze dev 重新启动 → 自检端口
#  说明：沙箱 dev 服务有 1200s(20分钟) 自动退出机制，
#        到点后用本脚本一键拉起即可，无需手动找进程。
# ============================================================
set -u

cd "$(dirname "$0")"

echo "==> 清理旧的后端/Expo 进程..."
pkill -9 -f "server_dev_run.sh" 2>/dev/null
pkill -9 -f "tsx/dist" 2>/dev/null
pkill -9 -f "expo start" 2>/dev/null
sleep 2

echo "==> 用 coze dev 启动服务（后台）..."
# 注意：此处后台部分必须整体用 () 包裹，避免阻塞终端
( coze dev > /tmp/restart.log 2>&1 & )

echo "==> 等待服务就绪（约 30s）..."
sleep 30

# 后端健康检查（最多重试 8 次，每次退避）
for i in $(seq 1 8); do
  H=$(curl -s -m 5 http://localhost:9091/api/v1/health 2>/dev/null)
  if [ -n "$H" ]; then break; fi
  echo "   ...等待后端第 ${i} 次"
  sleep 5
done

# 前端端口检查
FRONT=$(curl -s -m 5 -o /dev/null -w '%{http_code}' http://localhost:5000 2>/dev/null)

echo ""
echo "=============================="
echo "后端 9091 : ${H:-未就绪}"
echo "前端 5000 : HTTP ${FRONT:-未就绪}"
echo "=============================="
if [ -n "${H:-}" ] && [ "$FRONT" = "200" ]; then
  echo "✔ 服务已全部恢复，请刷新界面。"
else
  echo "✘ 仍有端口未就绪，请稍后重试，或查看 /tmp/restart.log。"
  tail -n 20 /tmp/restart.log 2>/dev/null
fi