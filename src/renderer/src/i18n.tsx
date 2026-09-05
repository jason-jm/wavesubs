import { createContext, useContext, useEffect, useMemo } from 'react'
import type { Translate } from '../../shared/i18n'
import { DEFAULT_LOCALE, localeMeta, translatorFor } from '../../shared/i18n'

interface I18nValue {
  t: Translate
  locale: string
  dir: 'ltr' | 'rtl'
}

const I18nContext = createContext<I18nValue>({
  t: translatorFor(DEFAULT_LOCALE),
  locale: DEFAULT_LOCALE,
  dir: 'ltr'
})

export function useI18n(): I18nValue {
  return useContext(I18nContext)
}

/** 绝大多数地方只要 t()，单独给个短名省得每次解构 */
export function useT(): Translate {
  return useContext(I18nContext).t
}

export function I18nProvider(props: {
  locale: string
  children: React.ReactNode
}): React.JSX.Element {
  const { locale, children } = props
  const value = useMemo<I18nValue>(
    () => ({ t: translatorFor(locale), locale, dir: localeMeta(locale).dir }),
    [locale]
  )

  // 同步到 <html>：CSS 逻辑属性、字体回退、以及系统的文本选择行为都看这两个属性
  useEffect(() => {
    document.documentElement.lang = locale
    document.documentElement.dir = value.dir
  }, [locale, value.dir])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

/**
 * 渲染带一个占位符的文案，把占位符换成 React 节点（例如加粗的一段）。
 * 用于「视频 {formats} 等」这种既要整句可翻译、又要局部样式的场景。
 */
export function withNode(template: string, name: string, node: React.ReactNode): React.ReactNode {
  const parts = template.split(`{${name}}`)
  if (parts.length === 1) return template
  return (
    <>
      {parts[0]}
      {node}
      {parts.slice(1).join(`{${name}}`)}
    </>
  )
}
