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

// ✅ Use persistent disk path on Render
const DATA_FILE = path.join("/backend", "data.json");

// Ensure data file exists
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ groups: [], logs: [] }, null, 2));
}

// Load data
function loadData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    return JSON.parse(raw || '{"groups":[],"logs":[]}');
  } catch (err) {
    return { groups: [], logs: [] };
  }
}

// Save data
function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// GET all groups + logs
app.get("/api/data", (req, res) => {
  res.json(loadData());
});

// POST new groups + logs
app.post("/api/save", (req, res) => {
  const newData = req.body;
if (!newData || !Array.isArray(newData.groups) || !Array.isArray(newData.logs)) {
  return res.status(400).json({ error: "Groups and logs must be arrays" });
}
  saveData(newData);
  res.json({ status: "ok" });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
