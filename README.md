# 科技热博客 - 生产部署上线完整流程

> 手动上传文件部署，适用于 WinSCP / FileZilla / Xftp 等 SFTP 工具。
> 本文档基于以下部署约定编写：
> - 本地构建后，手动将文件上传到 Linux 服务器 `项目根目录` 目录
> - SSL 证书上传到 `项目根目录ssl/`
> - 服务器使用 Docker Compose 启动 SSR + Nginx 容器
> - Nginx 静态资源与 SSL 证书统一放在容器内 `/usr/local/nginx`，通过 `Dockerfile.nginx` 构建时复制进去（无 volume 挂载）
> - 推荐使用 `deploy.sh` 一键部署脚本自动检查证书并构建启动容器
> - Node.js 运行版本为 22.x LTS

---

## 目录

1. [部署前准备与检查](#一部署前准备与检查)
2. [本地构建](#二本地构建)
3. [准备上传文件](#三准备上传文件)
4. [手动上传文件到服务器](#四手动上传文件到服务器)
5. [服务器部署](#五服务器部署)
6. [验证部署](#六验证部署)
7. [后续更新部署](#七后续更新部署)
8. [常用运维命令](#八常用运维命令)
9. [常见问题排查](#九常见问题排查)
10. [文件用途说明](#十文件用途说明)

---

## 一、部署前准备与检查

### 1.1 本地开发环境检查

部署前，请确保本地开发机满足以下条件：

#### 1.1.1 Node.js 版本

```bash
node -v
# 应输出 v22.12.0 或更高版本，例如 v22.23.2

npm -v
# 应输出 >= 9.6.5
```

**说明**：项目依赖 Astro 7.x，`astro@7.2.0` 的 `engines` 字段要求 `node >=22.12.0`。如果版本过低，`npm install` 或构建时会报错。

如果本地 Node.js 版本不对，请先升级：
- Windows：下载 Node.js 22 LTS 安装包重新安装
- macOS/Linux：使用 nvm 切换
  ```bash
  nvm install 22
  nvm use 22
  ```

#### 1.1.2 npm 镜像源（国内环境）

如果在国内，建议配置 npm 使用国内镜像源，加速依赖安装：

```bash
npm config set registry https://registry.npmmirror.com
```

验证：

```bash
npm config get registry
# 应输出 https://registry.npmmirror.com/
```

#### 1.1.3 Docker 环境（服务器端）

登录服务器，确认 Docker 和 Docker Compose 已安装并可用：

```bash
# 检查 Docker
docker --version
# 示例输出：Docker version 24.0.7, build afdd53b

# 检查 Docker Compose
docker compose version
# 示例输出：Docker Compose version v2.23.0
```

如果未安装，请参考官方文档或对应 Linux 发行版的包管理器安装。

#### 1.1.4 后端服务已就绪

本项目是前端/SSR 层，依赖名为 `blog` 的后端容器。部署前请确认：

- 后端容器 `blog` 已在运行
- `blog` 容器已接入 `selfnet` Docker 网络
- 后端服务监听 `8080` 端口

检查命令：

```bash
# 在服务器上执行
docker ps | grep blog
docker network ls | grep selfnet
```

如果 `selfnet` 网络不存在，后端容器无法被 SSR 访问，需要先创建：

```bash
docker network create selfnet
```

**注意**：`selfnet` 网络是外部网络，由后端服务维护，本项目的 `docker-compose.yml` 不会自动创建它。

---

### 1.2 生产环境配置检查

#### 1.2.1 `.env.production`

打开项目根目录下的 `.env.production`，确认关键配置正确：

```env
PUBLIC_SITE_URL=https://kejir.com
PUBLIC_API_BASE=http://blog:8080/kj
PUBLIC_BUILD_ENV=production
```

**重要说明**：
- `PUBLIC_SITE_URL`：生产站点域名，影响站点地图、SEO、Open Graph 等
- `PUBLIC_API_BASE`：必须是 `http://blog:8080/kj`（Docker 内部网络地址），不能写 `localhost` 或公网域名。此值在构建时内联到代码中，运行时不可修改
- 修改 `.env.production` 后，必须重新执行 `npm run build` 才能生效

#### 1.2.2 SSL 证书准备

准备 SSL 证书文件：

- **本地整理时**：放到项目根目录的 `ssl/` 文件夹下，便于打包上传
- **服务器上**：上传到 `项目根目录ssl/` 目录

```
ssl/
├── kejir.com_bundle.pem   ← SSL 证书文件（含证书链）
└── kejir.com.key          ← SSL 私钥文件
```

**证书要求**：
- 证书文件必须是 PEM 格式
- 如果证书链不完整，部分浏览器/设备会提示证书不受信任
- 私钥文件必须未加密（无密码保护），否则 Nginx 启动时会卡住提示输入密码

如果证书文件名不同，需要同步修改 `nginx-kejir.conf` 中的路径：

```nginx
ssl_certificate     /usr/local/nginx/ssl/你的证书文件名_bundle.pem;
ssl_certificate_key /usr/local/nginx/ssl/你的私钥文件名.key;
```

---

### 1.3 域名与 DNS 检查

确保域名已正确解析到服务器公网 IP：

```bash
nslookup kejir.com
nslookup www.kejir.com
```

如果域名未解析或解析到错误 IP，部署后无法通过域名访问。

---

### 1.4 服务器端口检查

确认服务器防火墙已放行 80 和 443 端口：

```bash
# CentOS / RHEL
sudo firewall-cmd --list-ports
# 应包含 80/tcp 和 443/tcp

# 如果没有，添加
sudo firewall-cmd --permanent --add-port=80/tcp
sudo firewall-cmd --permanent --add-port=443/tcp
sudo firewall-cmd --reload

# Ubuntu / Debian（使用 ufw）
sudo ufw status
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

云服务器还需要在安全组/网络 ACL 中放行 80 和 443。

---

## 二、本地构建

### 2.1 清理旧依赖（可选但推荐）

如果之前依赖安装出现异常，可以先清理：

```bash
# 删除 node_modules 和 lock 文件
rm -rf node_modules package-lock.json

# 重新安装
npm install
```

**注意**：正常更新部署不需要删除 `package-lock.json`，除非明确要解决依赖冲突。

### 2.2 安装依赖

```bash
npm install
```

执行后应无报错。如果报错，请根据错误信息修复环境或依赖问题。

### 2.3 生产构建

```bash
npm run build
```

构建命令已配置为 `astro build --mode production`，会自动加载 `.env.production` 配置。

构建成功后，项目根目录会生成 `dist/` 文件夹，结构如下：

```
dist/
├── server/                  ← SSR 服务端代码
│   ├── entry.mjs            ← SSR 入口文件
│   ├── virtual_astro_middleware.mjs  ← API 代理中间件
│   ├── chunks/              ← 页面分片
│   └── pages/               ← 页面渲染模块
└── client/                  ← 静态资源
    ├── assets/              ← CSS、字体等
    ├── scripts/             ← admin.js 等脚本
    └── favicon.svg
```

### 2.4 验证构建产物

构建完成后，确认以下关键文件存在且非空：

```bash
# SSR 入口
ls -lh dist/server/entry.mjs

# API 代理中间件
ls -lh dist/server/virtual_astro_middleware.mjs

# 后台管理脚本
ls -lh dist/client/scripts/admin.js

# 样式资源
ls -lh dist/client/assets/

# 站点图标
ls -lh dist/client/favicon.svg
```

同时检查中间件版本是否为最新：

```bash
grep -o "X-MW-Version[^\"]*" dist/server/virtual_astro_middleware.mjs
# 应包含 X-MW-Version: stream-duplex
```

如果不是 `stream-duplex`，说明中间件代码未更新到最新，请先 `git pull` 或同步代码后再构建。

---

## 三、准备上传文件

### 3.1 需要上传的完整文件清单

在本地项目根目录整理以下文件/文件夹，准备通过 SFTP 工具上传到服务器 `项目根目录` 目录。

### A. 项目文件（上传到 `项目根目录`）

```
项目根目录/
├── dist/                        ← 整个构建产物目录（必须）
│   ├── client/                  ← 静态资源，会被 Dockerfile.nginx 复制到镜像内 /usr/local/nginx/www
│   └── server/                  ← SSR 服务端代码，会被 Dockerfile 复制到镜像内 /app/dist
├── docker-compose.yml           ← 容器编排配置（必须）
├── Dockerfile                   ← SSR 镜像构建文件（必须）
├── Dockerfile.nginx             ← Nginx 镜像构建文件（必须）
├── deploy.sh                    ← 一键部署脚本（推荐上传，自动检查 SSL 证书并构建）
├── nginx-main.conf              ← Nginx 主配置（必须）
├── nginx-kejir.conf             ← Nginx 站点配置（必须）
├── package.json                 ← 依赖声明（必须，Dockerfile 内 npm ci 需要）
├── package-lock.json            ← 依赖版本锁定（必须，Dockerfile 内 npm ci 需要）
└── .env.production              ← 生产环境变量（建议保留，便于排查）
```

### B. SSL 证书（上传到 `项目根目录ssl/`）

```
项目根目录ssl/
├── kejir.com_bundle.pem         ← SSL 证书文件（含证书链）
└── kejir.com.key                ← SSL 私钥文件
```

### 3.2 各文件详细说明

| 文件/目录 | 是否必须 | 服务器路径 | 说明 |
|-----------|----------|------------|------|
| `dist/` | 是 | `项目根目录dist/` | 构建产物。`dist/server/` 给 SSR 容器使用，`dist/client/` 给 Nginx 容器使用 |
| `docker-compose.yml` | 是 | `项目根目录docker-compose.yml` | 编排 SSR 和 Nginx 容器 |
| `Dockerfile` | 是 | `项目根目录Dockerfile` | SSR 容器镜像构建文件 |
| `Dockerfile.nginx` | 是 | `项目根目录Dockerfile.nginx` | Nginx 容器镜像构建文件，会把静态资源复制到镜像内 `项目根目录`，把 SSL 证书复制到 `/usr/local/nginx/ssl` |
| `deploy.sh` | 推荐 | `项目根目录deploy.sh` | 一键部署脚本，自动检查 SSL 证书并构建启动容器 |
| `nginx-main.conf` | 是 | `项目根目录nginx-main.conf` | Nginx 主配置，会被 Dockerfile.nginx 复制到 /etc/nginx/nginx.conf |
| `nginx-kejir.conf` | 是 | `项目根目录nginx-kejir.conf` | Nginx 站点配置，会被 Dockerfile.nginx 复制到 /etc/nginx/conf.d/default.conf |
| `package.json` | 是 | `项目根目录package.json` | SSR 容器安装生产依赖需要 |
| `package-lock.json` | 是 | `项目根目录package-lock.json` | 锁定依赖版本，Dockerfile 内使用 `npm ci` |
| `.env.production` | 建议 | `项目根目录.env.production` | 构建时环境变量，保留便于排查和后续重建 |
| `ssl/kejir.com_bundle.pem` | 是 | `项目根目录ssl/kejir.com_bundle.pem` | SSL 证书文件，上传到项目目录下的 ssl/ 文件夹 |
| `ssl/kejir.com.key` | 是 | `项目根目录ssl/kejir.com.key` | SSL 私钥文件，上传到项目目录下的 ssl/ 文件夹 |

### 3.3 不需要上传的文件

以下文件/目录**不要**上传到服务器：

- `node_modules/`：体积大，且 Dockerfile 会在构建时重新安装生产依赖
- `.git/`：Git 版本控制目录，与部署无关
- `.env` / `.env.local` / `.env.development`：本地开发环境变量，不应上传到生产环境
- `.vscode/` / `.idea/`：编辑器配置
- `logs/` / `*.log`：日志文件
- `coverage/`：测试覆盖率报告

---

## 四、手动上传文件到服务器

### 4.1 使用 SFTP 工具连接服务器

推荐使用以下工具之一：

- WinSCP（Windows）
- FileZilla（跨平台）
- Xftp（Windows）
- Termius / Transmit（macOS）

连接参数：

| 参数 | 值 |
|------|-----|
| 协议 | SFTP（SSH File Transfer Protocol） |
| 主机名 | 你的服务器公网 IP |
| 端口 | 22（默认 SSH 端口） |
| 用户名 | root 或具有 sudo 权限的用户 |
| 认证方式 | 密码 或 SSH 私钥 |

**安全建议**：
- 优先使用 SSH 密钥认证，避免密码泄露
- 如果使用密码，确保密码复杂度足够
- 部署完成后，可考虑禁用 root 密码登录，改用普通用户 + sudo

### 4.2 在服务器上创建部署目录

通过 SFTP 工具的终端功能，或单独 SSH 登录服务器执行：

```bash
# 创建项目部署目录
mkdir -p 项目根目录

# 查看目录是否创建成功
ls -ld 项目根目录
```

**目录规划**：
- `项目根目录`：项目部署根目录，存放 docker-compose.yml、Dockerfile、构建产物、SSL 证书等
- `项目根目录ssl`：SSL 证书存放目录
- `项目根目录dist`：构建产物存放目录

### 4.3 上传文件

在 SFTP 工具中，将所有文件上传到 `项目根目录` 目录即可。SSL 证书作为项目目录下的 `ssl/` 子目录一并上传。

#### 4.3.1 推荐上传顺序

1. 先上传配置文件到 `项目根目录`：`docker-compose.yml`、`Dockerfile`、`Dockerfile.nginx`、`deploy.sh`、`nginx-main.conf`、`nginx-kejir.conf`、`package.json`、`package-lock.json`、`.env.production`
2. 再上传 SSL 证书到 `项目根目录ssl/`：`kejir.com_bundle.pem`、`kejir.com.key`
3. 最后上传 `dist/` 目录到 `项目根目录`（文件较多，耗时最长）

#### 4.3.2 上传后的服务器目录结构

上传完成后，服务器目录结构应为：

```
/usr/local/nginx/
└── kejir/                       ← 项目部署根目录
    ├── ssl/                     ← SSL 证书目录
    │   ├── kejir.com_bundle.pem
    │   └── kejir.com.key
    ├── dist/                    ← 构建产物
    │   ├── client/              ← 静态资源
    │   │   ├── assets/
    │   │   ├── scripts/
    │   │   └── favicon.svg
    │   └── server/              ← SSR 服务端代码
    │       ├── chunks/
    │       ├── pages/
    │       ├── entry.mjs
    │       └── ...
    ├── docker-compose.yml
    ├── Dockerfile
    ├── Dockerfile.nginx
    ├── deploy.sh                ← 一键部署脚本
    ├── nginx-main.conf
    ├── nginx-kejir.conf
    ├── package.json
    ├── package-lock.json
    └── .env.production
```

#### 4.3.3 上传注意事项

- `dist/` 目录包含大量小文件，上传可能较慢，请耐心等待
- 使用 WinSCP 时，建议开启「自动同步」或「保持目录结构」选项
- `.env.production` 是隐藏文件（以点开头），SFTP 工具中需开启显示隐藏文件
- **SSL 证书上传到 `项目根目录ssl/`，与项目文件一起管理**
- 上传前确认证书文件名与 `nginx-kejir.conf` 中配置的一致
- 如果之前部署过，上传 `dist/` 时选择覆盖旧文件

### 4.4 上传后检查文件完整性

SSH 登录服务器，执行以下检查：

```bash
cd 项目根目录

# 1. 检查所有配置文件是否上传
ls -la docker-compose.yml Dockerfile Dockerfile.nginx deploy.sh nginx-main.conf nginx-kejir.conf package.json package-lock.json .env.production
# 应看到所有文件

# 2. 检查 dist/server 入口文件
ls -la dist/server/entry.mjs

# 3. 检查 dist/client 关键文件
ls -la dist/client/scripts/admin.js
ls -la dist/client/assets/
ls -la dist/client/favicon.svg

# 4. 检查 SSL 证书
ls -la 项目根目录ssl/
# 应看到 kejir.com_bundle.pem 和 kejir.com.key
```

如果有任何文件缺失或大小为 0，请重新上传。

---

## 五、服务器部署

### 5.1 SSH 登录服务器并进入部署目录

```bash
ssh root@你的服务器IP
cd 项目根目录
```

### 5.2 确认后端容器运行状态

```bash
# 确认后端容器 blog 在运行
docker ps | grep blog
# 应看到 blog 容器处于 Up 状态

# 确认 selfnet 网络存在
docker network ls | grep selfnet
# 应看到 selfnet 网络

# 确认后端容器已接入 selfnet 网络
docker network inspect selfnet --format '{{range .Containers}}{{.Name}} {{end}}'
# 输出应包含 blog
```

如果 `selfnet` 网络不存在，创建它：

```bash
docker network create selfnet
```

如果 `blog` 容器未运行或未接入 `selfnet`，请先启动后端服务。

### 5.3 清理旧容器（可选但推荐）

如果是完整重新部署，建议先停止并删除旧容器：

```bash
cd 项目根目录
docker compose down
```

**注意**：
- `docker compose down` 会停止并删除容器，但不会删除镜像
- 旧镜像可以通过 `docker image prune` 清理，但首次部署后不建议立即清理，以便快速回滚

### 5.4 部署方式一：一键部署（推荐）

项目已提供 `deploy.sh` 脚本，会自动完成 SSL 证书检查、容器构建和启动：

```bash
ssh root@你的服务器IP
cd 项目根目录
chmod +x deploy.sh
./deploy.sh
```

脚本会依次执行：
1. 检查项目目录是否存在
2. 检查 Docker / Docker Compose 是否已安装
3. 检查 `selfnet` 网络是否存在（不存在则自动创建）
4. 检查 `项目根目录ssl/` 下证书文件是否齐全
5. 执行 `docker compose up -d --build`
6. 检查容器状态并验证 Nginx 配置

如果脚本报错，请根据提示排查后再重新运行。

### 5.5 部署方式二：手动构建（备选）

如果不使用 `deploy.sh`，确认 SSL 证书已上传到 `项目根目录ssl/` 后，直接构建并启动容器：

```bash
cd 项目根目录
docker compose up -d --build
```

执行后 Docker 会：
1. 构建 SSR 镜像（基于 `Dockerfile`，安装 Node.js 22 依赖，复制 `dist/server`）
2. 构建 Nginx 镜像（基于 `Dockerfile.nginx`，复制静态资源和 SSL 证书到 `/usr/local/nginx`）
3. 创建 `kejir-net` 网络
4. 启动 `kejir-ssr` 和 `kejir-nginx` 容器

首次构建会拉取基础镜像（`node:22-alpine`、`nginx:alpine`），国内已配置镜像加速源，可能需要几分钟，请耐心等待。

### 5.6 查看容器状态

```bash
# 查看两个容器是否都 Up
docker compose ps

# 预期输出示例：
# NAME          STATUS
# kejir-ssr     Up About a minute
# kejir-nginx   Up About a minute
```

如果容器未启动或状态异常，查看日志：

```bash
# 查看所有日志（最近 50 行）
docker compose logs --tail=50

# 单独查看 SSR 日志
docker compose logs -f ssr

# 单独查看 Nginx 日志
docker compose logs -f nginx
```

---

## 六、验证部署

### 6.1 验证容器内目录权限

Nginx 容器内静态资源和 SSL 证书由 `Dockerfile.nginx` 自动设置权限，可执行以下命令确认：

```bash
# 查看 /usr/local/nginx 目录权限
docker exec kejir-nginx ls -la /usr/local/nginx/

# 查看 SSL 目录权限
docker exec kejir-nginx ls -la /usr/local/nginx/ssl/

# 确保证书可被 nginx 用户读取
docker exec kejir-nginx sh -c "su -s /bin/sh nginx -c 'cat /usr/local/nginx/ssl/kejir.com.key'"
```

预期：
- `/usr/local/nginx/www` 属主为 `nginx:nginx`，权限为 `755`
- `/usr/local/nginx/ssl` 属主为 `nginx:nginx`，其他用户无权限
- 证书文件可被 `nginx` 用户读取

### 6.2 验证 Nginx 配置

```bash
docker exec kejir-nginx nginx -t
# 应返回 syntax is ok 和 test is successful
```

### 6.3 验证 HTTP 跳转

```bash
curl -I http://kejir.com
# 应返回 301 Moved Permanently，Location: https://kejir.com/
```

### 6.4 验证 HTTPS 访问

```bash
curl -I https://kejir.com
# 应返回 200 OK
```

### 6.5 验证 API 代理

```bash
# 测试公开 API（通过 SSR middleware 转发到后端）
curl -s https://kejir.com/api/webConfig | head -c 300
# 应返回 JSON 配置信息
```

### 6.6 验证 middleware 版本

```bash
curl -sI https://kejir.com/api/webConfig | grep X-MW-Version
# 应返回 X-MW-Version: stream-duplex
# 如果不是，说明 dist/ 未更新或构建未生效，需重新构建上传
```

## 七、后续更新部署

### 7.1 代码更新后重新部署

如果修改了前端代码、页面、组件、样式或中间件，需要重新构建并全量上传：

1. 本地重新构建：

```bash
npm run build
```

2. 使用 SFTP 工具上传新的 `dist/` 目录到 `项目根目录dist/`（覆盖旧文件）

3. 如果修改了 `Dockerfile`、`Dockerfile.nginx`、`docker-compose.yml` 或 Nginx 配置文件，也一并上传

4. 服务器上重建并重启：

```bash
cd 项目根目录
docker compose up -d --build
```

### 7.2 仅更新 Nginx 配置文件

如果只改了 `nginx-kejir.conf` 或 `nginx-main.conf`：

1. SFTP 上传新的配置文件到 `项目根目录`
2. 重建 Nginx 容器：

```bash
cd 项目根目录
docker compose up -d --build nginx
```

### 7.3 仅更新静态资源（不改 SSR 代码）

由于静态资源已复制到 Nginx 镜像内，更新后需要重新构建 Nginx 镜像：

1. SFTP 上传新的 `dist/client/` 到 `项目根目录dist/client/`（覆盖旧文件）
2. 重建 Nginx 容器：

```bash
cd 项目根目录
docker compose up -d --build nginx
```

**注意**：仅 `docker compose restart nginx` 不会加载新的静态资源，因为资源已内置在镜像中。

### 7.4 更新 SSL 证书

由于 SSL 证书已复制到 Nginx 镜像内，更新后需要重新构建 Nginx 镜像：

1. SFTP 上传新的证书文件到 `项目根目录ssl/`，覆盖旧文件
2. 重新部署（如果已上传 `deploy.sh`，推荐直接运行脚本）：

```bash
cd 项目根目录
./deploy.sh
```

   或手动重建 Nginx 容器：

```bash
cd 项目根目录
docker compose up -d --build nginx
```

3. 验证新证书：

```bash
openssl x509 -in 项目根目录ssl/kejir.com_bundle.pem -noout -dates
docker exec kejir-nginx nginx -t
```

---

## 八、常用运维命令

```bash
# 查看容器状态
docker compose ps

# 实时查看所有日志
docker compose logs -f

# 查看最近 100 行日志
docker compose logs --tail=100

# 重启所有服务
docker compose restart

# 仅重启 SSR
docker compose restart ssr

# 仅重启 Nginx（注意：不会加载镜像内新资源）
docker compose restart nginx

# 停止所有服务
docker compose down

# 启动所有服务
docker compose up -d

# 重建并启动所有服务
docker compose up -d --build

# 测试 Nginx 配置是否正确
docker exec kejir-nginx nginx -t

# 进入 SSR 容器
docker exec -it kejir-ssr sh

# 进入 Nginx 容器
docker exec -it kejir-nginx sh

# 查看 Nginx 容器内静态资源
docker exec kejir-nginx ls -la 项目根目录dist/client

# 查看 Nginx 容器内证书
docker exec kejir-nginx ls -la /usr/local/nginx/ssl
```

---


## 九、文件用途说明

| 文件 | 用途 |
|------|------|
| `docker-compose.yml` | 编排 SSR + Nginx 容器，配置网络。Nginx 静态资源和 SSL 证书已内置镜像，无需 volume 挂载 |
| `Dockerfile` | SSR 镜像：基于 `node:22-alpine`，使用 `npm ci` 安装生产依赖，复制 `dist/server` |
| `Dockerfile.nginx` | Nginx 镜像：复制静态资源到 `项目根目录`、SSL 证书到 `/usr/local/nginx/ssl`，设置 `nginx:nginx` 权限，自定义启动脚本绕过 SELinux。构建时会检查证书是否存在 |
| `deploy.sh` | 一键部署脚本：检查证书、构建并启动容器 |
| `nginx-main.conf` | Nginx 主配置：pid 路径、错误日志路径、gzip 压缩、mime types |
| `nginx-kejir.conf` | Nginx 站点配置：HTTPS、反向代理、静态资源服务、安全头、文件上传大小限制 |
| `package.json` | SSR 容器依赖声明 |
| `package-lock.json` | SSR 容器依赖版本锁定，`npm ci` 使用 |
| `.env.production` | 构建时环境变量（API 地址、站点信息），保留备查 |
| `dist/server/` | SSR 服务端代码（含 middleware） |
| `dist/client/` | 静态资源（CSS/JS/图片/favicon） |
| `ssl/kejir.com_bundle.pem` | SSL 证书文件（含证书链） |
| `ssl/kejir.com.key` | SSL 私钥文件 |

## 十、端口映射

| 端口 | 容器 | 用途 | 对外暴露 |
|------|------|------|----------|
| 80 | kejir-nginx | HTTP（自动 301 跳转到 HTTPS） | 是 |
| 443 | kejir-nginx | HTTPS 主服务 | 是 |
| 4321 | kejir-ssr | SSR 内部端口 | 否（仅 kejir-net 内访问） |
| 8080 | blog | 后端 API | 否（仅 selfnet 内访问） |
