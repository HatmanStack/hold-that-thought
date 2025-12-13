const { PDFDocument } = require('pdf-lib')

async function mergeFiles(files) {
  // files = [{ buffer: Buffer, type: 'application/pdf' | 'image/jpeg' ... }]
  const mergedPdf = await PDFDocument.create()
  
  for (const file of files) {
    if (file.type === 'application/pdf') {
      const pdf = await PDFDocument.load(file.buffer)
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices())
      copiedPages.forEach((page) => mergedPdf.addPage(page))
    } else if (file.type.startsWith('image/')) {
      let image
      try {
        if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
          image = await mergedPdf.embedJpg(file.buffer)
        } else if (file.type === 'image/png') {
          image = await mergedPdf.embedPng(file.buffer)
        }
      } catch (err) {
        console.error('Error embedding image:', err)
        continue
      }
      
      if (image) {
        // Create page matching image dimensions
        const page = mergedPdf.addPage([image.width, image.height])
        page.drawImage(image, {
          x: 0,
          y: 0,
          width: image.width,
          height: image.height,
        })
      }
    }
  }
  
  return await mergedPdf.save()
}

module.exports = { mergeFiles }
