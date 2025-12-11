module.exports = {
  GoogleGenerativeAI: class {
    constructor() {}
    getGenerativeModel() {
      return {
        generateContent: async () => ({
          response: {
            text: () => JSON.stringify({ summary: 'mocked summary' })
          }
        })
      }
    }
  }
}
