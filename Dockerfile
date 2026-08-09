# ==========================================================================
# 科技热 - Dockerfile（SSR 运行镜像）
# 国内环境已适配：镜像源 + npm 源
# 优化点：npm ci 锁定版本、清理缓存、非 root 运行、层缓存
# ==========================================================================
FROM docker.m.daocloud.io/library/node:22-alpine

WORKDIR /app

# 配置 npm 国内镜像源，加速依赖安装
RUN npm config set registry https://registry.npmmirror.com

# 先复制依赖声明，利用 Docker 层缓存：代码/产物变更时不重新安装依赖
COPY package.json package-lock.json ./

# 使用 npm ci 严格按 lock 安装生产依赖，并清理 npm 缓存减小镜像体积
RUN npm ci --omit=dev --no-audit --no-fund \
    && npm cache clean --force

# 复制预构建的 dist
COPY dist/ ./dist/

# 创建非 root 用户运行 Node.js 服务，提升容器安全性
RUN addgroup -S appgroup && adduser -S appuser -G appgroup \
    && chown -R appuser:appgroup /app
USER appuser

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321

EXPOSE 4321

CMD ["node", "dist/server/entry.mjs"]
