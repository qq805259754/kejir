#!/bin/bash
# ==========================================================================
# 科技热 - 生产环境一键部署脚本
# 作用：检查 SSL 证书并构建/启动 Docker 容器
# 约定：
#   - 项目文件位于 /usr/local/nginx/kejir
#   - SSL 证书位于 /usr/local/nginx/kejir/ssl
#   - Dockerfile.nginx 直接从构建上下文的 ssl/ 目录复制证书到镜像内
# ==========================================================================

set -euo pipefail

# 部署路径
PROJECT_DIR="/usr/local/nginx/kejir"
SSL_DIR="${PROJECT_DIR}/ssl"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 1. 检查项目目录
cd "${PROJECT_DIR}" || {
    log_error "无法进入项目目录 ${PROJECT_DIR}，请确认文件已上传"
    exit 1
}
log_info "项目目录: ${PROJECT_DIR}"

# 2. 检查 Docker 环境
if ! command -v docker &>/dev/null; then
    log_error "未检测到 docker 命令，请先安装 Docker"
    exit 1
fi
if ! docker compose version &>/dev/null && ! docker-compose version &>/dev/null; then
    log_error "未检测到 docker compose，请先安装 Docker Compose"
    exit 1
fi

# 3. 检查后端网络
if ! docker network ls | grep -q selfnet; then
    log_warn "selfnet 网络不存在，尝试创建..."
    docker network create selfnet
fi

# 4. 检查 SSL 证书
if [[ ! -d "${SSL_DIR}" ]]; then
    log_error "SSL 证书目录不存在: ${SSL_DIR}"
    log_error "请通过 SFTP 将证书上传到 ${SSL_DIR} 后再执行部署"
    exit 1
fi

if [[ ! -f "${SSL_DIR}/kejir.com_bundle.pem" || ! -f "${SSL_DIR}/kejir.com.key" ]]; then
    log_error "SSL 证书文件缺失，${SSL_DIR} 下应包含:"
    log_error "  - kejir.com_bundle.pem"
    log_error "  - kejir.com.key"
    exit 1
fi
log_info "SSL 证书已就绪: ${SSL_DIR}"

# 5. 构建并启动容器
log_info "开始构建并启动容器..."
docker compose up -d --build

# 6. 检查容器状态
sleep 2
if docker compose ps | grep -qE "Up|running"; then
    log_info "容器启动成功"
    docker compose ps
else
    log_error "容器可能未正常启动，请查看日志:"
    echo "  docker compose logs --tail=50"
    exit 1
fi

# 7. 验证 Nginx 配置
log_info "验证 Nginx 配置..."
if docker exec kejir-nginx nginx -t &>/dev/null; then
    log_info "Nginx 配置检测通过"
else
    log_warn "Nginx 配置检测未通过，请查看日志排查"
fi

log_info "部署完成"
