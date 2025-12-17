const mongoose = require("mongoose");

const bookForAiSchema = new mongoose.Schema({
  bookID: Number,
  title: String,
  authors: String,
  average_rating: Number,
  ratings_count: Number,
  text_reviews_count: Number,
  publication_date: String,
  publisher: String,
});

const BookForAi = mongoose.model("BookForAi", bookForAiSchema, "booksforai");
module.exports = BookForAi;
