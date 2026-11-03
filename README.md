# 晚安，温知怀

一个把小说《晚安，温知怀》改成的网页小游戏：54 张手绘分镜、按章节推进的文字、雨声与音效，通关后可以看剧情解析。

## 直接玩

双击 `index.html` 就能打开（纯静态，不需要服务器，不联网也能跑）。

- 空格 / 回车 / → ：下一句
- ← ：上一句
- 点击画面：先补全当前这句，再点击进入下一句
- Esc ：章节目录

## 目录

```
index.html          入口
css/style.css       样式
js/app.js           主流程（幕、打字、存档、结局）
js/audio.js         雨声（按帧切换、交叉淡入）
js/sfx.js           音效（门铃、碗筷、伞、轮子…）
js/music.js         音乐播放器
js/collect.js       物品 / 回忆碎片 / 成就 / 图鉴
js/analysis.js      剧情解析面板
js/flashback.js     结尾回忆快闪
data/story.js       全文分幕（由 游戏设定 解析而来）
data/extras.js      物品、回忆碎片、成就
data/analysis.js    剧情解析文稿
images/             54 张插画 + 房间底图 + memories/ 回忆碎片
audio/              雨声、音效、默认曲目、自选曲目
```

存档存在浏览器 localStorage（`wz.save.v1` / `wz.collect.v1` / `wz.analysis.v1`），换浏览器就要重玩。工具条上的「重置」可以清空进度。

## 部署到 Cloudflare Pages（从 GitHub 拉）

1. 把本文件夹传到 GitHub 仓库（GitHub Desktop 拖进来最快）
2. Cloudflare 控制台 → Workers & Pages → Create → Pages → Connect to Git
3. 选这个仓库，框架预设选 **None**，构建命令留空，输出目录填 `/`
4. Deploy，之后每次 push 会自动重新部署

单文件都在 100MB 以内（最大 13.6MB），可以直接用普通 Git，不需要 LFS。仓库总量约 520MB，第一次 clone 和构建会慢几分钟。

## 改内容

- 改台词：`data/story.js`（也可以改源稿后跑 `tools/build_story_frames.py` 重新生成）
- 换图：把同名的 PNG 放进 `images/`，尺寸保持 16:9（2048×1152）
- 改雨量：`js/audio.js` 里的 `RAIN` 表，按帧给雨型和分贝
- 改结尾快闪节奏：`js/flashback.js` 顶部的 `D0` / `D1` / `CUTS` / `BLACK_HOLD`

## 关于音乐

`audio/music` 是默认播放列表，`audio/custom` 是自选曲目。这些音频只是本地播放用途，公开部署属于公开传播，请自行确认版权，或者把它们从仓库里去掉（去掉后播放器会自动跳过缺失曲目）。
