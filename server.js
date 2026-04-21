const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);

const Database = require("better-sqlite3");
const db = new Database("chat.db");

const multer = require("multer");
const upload = multer({ dest: "uploads/" });

// DB
db.prepare(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room TEXT,
    text TEXT
  )
`).run();

app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));

const rooms = {};

io.on("connection", (socket) => {
  console.log("user connected:", socket.id);

  socket.on("join", (room) => {
    if (!room) return;

    if (!rooms[room]) rooms[room] = [];

    if (rooms[room].length >= 2) {
      socket.emit("full");
      return;
    }

    rooms[room].push(socket.id);
    socket.join(room);
    socket.room = room;

    const messages = db
      .prepare("SELECT * FROM messages WHERE room = ?")
      .all(room);

    socket.emit("load", messages);
  });

  socket.on("message", (msg) => {
    if (!socket.room) return;

    db.prepare(
      "INSERT INTO messages (room, text) VALUES (?, ?)"
    ).run(socket.room, msg);

    io.to(socket.room).emit("message", msg);
  });

  socket.on("image", (data) => {
    if (!socket.room) return;
    io.to(socket.room).emit("image", data);
  });
});

app.post("/upload", upload.single("image"), (req, res) => {
  console.log("UPLOAD HIT");

  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const filePath = "/" + req.file.path.replace(/\\/g, "/");

  console.log("FILE SAVED:", filePath);

  res.json({ url: filePath });
});

http.listen(3000, "0.0.0.0", () => {
  console.log("Server running on http://localhost:3000");
});