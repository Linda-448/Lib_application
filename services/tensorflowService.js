const tf = require("@tensorflow/tfjs");
const use = require("@tensorflow-models/universal-sentence-encoder");

let model;
let cachedBooks = [];
let cachedEmbeddings;

async function initModel() {
  console.log("Loading Universal Sentence Encoder...");
  model = await use.load();
  console.log("USE model loaded.");
}

async function initBookEmbeddings(books) {
  console.log("Generating book embeddings...");

  cachedBooks = books;

  const titles = cachedBooks.map((b) => b.title || "");
  cachedEmbeddings = await model.embed(titles);

  console.log("Book embeddings cached.");
}
async function getRecommendations(prompt) {
  if (!model || !cachedEmbeddings) return [];

  const userEmbedding = await model.embed([prompt]);

  const similarities = await cosineSimilarity(userEmbedding, cachedEmbeddings);

  return cachedBooks
    .map((book, i) => ({
      title: book.title,
      authors: book.authors,
      bookString: `${book.title} by ${book.authors}`,
      score: similarities[i]
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

async function cosineSimilarity(a, b) {
  const a_norm = a.norm(2, 1, true);
  const b_norm = b.norm(2, 1, true);

  const dotProduct = b.matMul(a.transpose());

  const similarity = dotProduct.div(b_norm.mul(a_norm));

  return similarity.squeeze().arraySync();
}

module.exports = {
  initModel,
  initBookEmbeddings,
  getRecommendations,
};
