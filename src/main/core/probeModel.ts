import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ModelKind } from '../../shared/types'
import { transcribeWithWhisperCpp } from './asr/whisperCpp'
import { whisperCliPath } from './tools'
import { LlamaServerManager, LocalLlamaProvider } from './translate/llamaServer'

// Exercise the shipped inference engine. An extension or a valid magic number alone proves very little.
export async function probeModel(kind: ModelKind, path: string, llama: LlamaServerManager): Promise<void> {
  if (kind === 'llm') {
    await llama.shutdown()
    try {
      const response = await new LocalLlamaProvider(llama, path, 'en').chat('Reply in one word.', 'Hello.', { maxTokens: 16, signal: AbortSignal.timeout(180_000) })
      if (!response.trim()) throw new Error('Empty model response')
    } finally { await llama.shutdown() }
    return
  }
  const dir = await mkdtemp(join(tmpdir(), 'wavesubs-probe-'))
  try {
    // One second of mono 16 kHz PCM. A JSON result confirms the decoder ran, even with no speech.
    const wav = Buffer.alloc(44 + 32000)
    wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8)
    wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22)
    wav.writeUInt32LE(16000, 24); wav.writeUInt32LE(32000, 28); wav.writeUInt16LE(2, 32)
    wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(32000, 40)
    const audioPath = join(dir, 'sample.wav')
    await writeFile(audioPath, wav)
    await transcribeWithWhisperCpp(whisperCliPath(), { modelPath: path, audioPath, language: 'en', signal: AbortSignal.timeout(180_000) })
  } finally { await rm(dir, { recursive: true, force: true }) }
}
