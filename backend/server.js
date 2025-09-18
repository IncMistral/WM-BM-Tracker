// Use persistent disk path on Render
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
  if (!newData || !newData.groups || !newData.logs) {
    return res.status(400).json({ error: "Missing groups or logs" });
  }
  saveData(newData);
  res.json({ status: "ok" });
});
