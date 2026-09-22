const fs = require('fs');
const path = require('path');

// --- Wepi Repartidores ---
const repDir = path.join(process.cwd(), '../Wepi Repartidores');
const repPkg = path.join(repDir, 'package.json');
const repGradle = path.join(repDir, 'android/app/build.gradle');
const repPbxproj = path.join(repDir, 'ios/App/App.xcodeproj/project.pbxproj');

// 1. package.json
let p2 = fs.readFileSync(repPkg, 'utf8');
p2 = p2.replace(/"version":\s*"[^"]+"/, '"version": "1.2.0"');
fs.writeFileSync(repPkg, p2);

// 2. build.gradle
let g2 = fs.readFileSync(repGradle, 'utf8');
g2 = g2.replace(/versionCode \d+/, 'versionCode 9');
g2 = g2.replace(/versionName "[^"]+"/, 'versionName "1.2.0"');
fs.writeFileSync(repGradle, g2);

// 3. project.pbxproj
let i2 = fs.readFileSync(repPbxproj, 'utf8');
i2 = i2.replace(/MARKETING_VERSION = [^;]+;/g, 'MARKETING_VERSION = 1.2.0;');
i2 = i2.replace(/CURRENT_PROJECT_VERSION = [^;]+;/g, 'CURRENT_PROJECT_VERSION = 9;');
fs.writeFileSync(repPbxproj, i2);

console.log("Repartidores updated successfully");
