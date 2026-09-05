export type IconName =
  | 'convert'
  | 'batch'
  | 'models'
  | 'settings'
  | 'video'
  | 'caption'
  | 'download'
  | 'trash'
  | 'check'
  | 'close'
  | 'reveal'
  | 'sparkle'
  | 'warning'
  | 'cloud'
  | 'mac'
  | 'drop'
  | 'plus'
  | 'back'
  | 'merge'
  | 'edit'
  | 'play'

/** 线性图标，笔画与尺寸对齐 SF Symbols 的观感 */
const PATHS: Record<IconName, React.ReactNode> = {
  convert: (
    <>
      <path d="M3 5.5h10M3 9h7M3 12.5h4" />
      <path d="M11.5 13.5 14 11l-2.5-2.5" />
    </>
  ),
  batch: (
    <>
      <rect x="2" y="5.6" width="8.4" height="8.4" rx="1.8" />
      <path d="M4.8 3.3h6.1a2 2 0 0 1 2 2v6.1" />
      <path d="M4.5 9.8h3.4M4.5 11.8h2" />
    </>
  ),
  models: (
    <>
      <path d="M8 1.8 14 5v6l-6 3.2L2 11V5z" />
      <path d="M2 5l6 3.2L14 5M8 8.2v6" />
    </>
  ),
  settings: (
    <>
      <circle cx="8" cy="8" r="2.2" />
      <path d="M8 1.5v1.8M8 12.7v1.8M14.5 8h-1.8M3.3 8H1.5M12.6 3.4l-1.3 1.3M4.7 11.3l-1.3 1.3M12.6 12.6l-1.3-1.3M4.7 4.7 3.4 3.4" />
    </>
  ),
  video: (
    <>
      <rect x="1.8" y="3.2" width="12.4" height="9.6" rx="1.8" />
      <path d="M6.6 6.3 10 8l-3.4 1.7z" />
    </>
  ),
  caption: (
    <>
      <rect x="1.8" y="3.2" width="12.4" height="9.6" rx="1.8" />
      <path d="M4.6 9.6h3M8.9 9.6h2.5" />
    </>
  ),
  download: (
    <>
      <path d="M8 2.6v7.2" />
      <path d="M5.2 7.4 8 10.2l2.8-2.8" />
      <path d="M2.8 11.4v1a1.6 1.6 0 0 0 1.6 1.6h7.2a1.6 1.6 0 0 0 1.6-1.6v-1" />
    </>
  ),
  trash: (
    <>
      <path d="M2.8 4.4h10.4M6.4 4.4V3.2a1 1 0 0 1 1-1h1.2a1 1 0 0 1 1 1v1.2" />
      <path d="M4.2 4.4l.6 8.2a1.2 1.2 0 0 0 1.2 1.1h4a1.2 1.2 0 0 0 1.2-1.1l.6-8.2" />
    </>
  ),
  check: <path d="M3.2 8.4 6.4 11.6 12.8 4.8" />,
  close: <path d="M4.2 4.2l7.6 7.6M11.8 4.2l-7.6 7.6" />,
  reveal: (
    <>
      <path d="M2.4 5.2a1.6 1.6 0 0 1 1.6-1.6h2.2l1.2 1.4h4.2A1.6 1.6 0 0 1 13.2 6.6v5.2a1.6 1.6 0 0 1-1.6 1.6H4a1.6 1.6 0 0 1-1.6-1.6z" />
    </>
  ),
  sparkle: (
    <>
      <path d="M8 2.2 9.2 6 13 7.2 9.2 8.4 8 12.2 6.8 8.4 3 7.2 6.8 6z" />
      <path d="M12.6 11.4l.5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5-1.5-.5 1.5-.5z" />
    </>
  ),
  warning: (
    <>
      <path d="M8 2.6 14.2 13H1.8z" />
      <path d="M8 6.6v3.2M8 11.6h.01" />
    </>
  ),
  cloud: (
    <path d="M4.6 12.2a3 3 0 0 1-.3-6 4 4 0 0 1 7.5-.6 2.9 2.9 0 0 1-.5 6.6z" />
  ),
  mac: (
    <>
      <rect x="1.8" y="3" width="12.4" height="8.2" rx="1.4" />
      <path d="M5.6 13.6h4.8" />
    </>
  ),
  drop: (
    <>
      <path d="M8 1.8v7.4" />
      <path d="M5 6.4 8 9.4l3-3" />
      <path d="M2.4 10.6v1.8a1.8 1.8 0 0 0 1.8 1.8h7.6a1.8 1.8 0 0 0 1.8-1.8v-1.8" />
    </>
  ),
  plus: <path d="M8 3.4v9.2M3.4 8h9.2" />,
  back: <path d="M9.8 3.6 5.4 8l4.4 4.4" />,
  merge: <path d="M3.4 5.2h5.2M3.4 10.8h5.2M8.6 5.2 12 8l-3.4 2.8" />,
  edit: <path d="M9.8 3.2l3 3L6 13H3v-3l6.8-6.8ZM8.6 4.4l3 3" />,
  play: <path d="M5.6 3.8v8.4L12 8z" />
}

interface Props {
  name: IconName
  size?: number
  /**
   * viewBox 是固定的 16，所以描边会随 size 等比放大：
   * 直接放到 28px，1.4 的描边会渲染成 2.45px，比界面其它线条粗一大截。
   * 大尺寸场景传入更小的值来抵消，让实际描边保持在 1.8px 左右。
   */
  strokeWidth?: number
  className?: string
}

export function Icon({
  name,
  size = 16,
  strokeWidth = 1.4,
  className
}: Props): React.JSX.Element {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  )
}
