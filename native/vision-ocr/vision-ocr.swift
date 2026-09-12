// macOS Vision 文字识别命令行：给一批帧图，逐帧输出文本框（JSON Lines）。
// 用法：vision-ocr [--langs ja,zh-Hans,en] [--level accurate|fast] [--jobs 4] [--no-correct] [--min-conf 0.3] <图片…>
//       vision-ocr --list-langs
// 坐标统一成左上角原点的归一化值（Vision 原生是左下角原点）。
import Foundation
import Vision
import ImageIO

var langs = ["ja", "zh-Hans", "en"]
var level: VNRequestTextRecognitionLevel = .accurate
var jobs = 4
var correct = true
var minConf: Float = 0.0
var files: [String] = []

var args = Array(CommandLine.arguments.dropFirst())
while !args.isEmpty {
  let a = args.removeFirst()
  switch a {
  case "--langs": langs = args.removeFirst().split(separator: ",").map(String.init)
  case "--level": level = args.removeFirst() == "fast" ? .fast : .accurate
  case "--jobs": jobs = Int(args.removeFirst()) ?? 4
  case "--no-correct": correct = false
  case "--min-conf": minConf = Float(args.removeFirst()) ?? 0
  case "--list-langs":
    let req = VNRecognizeTextRequest()
    req.recognitionLevel = .accurate
    let supported = (try? req.supportedRecognitionLanguages()) ?? []
    print(supported.joined(separator: ","))
    exit(0)
  default: files.append(a)
  }
}
if files.isEmpty {
  FileHandle.standardError.write("没有输入图片\n".data(using: .utf8)!)
  exit(2)
}

struct Box: Encodable { let t: String; let c: Float; let x: Double; let y: Double; let w: Double; let h: Double }
struct Frame: Encodable { let i: Int; let file: String; let boxes: [Box] }

func recognize(_ path: String) -> [Box] {
  let url = URL(fileURLWithPath: path)
  let req = VNRecognizeTextRequest()
  req.recognitionLevel = level
  req.recognitionLanguages = langs
  req.usesLanguageCorrection = correct
  let handler = VNImageRequestHandler(url: url, options: [:])
  do { try handler.perform([req]) } catch { return [] }
  var out: [Box] = []
  for obs in req.results ?? [] {
    guard let cand = obs.topCandidates(1).first, cand.confidence >= minConf else { continue }
    let b = obs.boundingBox  // 左下角原点
    out.append(Box(t: cand.string, c: cand.confidence, x: b.minX, y: 1 - b.maxY, w: b.width, h: b.height))
  }
  return out
}

let started = Date()
var results = [Frame?](repeating: nil, count: files.count)
let lock = NSLock()
DispatchQueue.concurrentPerform(iterations: files.count) { i in
  // concurrentPerform 会用满所有核；用信号量把并发压到 --jobs
  let boxes = recognize(files[i])
  let frame = Frame(i: i, file: (files[i] as NSString).lastPathComponent, boxes: boxes)
  lock.lock(); results[i] = frame; lock.unlock()
}
let enc = JSONEncoder()
enc.outputFormatting = [.withoutEscapingSlashes]
var outData = Data()
for r in results.compactMap({ $0 }) {
  outData.append(try! enc.encode(r)); outData.append(0x0A)
}
FileHandle.standardOutput.write(outData)
let secs = Date().timeIntervalSince(started)
FileHandle.standardError.write(String(format: "%d 帧 %.1fs（%.0f ms/帧）\n", files.count, secs, secs * 1000 / Double(max(files.count, 1))).data(using: .utf8)!)
