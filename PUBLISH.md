# 发布到 GitHub + npm，并让 DSH 能搜到

这份文档把「本地能用的插件」变成「别人能在 DSH 里搜到、点一下装上的插件」。
全程在 Windows PowerShell 里执行，命令都验证过。

---

## 0. 先搞清楚 DSH 是怎么「搜索下载」的

DSH 的 **插件 → Discover** 不查 npm 搜索，它读的是**插件市场索引**：
一份 `format: 1` 的 JSON（本仓库的 `market/index.json`），里面列出包名、版本、
描述、分类、图标，以及「从哪个 npm 包/哪个 Git commit 装」。

所以要让插件「能被搜到」，需要三件事：

1. 包发到 npm（`dsh-plugin-chemdraw`），这样 DSH 能按名字 `inspect` 并 `pnpm add`；
2. 索引 JSON 放到一个 https 地址（GitHub Pages）；
3. 在 DSH 里把该地址加成「索引源」。

三件都做完，Discover 里搜 `chemdraw` / `smiles` / `结构式` 就能直接安装。
只发 npm、不加索引源时，仍然可以用 **添加插件 → 输入包名** 安装，只是不会出现在 Discover 列表里。

---

## 1. 注册并登录 npm（重点是这一步）

### 1.1 注册账号

打开 <https://www.npmjs.com/signup>，填用户名 / 邮箱 / 密码，去邮箱点验证链接。
用户名会出现在包页面上（`npm view` 里的 maintainers），发布时用。

### 1.2 打开两步验证（2FA）

npm 现在对发布操作基本强制 2FA：

1. 登录后右上角头像 → **Account** → **Two-Factor Authentication**；
2. 选 **Authenticator app**，用手机上的验证器（Microsoft Authenticator、1Password、Authy 都行）扫二维码；
3. 保存好 **recovery codes**（丢了只能找 npm 支持）。

之后 `npm publish` 会要一个 6 位动态码（OTP）。

### 1.3 在终端登录

> ⚠️ Windows 上如果直接敲 `npm` 报
> `npm.ps1 cannot be loaded because running scripts is disabled`，
> 说明 PowerShell 执行策略拦了 `npm.ps1`。**改用 `npm.cmd`**，或者执行一次：
> `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`。

```powershell
cd D:\DSworkplace\dsh-chemdraw
npm.cmd login
```

它会：

1. 提示 `Press ENTER to open the login page in your browser` —— 回车；
2. 浏览器打开 npm 授权页，点 **Authorize**（没登录就先登录）；
3. 回到终端，输入验证器里的 6 位 OTP。

登录状态存在 `%USERPROFILE%\.npmrc`，之后不用重复登录。
验证：

```powershell
npm.cmd whoami        # 输出你的 npm 用户名
```

### 1.4 备选：用 Access Token（不弹浏览器，适合 CI）

npm → Account → **Access Tokens** → **Generate New Token** →
选 **Granular Access Token**（或经典的 Automation），勾上 **Read and write**、允许发布
`dsh-plugin-chemdraw`，复制 `npm_...` 开头的串（只显示一次）。

```powershell
npm.cmd config set //registry.npmjs.org/:_authToken=npm_你的token
npm.cmd whoami
```

Token 等于密码，别提交进 git、别写进 README。

---

## 2. 核对仓库地址

本仓库已经指向 `Hilyce/dsh-plugin-chemdraw`（`package.json`、`README.md`、`market/index.json`）。
如果 fork 到别的账号，执行下面这条替换占位符：

```powershell
node scripts/set-owner.mjs 你的GitHub用户名
```

核对：

```powershell
node -e "console.log(require('./package.json').repository.url)"
# 期望：git+https://github.com/Hilyce/dsh-plugin-chemdraw.git
```

---

## 3. 建本地 git 仓库并提交

```powershell
cd D:\DSworkplace\dsh-chemdraw

git init -b main
git config user.name "你的名字"
git config user.email "你的邮箱"        # 建议用 GitHub 的 noreply 邮箱
git add .
git commit -m "feat: dsh-plugin-chemdraw 0.2.1"
```

仓库里包含 `runtime/`（RDKit，约 60 MB，962 个文件），首次 `git add` 和 `push`
会慢一点，正常。`dist/*.zip`、`__pycache__` 已在 `.gitignore` 里排除。

---

## 4. 推到 GitHub

1. 打开 <https://github.com/new>：
   - Repository name：`dsh-plugin-chemdraw`
   - **不要**勾 README / .gitignore / license（本地已经有了）
   - Create repository
2. 关联并推送：

```powershell
git remote add origin https://github.com/Hilyce/dsh-plugin-chemdraw.git
git push -u origin main
```

推送会弹出 Git Credential Manager 窗口：选 **Sign in with your browser**，
登录 GitHub 授权即可。没有弹窗就手动用 PAT：

```powershell
git remote set-url origin https://Hilyce@github.com/Hilyce/dsh-plugin-chemdraw.git
# 密码处粘贴 Personal Access Token（Settings → Developer settings → Tokens，勾 repo）
```

推到一半断网可以直接重跑 `git push -u origin main`，git 会续传已提交的对象。

---

## 5. 发布到 npm

先本地确认打包内容（这一步不联网、不发布）：

```powershell
npm.cmd pack --dry-run
```

应当看到约 **974 个文件 / 25 MB**（其中 `runtime/` 962 个），以及
`cordis.patch.yml`、`index.js`、`client.js`。

然后发布：

```powershell
npm.cmd publish
```

- 第一次发布会问 OTP，输入验证器里的 6 位码；
- 包名 `dsh-plugin-chemdraw` 目前**未被占用**（已确认 404）；
- 发布后 72 小时内可以 `npm unpublish`，之后只能发新版本。

验证：

```powershell
npm.cmd view dsh-plugin-chemdraw version dist.tarball
```

---

## 6. 生成插件市场索引并开 GitHub Pages

```powershell
npm.cmd run market:index
git add market/index.json
git commit -m "chore: update market index"
git push
```

`market:index` 会去 npm 读真实发布时间；读不到就先用当前时间，不影响使用。

开 Pages：

1. 仓库 → **Settings** → **Pages**；
2. Source 选 **Deploy from a branch**，Branch 选 `main`，目录选 **/ (root)**，Save；
3. 等 1～2 分钟，访问：

```
https://Hilyce.github.io/dsh-plugin-chemdraw/market/index.json
```

能看到 JSON 就成功。这个地址就是「索引源」。

> 为什么用 Pages 而不是 `raw.githubusercontent.com`：DSH 拉索引时**拒绝重定向**，
> Pages 直出 200，最稳。索引里的相对图标也会按索引地址解析（本项目图标已内联，不依赖相对路径）。

---

## 7. 在 DSH 里搜到并安装

1. 侧栏 **插件** → **Discover**；
2. 右上 **添加索引源**，粘贴上面的 `.../market/index.json`；
3. 搜索 `chemdraw` / `smiles` / `结构式`，点 **安装**；
4. 安装完点 **立即启用**，然后**完全退出并重启 DeepSeek Harness**；
5. 刷新页面，侧栏「+」里出现 **结构式** 面板。

不想加索引源时，也可以 **插件 → 添加插件** 直接输入：

```
dsh-plugin-chemdraw
```

---

## 8. 以后发新版

```powershell
npm.cmd version patch          # 0.2.1 -> 0.2.2，自动 commit + tag
git push --follow-tags
npm.cmd publish
npm.cmd run market:index       # 索引补上新版本
git add market/index.json; git commit -m "chore: market index 0.2.2"; git push
```

Discover 里点一下刷新就能看到新版本。已安装的插件在 DSH 里是「卸载再装」升级，
或者重启后在插件卡片上更新。

---

## 9. 常见问题

| 现象 | 原因 / 处理 |
|---|---|
| `npm.ps1 cannot be loaded` | PowerShell 执行策略；用 `npm.cmd`，或 `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| `EPERM ... \.npm-cache\_cacache` | 本机那个缓存目录权限坏了；加 `--cache D:\DSworkplace\.tmp\npm-cache` |
| `npm error code ENEEDAUTH` | 没登录，回到第 1.3 节 `npm.cmd login` |
| 发布时一直要 OTP | 正常（2FA 生效）；CI 里改用 Access Token 写进 secret |
| DSH 报 `not-found` | 包名拼错，或 npm 镜像还没同步；换 registry 或等几分钟 |
| Discover 搜不到 | 索引源没加 / Pages 没生效 / 索引里 `versions` 的版本号与 npm 不一致 |
| `git push` 很慢或断开 | `runtime/` 约 60 MB，重跑 `git push` 续传即可 |
| 想减小仓库体积 | 把 `runtime/` 从 git 里排除，改用 Release 附件；但 GitHub Actions 打包就会缺运行时，需自己补 |
| 旧名字 `dsh-chemdraw` 还装着 | 插件页先卸载旧的，再装 `dsh-plugin-chemdraw`，避免两个包抢同一个面板 |

---

## 10. 可选：用 GitHub Actions 自动发布

已有 `.github/workflows/publish.yml`：打 tag 或手动触发时自动 `npm publish`。
启用只需在仓库 **Settings → Secrets and variables → Actions** 里加一个
`NPM_TOKEN`（第 1.4 节的 token）。不想用就把这个文件删掉，手动发布完全一样。
