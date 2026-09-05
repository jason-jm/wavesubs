/**
 * 从旧名字 SubFlow 迁移用户数据。
 *
 * `app.getPath('userData')` 是按 `app.getName()` 算的，改名之后指向
 * `…/Application Support/Wave Subs`，旧数据还躺在 `…/subflow` 下。不迁的话
 * 老用户升级完会看到一个全新的空应用：设置没了、下载好的模型也要重下几个 GB。
 *
 * **API Key 迁不过来，只能清掉**。safeStorage 的主密钥存在钥匙串条目
 * `subflow Safe Storage` 里，而条目名同样跟着 `app.getName()` 走——改名后
 * Electron 会另建一个 `Wave Subs Safe Storage`，密钥是全新随机的，旧密文
 * 在数学上就解不开。与其留着一段永远解不开的密文让用户以为"已配置好了"，
 * 不如直接删掉字段，让设置页如实显示"未填 Key"。
 */
import { app } from 'electron'
import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const LEGACY_DIR_NAME = 'subflow'

export interface MigrationResult {
  migrated: boolean
  /** 有多少个云端服务的 Key 因为换名字而失效，需要用户重填 */
  droppedKeys: number
  movedModels: boolean
}

export function migrateLegacyUserData(): MigrationResult {
  const none: MigrationResult = { migrated: false, droppedKeys: 0, movedModels: false }
  const current = app.getPath('userData')
  const legacy = join(dirname(current), LEGACY_DIR_NAME)

  // 已经迁过、或本来就是新装：都不该再动旧目录
  if (existsSync(join(current, 'settings.json'))) return none
  if (!existsSync(join(legacy, 'settings.json'))) return none
  // 大小写不敏感的文件系统上，同一个目录可能有两个名字，别把自己迁给自己
  if (legacy === current) return none

  mkdirSync(current, { recursive: true })

  let droppedKeys = 0
  try {
    const raw = JSON.parse(readFileSync(join(legacy, 'settings.json'), 'utf8')) as {
      translation?: { providers?: Array<{ apiKeyEnc?: string }> }
    }
    for (const p of raw.translation?.providers ?? []) {
      // plain: 前缀的是没有加密能力时存的明文，换名字不影响，可以留着
      if (p.apiKeyEnc && !p.apiKeyEnc.startsWith('plain:')) {
        delete p.apiKeyEnc
        droppedKeys += 1
      }
    }
    writeFileSync(join(current, 'settings.json'), JSON.stringify(raw, null, 2), 'utf8')
  } catch {
    // 旧设置读不动就跳过——宁可用默认值起步，也不能因为迁移把应用卡在启动阶段
    return none
  }

  // 模型动辄几个 GB，用 rename 挪过来（同一分区上是瞬时的），复制会等很久
  let movedModels = false
  const legacyModels = join(legacy, 'models')
  const currentModels = join(current, 'models')
  if (existsSync(legacyModels) && !existsSync(currentModels)) {
    try {
      renameSync(legacyModels, currentModels)
      movedModels = true
    } catch {
      try {
        cpSync(legacyModels, currentModels, { recursive: true })
        movedModels = true
      } catch {
        // 模型没迁成不影响使用，用户重下即可，不值得因此中断启动
      }
    }
  }

  return { migrated: true, droppedKeys, movedModels }
}
