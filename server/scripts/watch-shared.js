// Script to watch for changes in shared files

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

// Configuration
const config = {
  // Directories to watch
  watchDirs: [
    '../shared',
    './src/types'
  ],
  // File patterns to watch
  patterns: ['.ts', '.js', '.json'],
  // Command to run when changes are detected
  refreshCommand: process.platform === 'win32' 
    ? 'echo > .trigger-refresh' 
    : 'touch .trigger-refresh',
  // Debounce time in milliseconds
  debounceTime: 300
};

// Keep track of last change time to debounce
let lastChangeTime = 0;

function runRefreshCommand() {
  console.log('\n🔄 Shared code changed, triggering refresh...');
  try {
    childProcess.execSync(config.refreshCommand, {
      cwd: process.cwd(),
      stdio: 'inherit'
    });
    console.log('✅ Refresh triggered successfully\n');
  } catch (error) {
    console.error('❌ Error triggering refresh:', error.message);
  }
}

function shouldWatch(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return config.patterns.includes(ext);
}

function watchDirectory(dirPath) {
  const fullPath = path.resolve(__dirname, dirPath);
  
  try {
    if (!fs.existsSync(fullPath)) {
      console.log(`⚠️ Directory does not exist: ${fullPath}`);
      return;
    }
    
    console.log(`👀 Watching directory: ${fullPath}`);
    
    fs.watch(fullPath, { recursive: true }, (eventType, filename) => {
      if (!filename || !shouldWatch(filename)) return;
      
      const now = Date.now();
      if (now - lastChangeTime > config.debounceTime) {
        lastChangeTime = now;
        console.log(`📄 File changed: ${filename}`);
        runRefreshCommand();
      }
    });
  } catch (error) {
    console.error(`❌ Error watching directory ${fullPath}:`, error.message);
  }
}

// Main function
function main() {
  console.log('🚀 Starting shared code watcher...');
  
  // Watch each directory
  config.watchDirs.forEach(watchDirectory);
  
  console.log('✅ Watcher started. Press Ctrl+C to stop.');
}

main(); 