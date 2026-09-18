## Wave Subs 1.0.7

**翻译画面中的文字（macOS）**
- 转换设置里新增开关（需开启翻译）。用系统自带的文字识别逐秒读画面，把招牌、便签、短信与聊天气泡、告示、文件、标题卡、人物名牌翻译出来，按原文的位置写进 ASS（SRT 放顶部）。不下载任何模型，24 分钟一集多花两三分钟，与语音识别并行
- 译文贴着原文放，尽量不遮挡：贴原文正下方 → 放到原文左右的空处 → 挪到画面顶部 → 盖在原文上，四种排法按顺序试。让位分三轮，两轮都没位置就把字号压小再来一遍——宁可字小，也别盖住原文。只有整屏的邮件、短信、文件才铺一块深色底板把原文换掉
- 底部永远属于对白：同一时刻有对白字幕时，画面文字绝不进入字幕占用的高度，按对白的实际行数让位
- 看得见的每一块都有译文：同屏放得下八条，和对白说的是同一句也照出，实在排不下就压到最小字号也要排出来
- 不该出的不出：片头片尾名单（连片尾「角色名／声優名」那一段一并认出）、片源自带的烧录字幕、电视台台标与频道水印、地图番号与书架书脊这类密集小字、走廊里反复入镜的门牌、被 OCR 读坏的颜文字、以及译文和原文一样的（英文照抄、中日同形、只做了简繁转写的日剧人名字幕）
- 编辑器：语音字幕与画面文字分两个页签，各自增删改；预览里画面文字按排好的位置与字号叠在画面上

**翻译**
- 术语表现在也管画面文字。之前只喂给对白翻译，同一个人名在两条轨道上会对不上；术语表改了，对白与画面文字一起重译
- 同一个专名不再有两种写法。翻译是分批做的，批与批之间没有记忆，一部片里同一个名字会出现「韦伯／威伯」两种写法。收尾按源文里反复出现的专名把译文分组，把少数写法改成多数写法
- 同一个文件跑两遍出同一份字幕：画面文字的判别改成贪心解码加固定随机种子

**其它**
- 自动判断语种更稳：不再只看开头 30 秒（片头音乐会被判成英语，整集识别成英文胡话），改为在人声最密的几处各取 20 秒投票
- 字幕样式统一：画面文字原来是粗体、对白是常规体，同一屏上看着像两种字体，现在统一

**Windows**
- 语音识别不再随包带 OpenBLAS：之前随包的官方 `whisper-blas-bin` 预编译包里的 OpenBLAS 在一部分机器上一加载模型就崩（「whisper-cli 识别失败（退出码 3221225477）」）。换成不带 BLAS 的官方包，常用模型速度不变，装到磁盘上少 51 MB
- 模型页按 Windows 机器判断：CPU 型号按实际读，不再一律写成「这台 Mac：Intel」；适配标签与要求文案不再照搬 Mac 的规则
- 任务失败时可以一键复制完整日志

**已知限制**
- 画面文字目前只在 macOS 上可用（用的是系统文字识别），Windows 版待接系统 OCR
- 名单之外的一串人名仍会被译出来：话剧海报上成排的演员名，以及和制作名单隔了半分钟先单独打出来的主演名。
  前者和纪录片里逐个出现的流程图标签在结构上分不开；后者靠放宽名单的邻接阈值能捞回来，代价是片头社团招牌、片尾正文会被误吃，不划算
- 本地 8B 模型对专有名词不稳（机构名、历史术语会译错或前后不一致）。术语表是可靠的办法
- 片源自己把画面文字的译文烧在画面上时（部分字幕组的做法），会和本程序的译文并存

---

**Translate on-screen text (macOS)**
- A new switch in conversion settings (requires translation to be on). The text recognition built into macOS reads the picture once a second, and signs, notes, text messages and chat bubbles, notices, documents, title cards and lower-third name plates are translated and written into the ASS at the position of the original (SRT places them at the top). No extra model to download; a 24-minute episode takes two to three minutes longer, running alongside speech recognition
- The translation is placed next to the original, covering it only as a last resort: directly below → in the free space to its left or right → at the top of the frame → over the original, tried in that order. Yielding runs in three rounds, and when two rounds find nothing the font is reduced and the search repeats — smaller type is better than hiding the original. Only a full screen of text (an e-mail, a message thread, a document) is replaced with an opaque plate
- The bottom belongs to the dialogue: when a dialogue subtitle is on screen, on-screen text never enters the height it occupies, measured from its actual line count
- Everything visible gets a translation: up to eight at once, kept even when the dialogue says the same thing, and placed at the minimum font size rather than dropped when nothing else fits
- What stays out: opening and closing credits (including the character/voice-actor list at the end), subtitles already burned into the video, TV station logos and watermarks, dense small labels such as map unit markers and book spines, door signs that keep recurring through a film, emoticons garbled by recognition, and translations identical to the original
- Editor: speech subtitles and on-screen text are separate tabs, each editable; the preview overlays on-screen text at its computed position and size

**Translation**
- The glossary now applies to on-screen text as well. It previously reached only the dialogue, so the same personal name could differ between the two tracks; changing the glossary now retranslates both
- One proper noun, one spelling. Translation runs in batches with no memory between them, so a single name could come out two ways in one film. A final pass groups translations by the recurring proper noun in their source and rewrites the minority spelling
- The same file twice gives the same subtitles: on-screen text judging now uses greedy decoding with a fixed seed

**Other**
- Steadier language detection: instead of only the first 30 seconds (where opening music could be read as English and turn a whole episode into English gibberish), five 20-second windows are sampled where speech is densest and vote
- Consistent subtitle styling: on-screen text was bold while dialogue was regular, which read as two different typefaces on the same frame

**Windows**
- Speech recognition no longer ships with OpenBLAS: the bundled official `whisper-blas-bin` build crashed on some machines as soon as the model loaded ("whisper-cli failed (exit code 3221225477)"). Switched to the official non-BLAS build — same speed on the common models, and 51 MB less on disk
- The Models page now judges the actual Windows machine: the CPU model is read as-is instead of always showing "This Mac: Intel", and the fitness tags and requirement lines no longer apply the Mac rules
- A failed task now has a one-click "Copy log" button

**Known limitations**
- On-screen text is macOS only for now (it uses the system text recogniser); the Windows build is waiting on the system OCR
- A run of personal names outside the credit roll still gets translated: rows of actor names on a theatre poster, and lead billing shown half a minute before the staff roll.
  The first is structurally indistinguishable from the diagram labels a documentary reveals one at a time; the second could be caught by widening the credit-run adjacency threshold, at the cost of eating an opening club sign and closing narration
- The local 8B model is unreliable on proper nouns (institution names and historical terms come out wrong or inconsistent). The glossary is the dependable fix
- When a release already burns its own on-screen-text translation into the picture, it will coexist with the one this app produces
