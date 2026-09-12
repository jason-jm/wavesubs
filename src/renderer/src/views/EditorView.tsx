import { useCallback, useEffect, useRef, useState } from 'react'
import type { ExportContent, ExportFormat, RecordView } from '../../../shared/types'
import { useT } from '../i18n'
import { Icon } from '../components/Icon'
import {
  deleteAt,
  formatTimeMs,
  insertAfter,
  mergeWithNext,
  parseTimeMs,
  pushUndo,
  updateCue
} from '../lib/editorOps'
import type { EditorCue } from '../lib/editorOps'
import { QC_TAG, qcFindingText } from '../lib/qc'

interface Props {
  path: string
  onBack: () => void
}

/**
 * 时间输入框：显示格式化时间，失焦/回车时解析提交；解析不出就回退原值。
 * 受控 + 本地草稿：直接受控会在打字过程中被格式化打断。
 */
function TimeInput(props: {
  ms: number
  onCommit: (ms: number) => void
}): React.JSX.Element {
  const [draft, setDraft] = useState<string | null>(null)
  const commit = (): void => {
    if (draft !== null) {
      const parsed = parseTimeMs(draft)
      if (parsed !== null) props.onCommit(parsed)
    }
    setDraft(null)
  }
  return (
    <input
      className="input editor-time"
      value={draft ?? formatTimeMs(props.ms)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        if (e.key === 'Escape') setDraft(null)
      }}
    />
  )
}

export function EditorView(props: Props): React.JSX.Element {
  const { path, onBack } = props
  const t = useT()
  const [record, setRecord] = useState<RecordView | null | 'loading'>('loading')
  const [cues, setCues] = useState<EditorCue[]>([])
  const [undoStack, setUndoStack] = useState<EditorCue[][]>([])
  const [saveState, setSaveState] = useState<'clean' | 'dirty' | 'saved'>('clean')
  const [format, setFormat] = useState<ExportFormat>('srt')
  const [content, setContent] = useState<ExportContent>('translated')
  const [exportedTo, setExportedTo] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  /**
   * 预览的三种形态：
   * direct  = 原片 Chromium 能直接播（H.264 MP4 等），<video> seek 到该条播放；
   * segment = 播不了的（HEVC/DTS 的 MKV 是片库常态），让 ffmpeg 把这几秒转成
   *           帧序列 + AAC，<img> 跟着 <audio> 时钟换帧——解码能力全覆盖；
   * 探测顺序：先试 direct，onError 永久降级到 segment（一个文件只探一次）。
   */
  const [previewCue, setPreviewCue] = useState<number | null>(null)
  /** 语音字幕与画面文字分开编辑：两类各自连续存放（画面文字在尾部），切换只是换一层筛选 */
  const [tab, setTab] = useState<'speech' | 'signs'>('speech')
  const [segment, setSegment] = useState<
    | { state: 'loading' }
    | { state: 'ready'; frames: string[]; audio: string | null; fps: number; offsetMs: number; durationMs: number }
    | { state: 'failed' }
    | null
  >(null)
  const [videoBroken, setVideoBroken] = useState(false)
  const [playheadMs, setPlayheadMs] = useState<number | null>(null)
  const [frameIdx, setFrameIdx] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const silentTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cuesRef = useRef<EditorCue[]>([])
  cuesRef.current = cues

  useEffect(() => {
    void window.waveSubs.loadRecord(path).then((rec) => {
      setRecord(rec)
      if (rec) {
        setCues(rec.cues)
        setContent(rec.hasTranslation ? 'translated' : 'original')
      }
    })
  }, [path])

  /**
   * 自动保存：改动后 800ms 落盘。计时器句柄放 ref，改动密集时只保最后一次。
   * 卸载时若还有未保存的改动，立刻冲一次——不能让用户手快退出丢编辑。
   */
  const scheduleSave = useCallback(
    (next: EditorCue[]) => {
      setSaveState('dirty')
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        void window.waveSubs.saveRecordCues(path, next).then((ok) => {
          if (ok) setSaveState('saved')
        })
      }, 800)
    },
    [path]
  )
  useEffect(
    () => () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current)
        void window.waveSubs.saveRecordCues(path, cuesRef.current)
      }
    },
    [path]
  )

  const apply = useCallback(
    (mutate: (prev: EditorCue[]) => EditorCue[]) => {
      setCues((prev) => {
        const next = mutate(prev)
        if (next === prev) return prev
        setUndoStack((stack) => pushUndo(stack, prev))
        scheduleSave(next)
        return next
      })
    },
    [scheduleSave]
  )

  const undo = useCallback(() => {
    setUndoStack((stack) => {
      if (stack.length === 0) return stack
      const prev = stack[stack.length - 1]
      setCues(prev)
      scheduleSave(prev)
      return stack.slice(0, -1)
    })
  }, [scheduleSave])

  // Cmd/Ctrl+Z 撤销；编辑器是这个页面的主体，全局监听没有冲突对象
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        undo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo])

  const jumpTo = useCallback(
    (sec: number) => {
      const ms = sec * 1000
      const idx = cuesRef.current.findIndex((c) => c.endMs >= ms)
      const row = listRef.current?.querySelector(`[data-row="${Math.max(0, idx)}"]`)
      row?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    },
    []
  )

  const stopPreview = useCallback(() => {
    videoRef.current?.pause()
    audioRef.current?.pause()
    if (silentTimer.current) clearInterval(silentTimer.current)
    silentTimer.current = null
  }, [])

  const playCue = useCallback(
    (i: number) => {
      const cue = cuesRef.current[i]
      if (!cue) return
      stopPreview()
      setPreviewCue(i)
      const video = videoRef.current
      if (record !== 'loading' && record?.mediaUrl && !videoBroken && video) {
        // 直接播放：起点前垫 0.4s，让人听到这句怎么开头的
        video.currentTime = Math.max(0, cue.startMs / 1000 - 0.4)
        void video.play().catch(() => setVideoBroken(true))
        return
      }
      setSegment({ state: 'loading' })
      void window.waveSubs
        .previewSegment(path, { startMs: cue.startMs, endMs: cue.endMs })
        .then(async (seg) => {
          // 预加载全部帧再开播：逐帧现解码会抖
          await Promise.all(
            seg.frames.map(
              (src) =>
                new Promise<void>((done) => {
                  const img = new Image()
                  img.onload = () => done()
                  img.onerror = () => done()
                  img.src = src
                })
            )
          )
          setSegment({ state: 'ready', ...seg })
          setFrameIdx(0)
          setPlayheadMs(seg.offsetMs)
          const audio = audioRef.current
          if (seg.audio && audio) {
            audio.src = seg.audio
            audio.currentTime = 0
            void audio.play().catch(() => undefined)
          } else {
            // 无声视频：用定时器代替音频时钟推帧
            const startedAt = Date.now()
            silentTimer.current = setInterval(() => {
              const t = Date.now() - startedAt
              if (t >= seg.durationMs) {
                if (silentTimer.current) clearInterval(silentTimer.current)
                return
              }
              setFrameIdx(Math.min(seg.frames.length - 1, Math.floor((t / 1000) * seg.fps)))
              setPlayheadMs(seg.offsetMs + t)
            }, 1000 / seg.fps)
          }
        })
        .catch(() => setSegment({ state: 'failed' }))
    },
    [path, record, stopPreview, videoBroken]
  )

  // 组件卸载停掉一切播放源
  useEffect(() => stopPreview, [stopPreview])

  /** 当前播放位置盖到哪条字幕上（直接播放与片段播放共用） */
  const overlayCue =
    playheadMs === null
      ? null
      : (cues.find((c) => c.kind !== 'sign' && c.startMs <= playheadMs && playheadMs < c.endMs) ?? null)
  const overlaySigns =
    playheadMs === null
      ? []
      : cues.filter((c) => c.kind === 'sign' && c.startMs <= playheadMs && playheadMs < c.endMs).slice(0, 3)
  const speechCount = cues.filter((c) => c.kind !== 'sign').length
  const signCount = cues.length - speechCount
  const rows = cues.map((cue, i) => ({ cue, i })).filter(({ cue }) => (cue.kind === 'sign') === (tab === 'signs'))

  const doExport = useCallback(() => {
    // 导出前把未落盘的编辑冲下去，否则导出的是上一版
    if (saveTimer.current) clearTimeout(saveTimer.current)
    void window.waveSubs
      .saveRecordCues(path, cuesRef.current)
      .then(() => window.waveSubs.exportRecord(path, { format, content }))
      .then((out) => {
        setSaveState('saved')
        setExportedTo(out)
      })
  }, [path, format, content])

  if (record === 'loading') {
    return <div className="rise editor-empty">…</div>
  }
  if (record === null) {
    return (
      <div className="rise editor-empty">
        <p>{t('editor.noRecord')}</p>
        <button className="btn" onClick={onBack}>
          {t('editor.back')}
        </button>
      </div>
    )
  }

  const showTranslation = record.hasTranslation
  const staleCount = cues.filter((c) => c.srcEdited).length

  return (
    <div className="rise editor-page">
      <div className="editor-head">
        <button className="btn btn-quiet" onClick={onBack}>
          <Icon name="back" size={14} />
          {t('editor.back')}
        </button>
        <div className="editor-title">
          <strong>{path.split(/[\\/]/).pop()}</strong>
          <span className="editor-meta">
            {t('editor.count', { n: cues.length })}
            {staleCount > 0 && ` · ${t('editor.staleCount', { n: staleCount })}`}
          </span>
        </div>
        <span className="spacer" />
        <span className={`editor-savestate editor-${saveState}`}>
          {saveState === 'dirty' ? t('editor.saving') : saveState === 'saved' ? t('editor.saved') : ''}
        </span>
        <button className="btn" disabled={undoStack.length === 0} onClick={undo}>
          {t('editor.undo')}
        </button>
      </div>

      {record.qc && record.qc.findings.length > 0 && (
        <div className="editor-qc">
          <span className={`tag ${QC_TAG[record.qc.level].tone}`}>
            {t(QC_TAG[record.qc.level].key)}
          </span>
          {record.qc.findings.map((f, i) => (
            <button
              key={i}
              className="btn btn-quiet link-btn"
              onClick={() => f.atSec !== undefined && jumpTo(f.atSec)}
            >
              {qcFindingText(f, t)}
            </button>
          ))}
        </div>
      )}

      {(previewCue !== null || (record.mediaUrl && !videoBroken)) && (
        <div className="editor-preview">
          {record.mediaUrl && !videoBroken ? (
            <video
              ref={videoRef}
              className="editor-video"
              src={record.mediaUrl}
              onError={() => setVideoBroken(true)}
              onTimeUpdate={(e) => {
                const v = e.currentTarget
                setPlayheadMs(v.currentTime * 1000)
                const cue = previewCue !== null ? cuesRef.current[previewCue] : null
                if (cue && v.currentTime * 1000 > cue.endMs + 400) v.pause()
              }}
              controls
            />
          ) : segment?.state === 'ready' ? (
            <div className="editor-canvas">
              {segment.frames.length > 0 ? (
                <img className="editor-frame" src={segment.frames[frameIdx]} alt="" />
              ) : (
                <p className="editor-audio-only">{t('editor.audioOnly')}</p>
              )}
            </div>
          ) : segment?.state === 'loading' ? (
            <div className="editor-canvas">
              <p className="editor-audio-only">{t('editor.previewLoading')}</p>
            </div>
          ) : segment?.state === 'failed' ? (
            <div className="editor-canvas">
              <p className="editor-audio-only">{t('editor.previewFailed')}</p>
            </div>
          ) : null}
          {overlayCue && (
            <div className="editor-subtitle-overlay">
              {overlayCue.translation && <span>{overlayCue.translation}</span>}
              <span className="editor-overlay-src">{overlayCue.text}</span>
            </div>
          )}
          {overlaySigns.map((s, k) => {
            // 位置与字号是转换时排好的（core/signs/layout.ts），这里照着画，和导出的字幕一致
            const pos = s.pos ?? { x: 0.1, y: 0.05, w: 0.8, h: 0.05 }
            const anchor = s.anchor ?? { x: pos.x + pos.w / 2, y: pos.y + pos.h + 0.03 }
            const style = {
              left: `${anchor.x * 100}%`,
              top: `${anchor.y * 100}%`,
              transform: 'translate(-50%, -50%)',
              fontSize: `${((s.fontSize ?? 40) / 1080) * 100}cqh`
            }
            return (
              <div key={k} className={s.layout === 'box' ? 'editor-sign-overlay editor-sign-box' : 'editor-sign-overlay'} style={style}>
                {s.translation || s.text}
              </div>
            )
          })}
          <audio
            ref={audioRef}
            hidden
            onTimeUpdate={(e) => {
              if (segment?.state !== 'ready') return
              const t0 = e.currentTarget.currentTime * 1000
              setPlayheadMs(segment.offsetMs + t0)
              if (segment.frames.length > 0) {
                setFrameIdx(
                  Math.min(segment.frames.length - 1, Math.floor((t0 / 1000) * segment.fps))
                )
              }
            }}
          />
        </div>
      )}

      <div className="segmented editor-tabs">
        <button className={tab === 'speech' ? 'segmented-on' : ''} onClick={() => setTab('speech')}>
          {t('editor.tab.speech')} · {speechCount}
        </button>
        <button className={tab === 'signs' ? 'segmented-on' : ''} onClick={() => setTab('signs')}>
          {t('editor.tab.signs')} · {signCount}
        </button>
      </div>

      <div className="card editor-list" ref={listRef}>
        {tab === 'signs' && signCount === 0 && <p className="editor-empty-hint">{t('editor.signsEmpty')}</p>}
        {rows.map(({ cue, i }) => (
          <div key={`${i}-${cue.startMs}`} className="editor-row" data-row={i}>
            <span className="editor-index">{cue.index}</span>
            <div className="editor-times">
              <TimeInput
                ms={cue.startMs}
                onCommit={(ms) => apply((prev) => updateCue(prev, i, { startMs: ms }))}
              />
              <TimeInput
                ms={cue.endMs}
                onCommit={(ms) => apply((prev) => updateCue(prev, i, { endMs: ms }))}
              />
            </div>
            <div className="editor-texts">
              <input
                className="input editor-text"
                value={cue.text}
                placeholder={t('editor.source')}
                onChange={(e) => apply((prev) => updateCue(prev, i, { text: e.target.value }))}
              />
              {showTranslation && (
                <input
                  className={`input editor-text ${cue.srcEdited ? 'editor-stale' : ''}`}
                  value={cue.translation ?? ''}
                  placeholder={t('editor.translation')}
                  title={cue.srcEdited ? t('editor.staleHint') : undefined}
                  onChange={(e) =>
                    apply((prev) => updateCue(prev, i, { translation: e.target.value }))
                  }
                />
              )}
            </div>
            <div className="editor-ops">
              <button
                className={previewCue === i ? 'btn btn-quiet btn-on' : 'btn btn-quiet'}
                title={t('editor.play')}
                onClick={() => playCue(i)}
              >
                <Icon name="play" size={13} />
              </button>
              <button
                className="btn btn-quiet"
                title={t('editor.addBelow')}
                onClick={() =>
                  apply((prev) => {
                    const next = insertAfter(prev, i)
                    // 画面文字页里新增的也是画面文字，位置沿用上一条
                    if (cue.kind === 'sign') next[i + 1] = { ...next[i + 1], kind: 'sign', pos: cue.pos, layout: cue.layout, importance: cue.importance }
                    return next
                  })
                }
              >
                <Icon name="plus" size={13} />
              </button>
              <button
                className="btn btn-quiet"
                title={t('editor.merge')}
                disabled={i === cues.length - 1 || (cues[i + 1].kind === 'sign') !== (cue.kind === 'sign')}
                onClick={() => apply((prev) => mergeWithNext(prev, i))}
              >
                <Icon name="merge" size={13} />
              </button>
              <button
                className="btn btn-quiet btn-danger"
                title={t('editor.delete')}
                onClick={() => apply((prev) => deleteAt(prev, i))}
              >
                <Icon name="trash" size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="job-actions editor-actions">
        {exportedTo && (
          <button className="btn btn-quiet link-btn" onClick={() => window.waveSubs.revealInFinder(exportedTo)}>
            {t('editor.exported')}
          </button>
        )}
        <span className="spacer" />
        <div className="segmented">
          <button className={format === 'srt' ? 'segmented-on' : ''} onClick={() => setFormat('srt')}>
            SRT
          </button>
          <button className={format === 'ass' ? 'segmented-on' : ''} onClick={() => setFormat('ass')}>
            ASS
          </button>
        </div>
        {showTranslation && (
          <div className="segmented">
            <button
              className={content === 'translated' ? 'segmented-on' : ''}
              onClick={() => setContent('translated')}
            >
              {t('home.content.translated')}
            </button>
            <button
              className={content === 'bilingual' ? 'segmented-on' : ''}
              onClick={() => setContent('bilingual')}
            >
              {t('home.content.bilingual')}
            </button>
            <button
              className={content === 'original' ? 'segmented-on' : ''}
              onClick={() => setContent('original')}
            >
              {t('editor.contentOriginal')}
            </button>
          </div>
        )}
        <button className="btn btn-primary" onClick={doExport}>
          {t('editor.export')}
        </button>
      </div>
    </div>
  )
}
