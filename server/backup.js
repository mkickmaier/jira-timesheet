const fs = require('fs');
const path = require('path');

function pruneBackups(backupsDir) {
  try {
    const folders = fs.readdirSync(backupsDir).filter(f => {
      try {
        return fs.statSync(path.join(backupsDir, f)).isDirectory();
      } catch {
        return false;
      }
    });

    const autoBackups = [];
    const manualBackups = [];

    folders.forEach(f => {
      const parts = f.split('_');
      const timestamp = parseInt(parts[0], 10);
      if (isNaN(timestamp)) return;

      if (f.includes('_auto')) {
        autoBackups.push({ folder: f, timestamp });
      } else if (f.includes('_manual_')) {
        manualBackups.push({ folder: f, timestamp });
      }
    });

    autoBackups.sort((a, b) => a.timestamp - b.timestamp);
    manualBackups.sort((a, b) => a.timestamp - b.timestamp);

    const maxAuto = 30;
    const maxManual = 20;

    while (autoBackups.length > maxAuto) {
      const oldest = autoBackups.shift();
      const folderPath = path.join(backupsDir, oldest.folder);
      fs.rmSync(folderPath, { recursive: true, force: true });
      console.log(`[BACKUP] Pruned old auto backup: ${oldest.folder}`);
    }

    while (manualBackups.length > maxManual) {
      const oldest = manualBackups.shift();
      const folderPath = path.join(backupsDir, oldest.folder);
      fs.rmSync(folderPath, { recursive: true, force: true });
      console.log(`[BACKUP] Pruned old manual backup: ${oldest.folder}`);
    }
  } catch (err) {
    console.error(`[BACKUP] Error pruning backups:`, err.message);
  }
}

function createBackup(isManual = false, manualLabel = '') {
  try {
    const baseDir = path.join(__dirname, '..');
    const dataDir = path.join(baseDir, 'data');
    const backupsDir = path.join(dataDir, 'backups');

    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }

    const now = Date.now();
    let backupFolderName = '';

    if (isManual) {
      const sanitizedLabel = (manualLabel || 'checkpoint').replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
      backupFolderName = `${now}_manual_${sanitizedLabel}`;
    } else {
      const folders = fs.readdirSync(backupsDir).filter(f => {
        try {
          const stats = fs.statSync(path.join(backupsDir, f));
          return stats.isDirectory() && f.includes('_auto');
        } catch {
          return false;
        }
      });

      let latestAutoTime = 0;
      let latestAutoFolder = '';

      folders.forEach(f => {
        const m = f.match(/^(\d+)_auto$/);
        if (m) {
          const t = parseInt(m[1], 10);
          if (t > latestAutoTime) {
            latestAutoTime = t;
            latestAutoFolder = f;
          }
        }
      });

      const throttleWindow = 2 * 60 * 1000; // 2 minutes
      if (latestAutoFolder && (now - latestAutoTime) < throttleWindow) {
        backupFolderName = latestAutoFolder;
        console.log(`[BACKUP] Reusing recent auto backup folder: ${backupFolderName}`);
      } else {
        backupFolderName = `${now}_auto`;
      }
    }

    const targetDir = path.join(backupsDir, backupFolderName);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const filesToCopy = ['daily_data.json', 'member_and_team_config.json', 'planning_types.json'];
    filesToCopy.forEach(fileName => {
      const srcPath = path.join(dataDir, fileName);
      const destPath = path.join(targetDir, fileName);
      if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
      }
    });

    console.log(`[BACKUP] Backup successful in folder: ${backupFolderName}`);

    pruneBackups(backupsDir);

    return backupFolderName;
  } catch (err) {
    console.error(`[BACKUP] Failed to create backup:`, err.message);
    return null;
  }
}

function listBackups() {
  const baseDir = path.join(__dirname, '..');
  const backupsDir = path.join(baseDir, 'data', 'backups');

  if (!fs.existsSync(backupsDir)) {
    return [];
  }

  const folders = fs.readdirSync(backupsDir).filter(f => {
    try {
      return fs.statSync(path.join(backupsDir, f)).isDirectory();
    } catch {
      return false;
    }
  });

  const backupsList = folders.map(f => {
    const parts = f.split('_');
    const timestamp = parseInt(parts[0], 10);
    if (isNaN(timestamp)) return null;

    const isManual = f.includes('_manual_');
    let label = 'Auto Save';
    if (isManual) {
      const labelPart = f.substring(f.indexOf('_manual_') + 8);
      label = labelPart.replace(/_/g, ' ');
      label = label.charAt(0).toUpperCase() + label.slice(1);
    }

    const d = new Date(timestamp);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    const formattedDate = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

    const folderPath = path.join(backupsDir, f);
    const files = fs.readdirSync(folderPath);

    return {
      id: f,
      timestamp,
      type: isManual ? 'manual' : 'auto',
      label,
      formattedDate,
      files
    };
  }).filter(b => b !== null);

  backupsList.sort((a, b) => b.timestamp - a.timestamp);
  return backupsList;
}

function restoreBackup(id) {
  const baseDir = path.join(__dirname, '..');
  const dataDir = path.join(baseDir, 'data');
  const backupsDir = path.join(dataDir, 'backups');
  const targetDir = path.join(backupsDir, id);

  if (!fs.existsSync(targetDir)) {
    throw new Error(`Backup ${id} not found`);
  }

  // Safety backup of current state
  createBackup(true, 'before_restoring_' + id.split('_').slice(1).join('_'));

  const files = fs.readdirSync(targetDir);
  files.forEach(fileName => {
    const srcPath = path.join(targetDir, fileName);
    const destPath = path.join(dataDir, fileName);
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath);
    }
  });

  console.log(`[BACKUP] Successfully restored system state to: ${id}`);
}

module.exports = {
  createBackup,
  listBackups,
  restoreBackup
};
