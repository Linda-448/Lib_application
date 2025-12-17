const express = require("express");
const mongoose = require("mongoose");
const passport = require("passport");
const bodyParser = require("body-parser");
const LocalStrategy = require("passport-local");
const session = require("express-session");
const { Worker } = require("worker_threads");
const User = require("./model/User");
const Book = require("./model/Book");
const app = express();
const tensorflowWorker = new Worker("./services/tensorflowWorker.js");
tensorflowWorker.on("error", (err) => console.error("TensorFlow Worker Error:", err));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(__dirname + "/public"));
app.use(
  session({
    secret: "Rusty is a dog",
    resave: false,
    saveUninitialized: false,
  })
);
app.use(passport.initialize());
app.use(passport.session());
passport.use(
  new LocalStrategy(async (username, password, done) => {
    try {
      const user = await User.findOne({ username: username });
      if (!user) return done(null, false, { message: "Incorrect username." });
      if (user.password !== password) return done(null, false, { message: "Incorrect password." });
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  })
);
passport.serializeUser((user, done) => {
  if (user.isAdmin) return done(null, { _id: "admin" });
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  if (id && id._id === "admin") {
    return done(null, { username: "Admin", isAdmin: true });
  }
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) return done(null, false);
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});
app.get("/", (req, res) => res.render("home"));
app.get("/register", (req, res) => res.render("register"));
app.post("/register", async (req, res) => {
  try {
    await User.create({ username: req.body.username, password: req.body.password });
    res.redirect("/login");
  } catch (err) {
    res.redirect("/register");
  }
});
app.get("/login", (req, res) => res.render("login"));

app.post("/login", (req, res, next) => {
  passport.authenticate("local", async (err, user, info) => {
    if (err || !user) {
      return res.redirect("/?error=Invalid credentials");
    }

    req.logIn(user, async (err) => {
      if (err) {
        return res.redirect("/?error=Login failed");
      }

      const books = await Book.find({}).limit(15);
      return res.render("booklist", { books });
    });
  })(req, res, next);
});
app.get("/logout", (req, res, next) => {
  req.logout((err) => (err ? next(err) : res.redirect("/")));
});
app.get("/booklist", isLoggedIn, async (req, res) => {
  try {
    const books = await Book.find({}).limit(15);
    res.render("booklist", { books });
  } catch (err) {
    res.redirect("/");
  }
});
app.get("/admin", (req, res) => res.render("admin-login"));
passport.use(
  "admin-local",
  new LocalStrategy((username, password, done) => {
    if (username === "Admin" && password === "12345") {
      return done(null, { username: "Admin", isAdmin: true });
    }
    return done(null, false, { message: "Incorrect admin credentials" });
  })
);

app.post(
  "/admin-login",
  passport.authenticate("admin-local", {
    successRedirect: "/admin-dashboard",
    failureRedirect: "/?error=Invalid admin credentials",
  })
);

app.get("/admin-dashboard", (req, res) => {
  if (req.isAuthenticated() && req.user.isAdmin) return res.render("admin-dashboard");
  res.redirect("/admin");
});

app.post("/admin-dashboard/add-book", async (req, res) => {
  if (!req.isAuthenticated() || !req.user.isAdmin) return res.redirect("/admin");
  
  try {
    await Book.create(req.body);
    res.redirect("/admin-dashboard");
  } catch (err) {
    res.redirect("/admin-dashboard");
  }
});
app.get("/tensorflow-chat", (req, res) => res.render("tensorflowChat"));
app.post("/tensorflow-chat", (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: "Prompt required" });

  const onMessage = (workerResponse) => {
    if (workerResponse.prompt === prompt) {
      if (workerResponse.error) {
        res.status(500).json({ error: "Failed to get TensorFlow response" });
      } else {
        res.json(workerResponse.payload);
      }
      tensorflowWorker.removeListener("message", onMessage);
    }
  };

  tensorflowWorker.on("message", onMessage);
  tensorflowWorker.postMessage({ prompt });
});

function isLoggedIn(req, res, next) {
  return req.isAuthenticated() ? next() : res.redirect("/login");
}

async function startServer() {
  try {
    await mongoose.connect(    "mongodb+srv://lindalarrissa91:linda91@cluster0.gktucwf.mongodb.net/Library?retryWrites=true&w=majority"
    );
    console.log("MongoDB connected successfully.");
    console.log("Loading limited books (300 max) to send to TensorFlow worker...");

    const books = await Book.find({}).limit(300).lean();
    tensorflowWorker.postMessage({ type: "loadBooks", books });

    console.log(`Sent ${books.length} books to TensorFlow worker.`);

    app.listen(3000, "0.0.0.0", () => console.log("Server started on port 3000"));
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}
startServer();
