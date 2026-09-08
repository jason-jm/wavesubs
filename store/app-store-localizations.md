# App Store Connect 多语言文案（11 种商店语言）

> 由 `scripts/build-asc-copy.py` 生成并校验字数；改文案改脚本。截图对应 `store/screenshots/<语言>/`，
> 上传顺序 editor → translate-models → batch → home-done → glossary。在 App Store Connect 版本页右上角语言下拉里「添加语言」逐个添加。
> 营销网址每种语言填官网对应语言页（官网会按浏览器语言自动跳转，直链更稳）；隐私政策目前只有中英两版，其余语言填英文版。

| 商店语言 | 名称 | 副标题 | 关键词字数 | 宣传文本字数 |
|---|---|---|---|---|
| 简体中文 (zh-Hans) | Wave Subs：AI 字幕生成与翻译 | 从影片生成字幕并自动翻译 | 56 | 59 |
| English (U.S.) (en-US) | Wave Subs: AI Subtitle Maker | Auto-translate video subtitles | 91 | 167 |
| 日本語 (ja) | Wave Subs：AI 字幕生成・翻訳 | 動画から字幕を生成し自動翻訳 | 53 | 76 |
| 한국어 (ko) | Wave Subs: AI 자막 생성·번역 | 영상에서 자막 생성, 자동 번역 | 52 | 86 |
| Français (fr-FR) | Wave Subs : sous-titres par IA | Sous-titres auto-traduits | 93 | 165 |
| Deutsch (de-DE) | Wave Subs: KI-Untertitel | Untertitel auto-übersetzt | 95 | 163 |
| Русский (ru) | Wave Subs: субтитры с ИИ | Автоперевод субтитров из видео | 92 | 153 |
| Bahasa Indonesia (id) | Wave Subs: Subtitle AI | Subtitle video diterjemahkan | 95 | 158 |
| Bahasa Melayu (ms) | Wave Subs: Sari Kata AI | Sari kata video, diterjemah | 93 | 154 |
| Tiếng Việt (vi) | Wave Subs: Phụ đề AI | Phụ đề từ video, tự động dịch | 100 | 152 |
| ไทย (th) | Wave Subs: ซับไตเติล AI | ซับจากวิดีโอ แปลอัตโนมัติ | 85 | 114 |

## 简体中文 (zh-Hans)

截图：`store/screenshots/zh-Hans/`
营销网址：`https://jason-jm.github.io/wavesubs/` · 支持网址：`https://github.com/jason-jm/wavesubs/issues` · 隐私政策网址：`https://jason-jm.github.io/wavesubs/privacy.html`

**名称（20/30）：** `Wave Subs：AI 字幕生成与翻译`
**副标题（12/30）：** `从影片生成字幕并自动翻译`
**关键词（56/100）：** `字幕,SRT,ASS,视频字幕,自动字幕,whisper,语音识别,动漫,电影,日语,英语,批量,MKV,编辑器`

**宣传文本（59/170）：**
看片找不到字幕？把影片拖进来：本地 AI 识别对白、生成 SRT/ASS 字幕，并翻译成你的语言。无需联网，永久免费。

**版本说明 1.0.4：** 下载模型先显示「正在连接」，官方源与镜像并行择快；Windows 界面语言跟随系统显示语言；顶部统一窗口栏，Windows 窗口按钮不再压在内容上。

**描述：**
```text
看片找不到字幕？Wave Subs 用本地 AI 直接从影片生成 SRT / ASS 字幕，并自动翻译成你的语言。全部在你自己的 Mac 上完成——无需联网，永久免费。

三步出字幕
• 拖进影片：MKV、MP4、MOV、TS 都行；影片自带的文本字幕轨会被自动发现并直接使用
• 本地 AI 识别并对齐：whisper.cpp 在 Apple Silicon 上用 Metal 加速，自动检测语种；时间轴按真实说话时刻精修，参数用六部整片对照官方字幕校准
• 翻译并导出：导出 SRT 或 ASS，放到影片旁边任何播放器都认；跑完附带质检结论

自动翻译到你的语言
29 种目标语言：中文简繁、英、日、韩、法、德、西、葡、俄、泰、越、印尼、马来等。默认用本地运行的 Qwen3 模型，免费、不联网；也可以接入任何 OpenAI 兼容接口（费用由服务商收取）。术语表让整季的人名前后一致。

字幕编辑器，带视频预览
改文字、调时间、增删合并、撤销、自动保存。点任意一行直接听这句话怎么说的——HEVC、DTS 这类格式也能预览。字幕叠加实时反映修改。

质检报告
每个文件跑完都体检：漏识别的段落、超长条、语速过快、缺译文、译文残留原文，直接告诉你该看哪。

整季批量
把整个文件夹拖进来，全部文件用同一套设置，个别文件可以单独指定字幕轨、音轨或引擎。

不做重复的活
识别结果和译文分层缓存：换个导出格式、换个翻译模型重跑只要几秒；换了模型或术语表则严格重翻，绝不混用旧译文。

为什么坚持本地
在线字幕工具要你上传整部影片、按分钟计费。Wave Subs 没有账号、没有统计、没有服务器，视频从不上传，不限时长。模型下载好之后断网也能用。

系统要求：macOS 12 或更新，Apple Silicon。首次使用会引导下载识别模型（1.6～3 GB）。
```

## English (U.S.) (en-US)

截图：`store/screenshots/en/`
营销网址：`https://jason-jm.github.io/wavesubs/en/` · 支持网址：`https://github.com/jason-jm/wavesubs/issues` · 隐私政策网址：`https://jason-jm.github.io/wavesubs/en/privacy.html`

**名称（28/30）：** `Wave Subs: AI Subtitle Maker`
**副标题（30/30）：** `Auto-translate video subtitles`
**关键词（91/100）：** `srt,ass,captions,transcribe,whisper,offline,local,video,movie,anime,japanese,batch,mkv,free`

**宣传文本（167/170）：**
Can't find subtitles? Drop in a video: local AI recognizes the dialogue, generates SRT/ASS subtitles and translates them into your language. No internet, free forever.

**版本说明 1.0.4：** Downloads now show "Connecting…" and race the official host against the mirror; Windows UI language follows the display-language setting; a unified title bar keeps Windows window buttons clear of the content.

**描述：**
```text
Can't find subtitles for a video? Wave Subs generates SRT / ASS subtitles directly from the video using local AI, then auto-translates them into your language. Everything runs on your own Mac — no internet needed, free forever.

Three steps to subtitles
• Drop in the video: MKV, MP4, MOV, TS — all fine; an embedded text subtitle track is detected and used directly
• Local AI recognizes and aligns: whisper.cpp with Metal acceleration on Apple Silicon, automatic language detection; timing snapped to when lines are actually spoken, tuned against official subtitles of six full films
• Translate and export: SRT or ASS next to the video, readable by any player, with a quality verdict attached

Auto-translated into your language
29 target languages: Chinese (Simplified/Traditional), English, Japanese, Korean, French, German, Spanish, Portuguese, Russian, Thai, Vietnamese, Indonesian, Malay and more. A locally running Qwen3 model by default — free and offline — or any OpenAI-compatible API (billed by the provider). A glossary keeps names consistent across a season.

An editor with video preview
Fix text, adjust timing, insert, delete, merge, undo, autosave. Click any line to hear exactly how it was said — HEVC and DTS preview too. The overlay reflects your edits live.

Quality report
Every file gets a health check: missed passages, overlong lines, unreadable speed, missing or half-done translations — it tells you exactly where to look.

Batch a whole season
Drop in a folder; every file follows the shared settings, and individual files can override the subtitle track, audio track or engine.

Never redo work
Recognition and translation are cached separately: re-export or retry in seconds; change the model or glossary and it retranslates strictly, never mixing old output in.

Why local
Online subtitle tools make you upload the whole film and charge per minute. Wave Subs has no account, no analytics, no server; videos are never uploaded and there is no length limit. Once models are downloaded it works with the network off.

Requires macOS 12 or later on Apple Silicon. On first launch you'll be guided to download a recognition model (1.6–3 GB).
```

## 日本語 (ja)

截图：`store/screenshots/ja/`
营销网址：`https://jason-jm.github.io/wavesubs/ja/` · 支持网址：`https://github.com/jason-jm/wavesubs/issues` · 隐私政策网址：`https://jason-jm.github.io/wavesubs/en/privacy.html`

**名称（20/30）：** `Wave Subs：AI 字幕生成・翻訳`
**副标题（14/30）：** `動画から字幕を生成し自動翻訳`
**关键词（53/100）：** `字幕,SRT,ASS,文字起こし,whisper,音声認識,アニメ,映画,英語,韓国語,一括,MKV,編集`

**宣传文本（76/170）：**
字幕が見つからない？動画をドロップするだけ。ローカルAIがセリフを認識してSRT/ASS字幕を生成し、あなたの言語に翻訳します。ネット不要、ずっと無料。

**版本说明 1.0.4：** ダウンロード開始時に「接続中」を表示し、公式とミラーを並行して速い方を採用。Windows の表示言語に従うよう修正。共通のタイトルバーで Windows のウィンドウボタンがコンテンツに重ならないように。

**描述：**
```text
字幕が見つからない動画、ありませんか？Wave Subs はローカル AI で動画から直接 SRT / ASS 字幕を生成し、あなたの言語に自動翻訳します。すべてあなたの Mac の中で完結——インターネット不要、ずっと無料です。

3 ステップで字幕ができる
• 動画をドロップ：MKV、MP4、MOV、TS に対応。動画に内蔵されたテキスト字幕トラックは自動検出してそのまま利用します
• ローカル AI が認識して合わせる：Apple Silicon の Metal で高速化した whisper.cpp がセリフを認識し、言語を自動判定。タイミングは実際に話している瞬間に合わせて補正（長編 6 作品の公式字幕で校正済み）
• 翻訳して書き出し：SRT または ASS を動画の隣に保存。どのプレーヤーでも読めます。品質チェックの結果付き

あなたの言語に自動翻訳
29 の翻訳先言語：日本語、英語、中国語（簡体・繁体）、韓国語、フランス語、ドイツ語、スペイン語、ポルトガル語、ロシア語、タイ語、ベトナム語、インドネシア語、マレー語など。標準ではローカルで動く Qwen3 モデルを使用——無料でオフライン。OpenAI 互換の API も接続できます（料金は各サービスが請求）。用語集で作品全体の人名を統一。

動画プレビュー付きエディタ
テキスト修正、タイミング調整、追加・削除・結合、取り消し、自動保存。行をクリックすればそのセリフをその場で再生——HEVC や DTS もプレビューできます。字幕の重ね表示は編集を即座に反映。

品質レポート
ファイルごとに健康診断：認識漏れの区間、長すぎる行、速すぎて読めない行、未翻訳・翻訳残りを検出し、確認すべき場所を示します。

シーズンまるごと一括処理
フォルダをドロップすれば全ファイルに同じ設定を適用。個別のファイルだけ字幕トラック・音声トラック・エンジンを変えることもできます。

同じ作業は二度としない
認識結果と翻訳は別々にキャッシュ。書き出し形式を変えたり再実行したりは数秒で完了。モデルや用語集を変えたときは厳密に再翻訳し、古い訳文を混ぜません。

ローカルにこだわる理由
オンラインの字幕ツールは動画全体のアップロードと分単位の課金を求めます。Wave Subs にはアカウントも解析もサーバーもありません。動画は一切送信されず、長さの制限もありません。モデルをダウンロードすれば、オフラインでも動作します。

動作環境：macOS 12 以降、Apple Silicon。初回起動時に音声認識モデル（1.6〜3 GB）のダウンロードを案内します。
```

## 한국어 (ko)

截图：`store/screenshots/ko/`
营销网址：`https://jason-jm.github.io/wavesubs/ko/` · 支持网址：`https://github.com/jason-jm/wavesubs/issues` · 隐私政策网址：`https://jason-jm.github.io/wavesubs/en/privacy.html`

**名称（22/30）：** `Wave Subs: AI 자막 생성·번역`
**副标题（17/30）：** `영상에서 자막 생성, 자동 번역`
**关键词（52/100）：** `자막,SRT,ASS,받아쓰기,whisper,음성인식,애니,영화,일본어,영어,일괄,MKV,편집기`

**宣传文本（86/170）：**
자막을 못 찾겠다면? 영상을 끌어다 놓으세요. 로컬 AI가 대사를 인식해 SRT/ASS 자막을 만들고 내 언어로 번역합니다. 인터넷 불필요, 영원히 무료.

**版本说明 1.0.4：** 다운로드 시 "연결 중" 표시, 공식 서버와 미러를 동시에 시도해 빠른 쪽 사용. Windows 표시 언어를 따르도록 수정. 공통 제목 표시줄로 Windows 창 버튼이 내용과 겹치지 않음.

**描述：**
```text
자막을 찾을 수 없는 영상이 있나요? Wave Subs는 로컬 AI로 영상에서 바로 SRT / ASS 자막을 만들고, 내 언어로 자동 번역합니다. 모든 작업이 내 Mac 안에서 끝납니다 — 인터넷 불필요, 영원히 무료.

세 단계로 자막 완성
• 영상 끌어다 놓기: MKV, MP4, MOV, TS 모두 지원. 영상에 내장된 텍스트 자막 트랙은 자동으로 찾아 바로 사용합니다
• 로컬 AI가 인식하고 맞추기: Apple Silicon의 Metal 가속을 쓰는 whisper.cpp가 대사를 인식하고 언어를 자동 감지. 타이밍은 실제로 말하는 순간에 맞춰 보정(장편 6편의 공식 자막으로 조정)
• 번역하고 내보내기: SRT 또는 ASS를 영상 옆에 저장. 어떤 플레이어에서도 열립니다. 품질 검사 결과 포함

내 언어로 자동 번역
29개 대상 언어: 한국어, 영어, 일본어, 중국어(간체·번체), 프랑스어, 독일어, 스페인어, 포르투갈어, 러시아어, 태국어, 베트남어, 인도네시아어, 말레이어 등. 기본은 로컬에서 실행되는 Qwen3 모델 — 무료, 오프라인. OpenAI 호환 API도 연결할 수 있습니다(요금은 해당 서비스가 청구). 용어집으로 시즌 전체의 인명을 통일.

영상 미리보기가 있는 편집기
텍스트 수정, 타이밍 조정, 추가·삭제·병합, 실행 취소, 자동 저장. 아무 줄이나 클릭하면 그 대사를 바로 들을 수 있습니다 — HEVC, DTS도 미리보기 가능. 자막 오버레이는 편집 내용을 즉시 반영.

품질 리포트
파일마다 점검: 놓친 구간, 너무 긴 줄, 읽기엔 너무 빠른 줄, 번역 누락·잔여 원문을 찾아 어디를 봐야 할지 알려줍니다.

시즌 전체 일괄 처리
폴더를 끌어다 놓으면 모든 파일에 같은 설정이 적용됩니다. 특정 파일만 자막 트랙·오디오 트랙·엔진을 따로 지정할 수 있습니다.

같은 작업은 두 번 하지 않기
인식 결과와 번역을 따로 캐시: 내보내기 형식을 바꾸거나 다시 실행해도 몇 초면 끝. 모델이나 용어집을 바꾸면 엄격하게 다시 번역하며 예전 번역을 섞지 않습니다.

로컬을 고집하는 이유
온라인 자막 도구는 영상 전체 업로드와 분 단위 요금을 요구합니다. Wave Subs에는 계정도, 통계도, 서버도 없습니다. 영상은 절대 업로드되지 않고 길이 제한도 없습니다. 모델을 내려받은 뒤에는 네트워크 없이도 동작합니다.

시스템 요구 사항: macOS 12 이상, Apple Silicon. 첫 실행 시 음성 인식 모델(1.6~3 GB) 다운로드를 안내합니다.
```

## Français (fr-FR)

截图：`store/screenshots/fr/`
营销网址：`https://jason-jm.github.io/wavesubs/fr/` · 支持网址：`https://github.com/jason-jm/wavesubs/issues` · 隐私政策网址：`https://jason-jm.github.io/wavesubs/en/privacy.html`

**名称（30/30）：** `Wave Subs : sous-titres par IA`
**副标题（25/30）：** `Sous-titres auto-traduits`
**关键词（93/100）：** `srt,ass,transcription,whisper,traduction,hors ligne,vidéo,film,anime,japonais,lot,mkv,gratuit`

**宣传文本（165/170）：**
Pas de sous-titres ? Déposez la vidéo : l'IA locale reconnaît les dialogues, crée des SRT/ASS et les traduit dans votre langue. Sans internet, gratuit pour toujours.

**版本说明 1.0.4：** Le téléchargement affiche « Connexion… » et met en concurrence le serveur officiel et le miroir ; la langue suit le réglage d'affichage de Windows ; une barre de titre unifiée évite tout chevauchement des boutons de fenêtre.

**描述：**
```text
Impossible de trouver des sous-titres pour une vidéo ? Wave Subs génère des sous-titres SRT / ASS directement à partir de la vidéo grâce à une IA locale, puis les traduit automatiquement dans votre langue. Tout se passe sur votre Mac — sans internet, gratuit pour toujours.

Des sous-titres en trois étapes
• Déposez la vidéo : MKV, MP4, MOV, TS. Une piste de sous-titres texte intégrée est détectée et utilisée directement
• L'IA locale reconnaît et synchronise : whisper.cpp accéléré par Metal sur Apple Silicon, détection automatique de la langue ; le minutage est calé sur le moment où les répliques sont vraiment prononcées (réglé sur les sous-titres officiels de six longs métrages)
• Traduisez et exportez : SRT ou ASS à côté de la vidéo, lisible par n'importe quel lecteur, avec un verdict de qualité

Traduction automatique dans votre langue
29 langues cibles : français, anglais, chinois (simplifié/traditionnel), japonais, coréen, allemand, espagnol, portugais, russe, thaï, vietnamien, indonésien, malais et plus. Par défaut, un modèle Qwen3 local — gratuit et hors ligne — ou n'importe quelle API compatible OpenAI (facturée par le fournisseur). Un glossaire garde les noms cohérents sur toute une saison.

Un éditeur avec aperçu vidéo
Corrigez le texte, ajustez le minutage, insérez, supprimez, fusionnez, annulez, sauvegarde automatique. Cliquez sur une ligne pour entendre exactement comment elle a été dite — l'aperçu fonctionne aussi en HEVC et DTS. L'incrustation reflète vos modifications en direct.

Rapport de qualité
Chaque fichier passe un bilan : passages manqués, lignes trop longues, vitesse illisible, traductions manquantes ou incomplètes — vous savez exactement où regarder.

Une saison entière en lot
Déposez un dossier ; tous les fichiers suivent les mêmes réglages, et chaque fichier peut avoir sa propre piste de sous-titres, piste audio ou moteur.

Ne jamais refaire le travail
Reconnaissance et traduction sont mises en cache séparément : réexporter ou relancer prend quelques secondes ; changer de modèle ou de glossaire retraduit strictement, sans jamais mélanger l'ancien résultat.

Pourquoi le local
Les outils en ligne exigent d'envoyer tout le film et facturent à la minute. Wave Subs n'a ni compte, ni statistiques, ni serveur ; les vidéos ne sont jamais envoyées et il n'y a pas de limite de durée. Une fois les modèles téléchargés, tout fonctionne sans réseau.

Nécessite macOS 12 ou ultérieur sur Apple Silicon. Au premier lancement, un modèle de reconnaissance (1,6 à 3 Go) vous sera proposé au téléchargement.
```

## Deutsch (de-DE)

截图：`store/screenshots/de/`
营销网址：`https://jason-jm.github.io/wavesubs/de/` · 支持网址：`https://github.com/jason-jm/wavesubs/issues` · 隐私政策网址：`https://jason-jm.github.io/wavesubs/en/privacy.html`

**名称（24/30）：** `Wave Subs: KI-Untertitel`
**副标题（25/30）：** `Untertitel auto-übersetzt`
**关键词（95/100）：** `untertitel,srt,ass,transkription,whisper,übersetzung,offline,video,film,anime,stapel,mkv,gratis`

**宣传文本（163/170）：**
Keine Untertitel? Video ablegen: Lokale KI erkennt die Dialoge, erstellt SRT/ASS-Untertitel und übersetzt sie in deine Sprache. Ohne Internet, für immer kostenlos.

**版本说明 1.0.4：** Downloads zeigen „Verbindung…“ und lassen offiziellen Host und Spiegel gegeneinander antreten; die Sprache folgt der Windows-Anzeigesprache; eine einheitliche Titelleiste hält die Fensterknöpfe vom Inhalt fern.

**描述：**
```text
Keine Untertitel für ein Video gefunden? Wave Subs erstellt SRT / ASS-Untertitel direkt aus dem Video mit lokaler KI und übersetzt sie automatisch in deine Sprache. Alles läuft auf deinem eigenen Mac — ohne Internet, für immer kostenlos.

In drei Schritten zu Untertiteln
• Video ablegen: MKV, MP4, MOV, TS. Eine eingebettete Text-Untertitelspur wird erkannt und direkt verwendet
• Lokale KI erkennt und synchronisiert: whisper.cpp mit Metal-Beschleunigung auf Apple Silicon, automatische Spracherkennung; das Timing wird auf den tatsächlichen Sprechzeitpunkt gesetzt (abgestimmt an offiziellen Untertiteln von sechs Spielfilmen)
• Übersetzen und exportieren: SRT oder ASS neben dem Video, von jedem Player lesbar, mit Qualitätsurteil

Automatisch in deine Sprache übersetzt
29 Zielsprachen: Deutsch, Englisch, Chinesisch (vereinfacht/traditionell), Japanisch, Koreanisch, Französisch, Spanisch, Portugiesisch, Russisch, Thai, Vietnamesisch, Indonesisch, Malaiisch und mehr. Standardmäßig ein lokal laufendes Qwen3-Modell — kostenlos und offline — oder jede OpenAI-kompatible API (Abrechnung durch den Anbieter). Ein Glossar hält Namen über eine ganze Staffel konsistent.

Ein Editor mit Videovorschau
Text korrigieren, Timing anpassen, einfügen, löschen, zusammenführen, rückgängig machen, automatisches Speichern. Klicke eine Zeile an und höre genau, wie sie gesprochen wurde — auch HEVC und DTS lassen sich vorschauen. Die Einblendung zeigt deine Änderungen sofort.

Qualitätsbericht
Jede Datei bekommt einen Check: verpasste Passagen, zu lange Zeilen, unlesbares Tempo, fehlende oder halbe Übersetzungen — du siehst genau, wo du hinschauen musst.

Eine ganze Staffel im Stapel
Ordner ablegen; alle Dateien folgen denselben Einstellungen, einzelne Dateien können Untertitelspur, Tonspur oder Engine überschreiben.

Nie doppelte Arbeit
Erkennung und Übersetzung werden getrennt zwischengespeichert: erneut exportieren oder wiederholen dauert Sekunden; bei neuem Modell oder Glossar wird strikt neu übersetzt, alte Ergebnisse werden nie vermischt.

Warum lokal
Online-Tools verlangen den Upload des ganzen Films und rechnen pro Minute ab. Wave Subs hat kein Konto, keine Statistik, keinen Server; Videos werden nie hochgeladen, es gibt keine Längenbegrenzung. Sobald die Modelle geladen sind, funktioniert alles auch ohne Netz.

Benötigt macOS 12 oder neuer auf Apple Silicon. Beim ersten Start wirst du durch den Download eines Erkennungsmodells (1,6–3 GB) geführt.
```

## Русский (ru)

截图：`store/screenshots/ru/`
营销网址：`https://jason-jm.github.io/wavesubs/ru/` · 支持网址：`https://github.com/jason-jm/wavesubs/issues` · 隐私政策网址：`https://jason-jm.github.io/wavesubs/en/privacy.html`

**名称（24/30）：** `Wave Subs: субтитры с ИИ`
**副标题（30/30）：** `Автоперевод субтитров из видео`
**关键词（92/100）：** `субтитры,srt,ass,транскрипция,whisper,перевод,видео,фильм,аниме,японский,пакет,mkv,бесплатно`

**宣传文本（153/170）：**
Нет субтитров? Перетащите видео: локальный ИИ распознает диалоги, создаст субтитры SRT/ASS и переведёт их на ваш язык. Без интернета, бесплатно навсегда.

**版本说明 1.0.4：** При загрузке показывается «Подключение…», официальный хост и зеркало пробуются параллельно; язык следует настройке отображения Windows; единая строка заголовка убирает кнопки окна с контента.

**描述：**
```text
Не нашли субтитры к видео? Wave Subs создаёт субтитры SRT / ASS прямо из видео с помощью локального ИИ и автоматически переводит их на ваш язык. Всё происходит на вашем Mac — без интернета, бесплатно навсегда.

Субтитры за три шага
• Перетащите видео: MKV, MP4, MOV, TS. Встроенная текстовая дорожка субтитров обнаруживается и используется напрямую
• Локальный ИИ распознаёт и выравнивает: whisper.cpp с ускорением Metal на Apple Silicon, автоматическое определение языка; тайминг подгоняется к моменту реальной речи (настроен по официальным субтитрам шести полнометражных фильмов)
• Переведите и экспортируйте: SRT или ASS рядом с видео, читается любым плеером, с оценкой качества

Автоматический перевод на ваш язык
29 языков: русский, английский, китайский (упрощённый/традиционный), японский, корейский, французский, немецкий, испанский, португальский, тайский, вьетнамский, индонезийский, малайский и другие. По умолчанию — локальная модель Qwen3, бесплатно и офлайн; можно подключить любой OpenAI-совместимый API (оплата провайдеру). Глоссарий сохраняет единообразие имён на протяжении всего сезона.

Редактор с видеопревью
Правьте текст, тайминг, вставляйте, удаляйте, объединяйте, отменяйте, автосохранение. Нажмите на строку, чтобы услышать, как именно она произнесена — HEVC и DTS тоже воспроизводятся. Наложение субтитров сразу отражает правки.

Отчёт о качестве
Каждый файл проходит проверку: пропущенные фрагменты, слишком длинные строки, нечитаемая скорость, отсутствующие или недоделанные переводы — вы точно знаете, куда смотреть.

Целый сезон пакетом
Перетащите папку; все файлы используют общие настройки, а для отдельных можно задать свою дорожку субтитров, звуковую дорожку или движок.

Никакой повторной работы
Распознавание и перевод кешируются отдельно: повторный экспорт или перезапуск занимают секунды; смена модели или глоссария приводит к строгому повторному переводу без смешивания старого результата.

Почему локально
Онлайн-сервисы требуют загрузить весь фильм и берут плату поминутно. У Wave Subs нет аккаунтов, аналитики и серверов; видео никогда не загружается, ограничений по длительности нет. После загрузки моделей всё работает без сети.

Требуется macOS 12 или новее на Apple Silicon. При первом запуске будет предложено скачать модель распознавания (1,6–3 ГБ).
```

## Bahasa Indonesia (id)

截图：`store/screenshots/id/`
营销网址：`https://jason-jm.github.io/wavesubs/id/` · 支持网址：`https://github.com/jason-jm/wavesubs/issues` · 隐私政策网址：`https://jason-jm.github.io/wavesubs/en/privacy.html`

**名称（22/30）：** `Wave Subs: Subtitle AI`
**副标题（28/30）：** `Subtitle video diterjemahkan`
**关键词（95/100）：** `subtitle,srt,ass,transkripsi,whisper,terjemahan,video,film,anime,jepang,batch,mkv,gratis,editor`

**宣传文本（158/170）：**
Tak ada subtitle? Seret videonya: AI lokal mengenali dialog, membuat subtitle SRT/ASS, lalu menerjemahkannya ke bahasa Anda. Tanpa internet, gratis selamanya.

**版本说明 1.0.4：** Unduhan menampilkan "Menghubungkan…" dan mengadu host resmi dengan cermin; bahasa mengikuti bahasa tampilan Windows; bilah judul terpadu menjauhkan tombol jendela dari konten.

**描述：**
```text
Tak menemukan subtitle untuk sebuah video? Wave Subs membuat subtitle SRT / ASS langsung dari video dengan AI lokal, lalu menerjemahkannya otomatis ke bahasa Anda. Semuanya berjalan di Mac Anda sendiri — tanpa internet, gratis selamanya.

Tiga langkah menuju subtitle
• Seret video: MKV, MP4, MOV, TS. Trek subtitle teks yang tertanam akan terdeteksi dan langsung dipakai
• AI lokal mengenali dan menyelaraskan: whisper.cpp dengan akselerasi Metal di Apple Silicon, deteksi bahasa otomatis; waktu disesuaikan ke saat kalimat benar-benar diucapkan (dikalibrasi dengan subtitle resmi enam film panjang)
• Terjemahkan dan ekspor: SRT atau ASS di samping video, terbaca oleh pemutar apa pun, disertai penilaian kualitas

Diterjemahkan otomatis ke bahasa Anda
29 bahasa target: Indonesia, Inggris, Mandarin (sederhana/tradisional), Jepang, Korea, Prancis, Jerman, Spanyol, Portugis, Rusia, Thai, Vietnam, Melayu, dan lainnya. Secara bawaan memakai model Qwen3 lokal — gratis dan offline — atau API apa pun yang kompatibel dengan OpenAI (ditagih oleh penyedia). Glosarium menjaga nama tetap konsisten sepanjang musim.

Editor dengan pratinjau video
Perbaiki teks, atur waktu, sisipkan, hapus, gabungkan, urungkan, simpan otomatis. Klik baris mana pun untuk mendengar persis bagaimana kalimat itu diucapkan — HEVC dan DTS pun bisa dipratinjau. Lapisan subtitle langsung mencerminkan suntingan Anda.

Laporan kualitas
Setiap berkas diperiksa: bagian yang terlewat, baris terlalu panjang, kecepatan tak terbaca, terjemahan hilang atau setengah jadi — Anda tahu persis di mana harus melihat.

Satu musim sekaligus
Seret satu folder; semua berkas mengikuti pengaturan yang sama, dan berkas tertentu bisa memakai trek subtitle, trek audio, atau mesin yang berbeda.

Tidak pernah mengulang kerja
Hasil pengenalan dan terjemahan di-cache terpisah: ekspor ulang atau coba lagi hanya beberapa detik; mengganti model atau glosarium akan menerjemahkan ulang secara ketat tanpa mencampur hasil lama.

Mengapa lokal
Alat subtitle online meminta Anda mengunggah seluruh film dan menagih per menit. Wave Subs tanpa akun, tanpa analitik, tanpa server; video tak pernah diunggah dan tak ada batas durasi. Setelah model diunduh, semuanya bekerja tanpa jaringan.

Memerlukan macOS 12 atau lebih baru di Apple Silicon. Saat pertama dibuka Anda akan dipandu mengunduh model pengenalan (1,6–3 GB).
```

## Bahasa Melayu (ms)

截图：`store/screenshots/ms/`
营销网址：`https://jason-jm.github.io/wavesubs/ms/` · 支持网址：`https://github.com/jason-jm/wavesubs/issues` · 隐私政策网址：`https://jason-jm.github.io/wavesubs/en/privacy.html`

**名称（23/30）：** `Wave Subs: Sari Kata AI`
**副标题（27/30）：** `Sari kata video, diterjemah`
**关键词（93/100）：** `sari kata,srt,ass,transkripsi,whisper,terjemahan,video,filem,anime,jepun,kelompok,mkv,percuma`

**宣传文本（154/170）：**
Tiada sari kata? Seret video: AI tempatan mengecam dialog, menjana sari kata SRT/ASS dan menterjemahnya ke bahasa anda. Tanpa internet, percuma selamanya.

**版本说明 1.0.4：** Muat turun memaparkan "Menyambung…" dan mengadu hos rasmi dengan cermin; bahasa mengikut bahasa paparan Windows; bar tajuk seragam mengelakkan butang tetingkap menindih kandungan.

**描述：**
```text
Tidak jumpa sari kata untuk sesuatu video? Wave Subs menjana sari kata SRT / ASS terus daripada video dengan AI tempatan, kemudian menterjemahnya secara automatik ke bahasa anda. Semuanya berjalan pada Mac anda sendiri — tanpa internet, percuma selamanya.

Tiga langkah ke sari kata
• Seret video: MKV, MP4, MOV, TS. Trek sari kata teks terbenam dikesan dan digunakan terus
• AI tempatan mengecam dan menjajarkan: whisper.cpp dengan pecutan Metal pada Apple Silicon, pengesanan bahasa automatik; masa diselaraskan dengan saat dialog benar-benar dituturkan (ditala dengan sari kata rasmi enam filem penuh)
• Terjemah dan eksport: SRT atau ASS di sebelah video, boleh dibaca mana-mana pemain, disertakan penilaian kualiti

Diterjemah secara automatik ke bahasa anda
29 bahasa sasaran: Melayu, Inggeris, Cina (ringkas/tradisional), Jepun, Korea, Perancis, Jerman, Sepanyol, Portugis, Rusia, Thai, Vietnam, Indonesia dan banyak lagi. Secara lalai menggunakan model Qwen3 tempatan — percuma dan luar talian — atau mana-mana API serasi OpenAI (dicaj oleh penyedia). Glosari memastikan nama konsisten sepanjang musim.

Editor dengan pratonton video
Betulkan teks, laraskan masa, sisip, padam, gabung, buat asal, simpan automatik. Klik mana-mana baris untuk mendengar bagaimana ia dituturkan — HEVC dan DTS juga boleh dipratonton. Tindanan sari kata mencerminkan suntingan anda serta-merta.

Laporan kualiti
Setiap fail diperiksa: bahagian tertinggal, baris terlalu panjang, kelajuan tidak boleh dibaca, terjemahan hilang atau separuh siap — anda tahu tepat di mana perlu dilihat.

Satu musim sekali gus
Seret satu folder; semua fail mengikut tetapan yang sama, dan fail tertentu boleh mengatasi trek sari kata, trek audio atau enjin.

Tidak pernah mengulang kerja
Pengecaman dan terjemahan dicache berasingan: eksport semula atau cuba lagi hanya beberapa saat; menukar model atau glosari menterjemah semula dengan ketat tanpa mencampur hasil lama.

Mengapa tempatan
Alat sari kata dalam talian mahu anda memuat naik seluruh filem dan mengecaj mengikut minit. Wave Subs tiada akaun, tiada analitik, tiada pelayan; video tidak pernah dimuat naik dan tiada had tempoh. Selepas model dimuat turun, semuanya berfungsi tanpa rangkaian.

Memerlukan macOS 12 atau lebih baharu pada Apple Silicon. Pada pelancaran pertama anda akan dipandu memuat turun model pengecaman (1.6–3 GB).
```

## Tiếng Việt (vi)

截图：`store/screenshots/vi/`
营销网址：`https://jason-jm.github.io/wavesubs/vi/` · 支持网址：`https://github.com/jason-jm/wavesubs/issues` · 隐私政策网址：`https://jason-jm.github.io/wavesubs/en/privacy.html`

**名称（20/30）：** `Wave Subs: Phụ đề AI`
**副标题（29/30）：** `Phụ đề từ video, tự động dịch`
**关键词（100/100）：** `phụ đề,srt,ass,chuyển âm,whisper,dịch,ngoại tuyến,video,phim,anime,tiếng nhật,hàng loạt,mkv,miễn phí`

**宣传文本（152/170）：**
Không tìm thấy phụ đề? Kéo video vào: AI cục bộ nhận dạng lời thoại, tạo phụ đề SRT/ASS và dịch sang ngôn ngữ của bạn. Không cần mạng, miễn phí mãi mãi.

**版本说明 1.0.4：** Tải xuống hiển thị "Đang kết nối…" và chạy đua máy chủ chính với máy chủ dự phòng; ngôn ngữ theo cài đặt hiển thị của Windows; thanh tiêu đề thống nhất giúp nút cửa sổ không đè lên nội dung.

**描述：**
```text
Không tìm được phụ đề cho một video? Wave Subs tạo phụ đề SRT / ASS trực tiếp từ video bằng AI cục bộ, rồi tự động dịch sang ngôn ngữ của bạn. Mọi thứ chạy ngay trên máy Mac của bạn — không cần internet, miễn phí mãi mãi.

Ba bước ra phụ đề
• Kéo video vào: MKV, MP4, MOV, TS đều được. Rãnh phụ đề văn bản có sẵn trong video sẽ được phát hiện và dùng ngay
• AI cục bộ nhận dạng và căn chỉnh: whisper.cpp tăng tốc Metal trên Apple Silicon, tự phát hiện ngôn ngữ; thời gian được khớp với đúng lúc lời thoại được nói (tinh chỉnh theo phụ đề chính thức của sáu bộ phim dài)
• Dịch và xuất: SRT hoặc ASS đặt cạnh video, trình phát nào cũng đọc được, kèm đánh giá chất lượng

Tự động dịch sang ngôn ngữ của bạn
29 ngôn ngữ đích: Việt, Anh, Trung (giản thể/phồn thể), Nhật, Hàn, Pháp, Đức, Tây Ban Nha, Bồ Đào Nha, Nga, Thái, Indonesia, Mã Lai và hơn nữa. Mặc định dùng mô hình Qwen3 chạy cục bộ — miễn phí và ngoại tuyến — hoặc bất kỳ API tương thích OpenAI nào (nhà cung cấp tính phí). Bảng thuật ngữ giữ tên nhân vật nhất quán suốt cả mùa.

Trình chỉnh sửa có xem trước video
Sửa chữ, chỉnh thời gian, chèn, xóa, gộp, hoàn tác, tự động lưu. Bấm vào bất kỳ dòng nào để nghe đúng câu đó — HEVC, DTS cũng xem trước được. Lớp phụ đề phản ánh chỉnh sửa ngay lập tức.

Báo cáo chất lượng
Mỗi tệp đều được kiểm tra: đoạn bị bỏ sót, dòng quá dài, tốc độ không kịp đọc, thiếu bản dịch hoặc dịch dở — cho bạn biết chính xác cần xem ở đâu.

Cả mùa phim một lượt
Kéo cả thư mục vào; mọi tệp dùng chung thiết lập, tệp riêng lẻ có thể chọn rãnh phụ đề, rãnh âm thanh hoặc công cụ khác.

Không làm lại việc đã làm
Kết quả nhận dạng và bản dịch được lưu đệm riêng: xuất lại hay chạy lại chỉ vài giây; đổi mô hình hoặc bảng thuật ngữ sẽ dịch lại nghiêm ngặt, không trộn kết quả cũ.

Vì sao chọn cục bộ
Công cụ phụ đề trực tuyến bắt bạn tải cả bộ phim lên và tính tiền theo phút. Wave Subs không tài khoản, không thống kê, không máy chủ; video không bao giờ được tải lên và không giới hạn thời lượng. Tải mô hình xong là dùng được cả khi không có mạng.

Yêu cầu macOS 12 trở lên trên Apple Silicon. Lần mở đầu tiên sẽ hướng dẫn tải mô hình nhận dạng (1,6–3 GB).
```

## ไทย (th)

截图：`store/screenshots/th/`
营销网址：`https://jason-jm.github.io/wavesubs/th/` · 支持网址：`https://github.com/jason-jm/wavesubs/issues` · 隐私政策网址：`https://jason-jm.github.io/wavesubs/en/privacy.html`

**名称（23/30）：** `Wave Subs: ซับไตเติล AI`
**副标题（25/30）：** `ซับจากวิดีโอ แปลอัตโนมัติ`
**关键词（85/100）：** `ซับไตเติล,srt,ass,ถอดเสียง,whisper,แปล,ออฟไลน์,วิดีโอ,หนัง,อนิเมะ,ญี่ปุ่น,ชุด,mkv,ฟรี`

**宣传文本（114/170）：**
หาซับไม่เจอ? ลากวิดีโอมาวาง AI ในเครื่องจะจับบทพูด สร้างซับ SRT/ASS แล้วแปลเป็นภาษาของคุณ ไม่ต้องต่อเน็ต ฟรีตลอดไป

**版本说明 1.0.4：** ดาวน์โหลดแสดง "กำลังเชื่อมต่อ…" และลองเซิร์ฟเวอร์หลักกับมิเรอร์พร้อมกัน ภาษาตามการตั้งค่าภาษาแสดงผลของ Windows แถบชื่อเรื่องแบบเดียวกันทำให้ปุ่มหน้าต่างไม่ทับเนื้อหา

**描述：**
```text
หาซับไตเติลของวิดีโอไม่เจอใช่ไหม? Wave Subs สร้างซับไตเติล SRT / ASS จากวิดีโอโดยตรงด้วย AI ในเครื่อง แล้วแปลเป็นภาษาของคุณอัตโนมัติ ทุกอย่างทำงานบน Mac ของคุณเอง — ไม่ต้องต่ออินเทอร์เน็ต ฟรีตลอดไป

สามขั้นตอนได้ซับ
• ลากวิดีโอมาวาง: MKV, MP4, MOV, TS ใช้ได้หมด ถ้าวิดีโอมีแทร็กซับข้อความฝังอยู่ จะตรวจพบและใช้ทันที
• AI ในเครื่องจับบทพูดและจัดเวลา: whisper.cpp เร่งด้วย Metal บน Apple Silicon ตรวจภาษาอัตโนมัติ เวลาถูกปรับให้ตรงกับจังหวะที่พูดจริง (ปรับจูนด้วยซับทางการของหนังยาวหกเรื่อง)
• แปลแล้วส่งออก: SRT หรือ ASS ไว้ข้างวิดีโอ เครื่องเล่นไหนก็อ่านได้ พร้อมผลตรวจคุณภาพ

แปลเป็นภาษาของคุณอัตโนมัติ
ภาษาปลายทาง 29 ภาษา: ไทย อังกฤษ จีน (ตัวย่อ/ตัวเต็ม) ญี่ปุ่น เกาหลี ฝรั่งเศส เยอรมัน สเปน โปรตุเกส รัสเซีย เวียดนาม อินโดนีเซีย มาเลย์ และอื่น ๆ ค่าเริ่มต้นใช้โมเดล Qwen3 ที่รันในเครื่อง — ฟรีและออฟไลน์ — หรือเชื่อม API ที่เข้ากับ OpenAI ได้ทุกเจ้า (ผู้ให้บริการเรียกเก็บเงิน) อภิธานศัพท์ช่วยให้ชื่อตัวละครตรงกันทั้งซีซัน

ตัวแก้ไขพร้อมพรีวิววิดีโอ
แก้ข้อความ ปรับเวลา แทรก ลบ รวม เลิกทำ บันทึกอัตโนมัติ คลิกบรรทัดไหนก็ฟังประโยคนั้นได้ทันที — HEVC และ DTS ก็พรีวิวได้ ซับที่ซ้อนบนภาพสะท้อนการแก้ไขทันที

รายงานคุณภาพ
ทุกไฟล์ถูกตรวจ: ช่วงที่จับไม่ครบ บรรทัดยาวเกิน อ่านไม่ทัน ขาดคำแปลหรือแปลค้าง — บอกชัดว่าต้องดูตรงไหน

ทั้งซีซันในครั้งเดียว
ลากทั้งโฟลเดอร์มาวาง ทุกไฟล์ใช้การตั้งค่าเดียวกัน และแยกกำหนดแทร็กซับ แทร็กเสียง หรือเอนจินให้บางไฟล์ได้

ไม่ทำงานซ้ำ
ผลถอดเสียงและคำแปลแคชแยกกัน: ส่งออกใหม่หรือรันซ้ำใช้เวลาไม่กี่วินาที เปลี่ยนโมเดลหรืออภิธานศัพท์จะแปลใหม่อย่างเข้มงวด ไม่ปนผลเก่า

ทำไมต้องในเครื่อง
เครื่องมือซับออนไลน์ให้คุณอัปโหลดหนังทั้งเรื่องและคิดเงินเป็นนาที Wave Subs ไม่มีบัญชี ไม่มีการเก็บสถิติ ไม่มีเซิร์ฟเวอร์ วิดีโอไม่ถูกอัปโหลดและไม่จำกัดความยาว โหลดโมเดลแล้วใช้ได้แม้ไม่มีเน็ต

ต้องใช้ macOS 12 ขึ้นไปบน Apple Silicon เปิดครั้งแรกจะแนะนำให้ดาวน์โหลดโมเดลถอดเสียง (1.6–3 GB)
```
