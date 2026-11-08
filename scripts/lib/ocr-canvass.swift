// macOS Vision OCR with overlapping tiles; outputs source-page coordinates.
import Foundation
import PDFKit
import Vision
import AppKit
let input = CommandLine.arguments[1]
let output = CommandLine.arguments[2]
let pdf = PDFDocument(url:URL(fileURLWithPath:input))!
var pages = [[String:Any]]()
for i in 0..<pdf.pageCount {
 let page = pdf.page(at:i)!, bounds = page.bounds(for:.mediaBox)
 let scale: CGFloat = 3
 let width=Int(bounds.width*scale), height=Int(bounds.height*scale)
 let context=CGContext(data:nil,width:width,height:height,bitsPerComponent:8,bytesPerRow:0,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue)!
 context.setFillColor(NSColor.white.cgColor);context.fill(CGRect(x:0,y:0,width:width,height:height));context.scaleBy(x:scale,y:scale);page.draw(with:.mediaBox,to:context)
 let image=context.makeImage()!
 var items = [[String:Any]]()
 // Full page plus four overlapping tiles preserve narrow/rotated header text.
 var regions=[CGRect(x:0,y:0,width:width,height:height)]
 for fy in [0.0,0.4] { for fx in [0.0,0.4] { regions.append(CGRect(x:Double(width)*fx,y:Double(height)*fy,width:Double(width)*0.6,height:Double(height)*0.6)) } }
 for (tile,region) in regions.enumerated() {
  guard let crop=image.cropping(to:region.integral) else { continue }
  let request=VNRecognizeTextRequest();request.recognitionLevel = .accurate;request.usesLanguageCorrection=false
  try VNImageRequestHandler(cgImage:crop,options:[:]).perform([request])
  for result in request.results ?? [] {
   guard let candidate=result.topCandidates(1).first else { continue }
   let b=result.boundingBox
   items.append(["text":candidate.string,"confidence":candidate.confidence,"tile":tile,"x":region.minX+b.minX*region.width,"y":region.minY+(1-b.maxY)*region.height,"w":b.width*region.width,"h":b.height*region.height])
  }
 }
 pages.append(["page":i+1,"width":width,"height":height,"items":items])
}
try JSONSerialization.data(withJSONObject:pages,options:[.sortedKeys]).write(to:URL(fileURLWithPath:output))
print(URL(fileURLWithPath:input).lastPathComponent,pdf.pageCount,"pages")
