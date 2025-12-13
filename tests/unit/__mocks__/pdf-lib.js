module.exports = {
  PDFDocument: {
    create: async () => ({
      save: async () => Buffer.from('mock-pdf'),
      embedJpg: async () => ({ width: 10, height: 10 }),
      embedPng: async () => ({ width: 10, height: 10 }),
      addPage: () => ({ drawImage: () => {} }),
      copyPages: async () => []
    }),
    load: async () => ({
      getPageIndices: () => [],
      copyPages: async () => []
    })
  }
}
