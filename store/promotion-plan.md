# Wave Subs 推广计划与分工

> 更新：2026-09-06。原则：能自动化的渠道全部由我完成并持续跟进；需要你本人账号的渠道，我把文案、图片、字段全部备好，你只做复制粘贴和点击。文案全部在 [launch-posts.md](./launch-posts.md)。

## 一、我已经完成的（不需要你动手）

| 渠道 | 状态 | 链接 / 说明 |
|---|---|---|
| GitHub 仓库信息 | 完成 | 主页改为 wavesubs.com，20 个 topics（subtitles / whisper / srt / ass / local-ai / translation …），英文 README + 中文 README.zh-CN.md，首屏截图 |
| 社交分享卡片 | 完成 | 11 种语言各一张 1280×640，官网各语言页 og:image / Twitter card 指向自己的卡片；`docs/assets/social/` |
| Homebrew（macOS） | 上线 | `brew install --cask jason-jm/wavesubs/wavesubs`，仓库 github.com/jason-jm/homebrew-wavesubs，`brew audit` 通过 |
| Scoop（Windows） | 上线 | `scoop bucket add wavesubs https://github.com/jason-jm/scoop-wavesubs && scoop install wavesubs`，带 autoupdate |
| winget（Windows 官方包管理器） | PR 已提交，等微软机器人验证 | https://github.com/microsoft/winget-pkgs/pull/430387 ，合并后 `winget install JiesiMa.WaveSubs` |
| awesome-mac（3 万+ star 的 Mac 软件清单） | PR 已提交 | https://github.com/jaywcjlove/awesome-mac/pull/2783 （英文与中文 README 都加了） |
| open-source-mac-os-apps（4 万+ star） | PR 已提交 | https://github.com/serhii-londar/open-source-mac-os-apps/pull/1341 |
| electronjs.org/apps 官方展示 | 文件已推到分支，PR 被仓库限制挡住 | 分支已备好：https://github.com/electron/apps/compare/main...jason-jm:apps:add-wave-subs ，我过几天重试；你也可以打开这个链接点一下 Create pull request |
| 官网 SEO | 完成 | 11 种语言 hreflang、sitemap.xml、robots.txt、JSON-LD（SoftwareApplication + FAQPage）、各语言 title/description/keywords |
| 官网「命令行安装」 | 完成 | 下载区显示 brew / scoop 命令 |
| Product Hunt 素材 | 完成 | `store/producthunt/`：画廊图 1270×760 ×5、缩略图 240×240；文案见 launch-posts.md |

## 二、需要你本人做的（按优先级排，每项都注明材料位置）

时间总量估计：第一天约 40 分钟，之后每天 10 分钟回评论。

### 第 1 天（今天/明天）

1. **Google Search Console + Bing Webmaster**（10 分钟，最重要的长期流量来源）
   - https://search.google.com/search-console → 添加资源 → 网域 `wavesubs.com` → 用 DNS TXT 验证（在 Netlify 的 DNS 里加一条 TXT）。验证后提交 sitemap：`https://wavesubs.com/sitemap.xml`。
   - https://www.bing.com/webmasters → 可以直接「从 Google Search Console 导入」，一键。
   - 顺手把旧的 `https://jason-jm.github.io/wavesubs/` 也添加为资源并提交同一份 sitemap（App Store 审核里填的是这个地址）。
2. **GitHub 仓库社交预览图**（1 分钟）：https://github.com/jason-jm/wavesubs/settings → Social preview → Upload → 选 `docs/assets/social/en.jpg`。这样仓库链接在 X / 微信 / Slack 里展开会带图。
3. **Show HN**（5 分钟）：文案在 launch-posts.md「Show HN」。最佳时间：美东工作日早上 8–10 点（北京时间晚上 8–10 点），周二到周四。发完前两小时守着回评论，HN 的排名取决于早期互动。
4. **V2EX 分享创造**（5 分钟）：launch-posts.md「V2EX」。发完回评论。

### 第 2–3 天

5. **Product Hunt**（15 分钟准备 + 发布当天守一天）
   - 需要一个 PH 账号（用 GitHub 登录即可）。Submit → 填 launch-posts.md「Product Hunt」里的名称、tagline、描述、topics；上传 `store/producthunt/thumbnail-240.png` 和 5 张画廊图（按文件名序号）。
   - 发布时间选 **太平洋时间 00:01（北京时间 15:01）**，周二到周四。发布后立刻贴「maker 首评」（文案已备）。
   - 别在发布前到处求赞，PH 会降权。
6. **Reddit**（每个板块 3 分钟，隔天发，别同一天全发）：r/macapps → r/LocalLLaMA → r/opensource → r/DataHoarder。每个板块的文案和标题都单独写了，注意 r/LocalLLaMA 要讲技术细节。发完回评论。
7. **X / Twitter 线程**（5 分钟）：英文线程 5 条 + 中文版；配图用 `docs/assets/social/en.jpg` 和编辑器截图。

### 第 4–7 天（中文社区）

8. **少数派**：投稿到「Matrix」或直接发文章，长文在 launch-posts.md「少数派」（可直接用，也可让编辑改）。
9. **知乎**：回答 3 个已有问题（问题链接和答案模板在文档里），比发文章有效。
10. **小红书**：3 条图文，文案 + 配图建议在文档里；封面用中文社交卡片 `docs/assets/social/zh.jpg`。
11. **B 站**：2 分钟演示视频脚本在文档里。需要你录屏（QuickTime 即可：拖入影片 → 识别 → 翻译 → 编辑器点一行听）。
12. **小众软件 / 异次元 投稿**：邮件模板已备，发到文档里写的投稿邮箱。

### 第 2 周（其它语言，各 3 分钟）

13. 日语 / 韩语 / 德语 / 法语 / 俄语 / 印尼 / 马来 / 越南 / 泰语的短帖文案都在文档末尾，可发 X、Mastodon、各国 Reddit 分区或论坛。日本用户建议再发一篇 Zenn/note 短文（文案已备）。

### 软件目录站（有空再做，每个 3–5 分钟，需要各自注册）

14. AlternativeTo、MacUpdate、Softpedia、OpenAlternative.co、Uneed、SaaSHub：字段（名称、一句话、描述、分类、标签、截图、链接）全在 launch-posts.md「目录站提交字段」，逐个粘贴即可。AlternativeTo 最值得做——搜「subtitle generator alternative」的人都会到那里。

## 三、我会持续做的

- 跟进 4 个 PR 的评论与机器人验证结果，有要求就改；winget 合并后把 `winget install JiesiMa.WaveSubs` 加到官网和 README。
- 每次发新版：自动更新 Homebrew tap、Scoop bucket，提交 winget 新版本 PR。
- 仓库到 **100 star** 后提交 awesome-whisper、awesome-electron（它们的规则要求 ≥100 star、创建满 30 天）；到 **75 star** 后提交 Homebrew 官方 cask（homebrew-cask 的门槛），之后就不需要 tap 了。
- App Store 审核通过后：官网主地址切到 wavesubs.com（canonical / hreflang / sitemap），GitHub Pages 加 CNAME 让旧链接 301。
- 每周看一次 Search Console 的搜索词，据此微调各语言页的 title / description。

## 四、时间表

| 日 | 动作 |
|---|---|
| D0 | Search Console / Bing、GitHub 社交预览、Show HN、V2EX |
| D1 | r/macapps、X 线程 |
| D2 | Product Hunt（周二–四）、r/LocalLLaMA |
| D3 | r/opensource、少数派 |
| D4–7 | 知乎、小红书、B 站、投稿邮件、r/DataHoarder |
| D8–14 | 多语言短帖、目录站 |

## 五、看什么指标

- GitHub star / Release 下载数（`gh release view v1.0.1` 能看每个文件的下载次数）
- Search Console：展示次数与点击的搜索词，尤其「视频生成字幕」「subtitle generator offline」「whisper subtitles mac」
- 官网各语言页的访问比例（Netlify Analytics 是付费的；免费方案是 Search Console 按国家/页面看）
- 评论里反复出现的问题 → 加进官网 FAQ 和 App Store 描述
