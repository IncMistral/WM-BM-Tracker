const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 10000;

// Allow cross-origin requests (so frontend can call backend)
app.use(cors());
app.use(express.json());

// Serve static frontend (index.html, etc.) from ../public
app.use(express.static(path.join(__dirname, "..", "public")));

const DATA_FILE = path.join("/backend", "data.json");

// Load data
function loadData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    return JSON.parse(raw || "[]");
  } catch (err) {
    return [];
  }
}

// Save data
function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// GET all groups/projects/logs
app.get("/api/data", (req, res) => {
  res.json(loadData());
});

// POST new data
app.post("/api/save", (req, res) => {
  const newData = req.body;
  if (!newData) {
    return res.status(400).json({ error: "Missing data" });
  }
  saveData(newData);
  res.json({ status: "ok" });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
