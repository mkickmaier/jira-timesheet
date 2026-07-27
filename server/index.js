const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const { exec } = require('child_process');

const configModule = require('./config');
const database = require('./database');
const backupModule = require('./backup');
const excelModule = require('./excel');
const jiraModule = require('./jira');

// Bridge potential circular callbacks
database.registerBackupCallback(backupModule.createBackup);

const app = express();

// Multer storage configurations
const memberPicStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const baseDir = path.join(__dirname, '..');
    const dir = path.join(baseDir, 'uploads', 'members');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const memberName = req.body.memberName || 'unknown';
    const ext = path.extname(file.originalname);
    const safeName = memberName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const timestamp = Date.now();
    cb(null, `${safeName}_${timestamp}${ext}`);
  }
});
const uploadMemberPic = multer({ storage: memberPicStorage });
const uploadExcel = multer({ storage: multer.memoryStorage() });

app.use(express.json());

// Routes definition

// PLANNING API
app.get('/api/planning', (req, res) => {
  const { pi } = req.query;
  if (!pi) return res.status(400).json({ error: 'PI name is required' });
  const data = database.getPlanningData(pi) || { pi, members: [], days: {} };
  database.saveLastPi(pi);
  res.json(data);
});

app.get('/api/planning/last', (req, res) => {
  const pi = database.getLastPi();
  res.json({ pi });
});

app.get('/api/planning/types', (req, res) => {
  res.json(database.getPlanningTypes());
});

app.post('/api/planning/types', async (req, res) => {
  const types = req.body;
  if (!Array.isArray(types)) return res.status(400).json({ error: 'Types must be an array' });
  if (await database.savePlanningTypes(types)) {
    res.json({ message: 'Types saved successfully' });
  } else {
    res.status(500).json({ error: 'Failed to save types' });
  }
});

app.post('/api/planning', async (req, res) => {
  const { pi, data } = req.body;
  if (!pi || !data) return res.status(400).json({ error: 'PI and data are required' });
  if (await database.savePlanningData(pi, data)) {
    res.json({ message: 'Planning saved successfully' });
  } else {
    res.status(500).json({ error: 'Failed to save planning' });
  }
});

// EXCEL API
app.get('/api/planning/export', (req, res) => {
  const { pi, startDate, endDate, filterEvent } = req.query;
  if (!pi) return res.status(400).json({ error: 'PI name is required' });
  excelModule.exportExcel(pi, startDate, endDate, filterEvent, res);
});

app.post('/api/planning/import', uploadExcel.single('file'), (req, res) => {
  const { pi } = req.body;
  if (!pi) return res.status(400).json({ error: 'PI name is required' });
  if (!req.file) return res.status(400).json({ error: 'Excel file is required' });
  excelModule.importExcel(pi, req.file.buffer, res);
});

// BACKUPS API
app.get('/api/backups', (req, res) => {
  try {
    const list = backupModule.listBackups();
    res.json(list);
  } catch (err) {
    console.error('[BACKUP] Failed to fetch backups list:', err);
    res.status(500).json({ error: 'Failed to retrieve backups list' });
  }
});

app.post('/api/backups/create', (req, res) => {
  const { label } = req.body;
  const backupName = backupModule.createBackup(true, label);
  if (backupName) {
    res.json({ message: 'Backup created successfully', id: backupName });
  } else {
    res.status(500).json({ error: 'Failed to create backup' });
  }
});

app.post('/api/backups/restore', (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'Backup ID is required' });
  try {
    backupModule.restoreBackup(id);
    res.json({ message: 'System state successfully restored' });
  } catch (err) {
    console.error('[BACKUP] Restore failed:', err.message);
    res.status(500).json({ error: 'Failed to restore backup: ' + err.message });
  }
});

// JIRA CAPACITY API
app.get('/api/capacity', async (req, res) => {
  const { pi } = req.query;
  if (!pi) return res.status(400).json({ error: 'PI name is required' });
  try {
    const data = await jiraModule.getCapacityData(pi);
    res.json(data);
  } catch (err) {
    console.error('[CAPACITY] Failed to fetch capacity data:', err);
    res.status(500).json({ error: 'Failed to fetch capacity data' });
  }
});

// CONFIG AND HEALTH API
app.get('/api/config', (_, res) => res.json({ jiraBaseUrl: configModule.getJiraConfig().baseUrl }));
app.get('/api/health', (_, res) => res.json({ ok: true }));

// USER PICS UPLOAD API
app.post('/api/planning/member/image', uploadMemberPic.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image file provided' });
  const imageUrl = `/uploads/members/${req.file.filename}`;
  res.json({ imageUrl });
});

// Static files delivery middlewares
const uploadsDir = path.join(__dirname, '..', 'uploads');
app.use('/uploads', express.static(uploadsDir));

const webDir = path.join(__dirname, '..', 'web');
app.use(express.static(webDir));

app.use((req, res) => {
  res.sendFile(path.join(__dirname, '..', 'web', 'index.html'));
});

function openBrowser(url) {
  const start = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  exec(`${start} ${url}`);
}

async function start() {
  await configModule.setupConfig();

  app.listen(configModule.PORT, () => {
    const url = `http://localhost:${configModule.PORT}`;
    console.log(`Server running on ${url}`);
    openBrowser(url);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
