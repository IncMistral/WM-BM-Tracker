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
  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify({ groups: [], logs: [] }, null, 2)
  );
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

// ====================== API ROUTES ====================== //

// GET all groups + logs
app.get("/api/data", (req, res) => {
  res.json(loadData());
});

// POST new groups + logs (overwrite)
app.post("/api/save", (req, res) => {
  const newData = req.body;
  if (!newData || !Array.isArray(newData.groups) || !Array.isArray(newData.logs)) {
    return res.status(400).json({ error: "Groups and logs must be arrays" });
  }
  saveData(newData);
  res.json({ status: "ok" });
});

// GET only logs
app.get("/api/logs", (req, res) => {
  const data = loadData();
  res.json(data.logs || []);
});

// DELETE logs for a specific group/date
app.delete("/api/logs/:group/:date", (req, res) => {
  const { group, date } = req.params;
  const data = loadData();

  // Keep everything except logs matching this group+date
  const before = data.logs.length;
  data.logs = data.logs.filter(
    (l) => !(l.group === group && l.date === date)
  );
  const after = data.logs.length;

  saveData(data);
  res.json({
    status: "deleted",
    group,
    date,
    removed: before - after,
  });
});

// ======================================================== //

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
