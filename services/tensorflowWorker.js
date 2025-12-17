const { parentPort } = require("worker_threads");
const tensorflowService = require("./tensorflowService");
let modelReady = false;
let booksReady = false;
async function initializeModel() {
  await tensorflowService.initModel();
  modelReady = true;
}
parentPort.on("message", async (msg) => {
  if (msg.type === "loadBooks") {
    if (!modelReady) await initializeModel();

    await tensorflowService.initBookEmbeddings(msg.books);
    booksReady = true;
    return;
  }
  if (msg.prompt) {
    const { prompt } = msg;

    try {
      if (!modelReady || !booksReady) {
        throw new Error("Worker not ready yet.");
      }

      const recommendations = await tensorflowService.getRecommendations(prompt);
      parentPort.postMessage({
        prompt,
        payload: {
          response: recommendations.length
            ? "Here are some recommendations based on your prompt."
            : `Sorry, no matching books were found for "${prompt}".`,
          books: recommendations
        },
      });
    } catch (err) {
      parentPort.postMessage({ prompt, error: err.message });
    }
  }
});
