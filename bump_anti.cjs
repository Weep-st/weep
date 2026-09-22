const fs = require('fs');
const path = require('path');

// --- Wepi Antigravity (Pedidos) ---
const antiDir = path.join(process.cwd()); // We are in Wepi Antigravity
const antiPkg = path.join(antiDir, 'package.json');
const antiGradle = path.join(antiDir, 'android/app/build.gradle');
const antiPlist = path.join(antiDir, 'ios/App/App/Info.plist');

// 1. package.json
let p1 = fs.readFileSync(antiPkg, 'utf8');
p1 = p1.replace(/"version":\s*"[^"]+"/, '"version": "1.2.0"');
fs.writeFileSync(antiPkg, p1);

// 2. build.gradle
let g1 = fs.readFileSync(antiGradle, 'utf8');
g1 = g1.replace(/versionCode \d+/, 'versionCode 7');
g1 = g1.replace(/versionName "[^"]+"/, 'versionName "1.2.0"');
fs.writeFileSync(antiGradle, g1);

// 3. Info.plist
let i1 = fs.readFileSync(antiPlist, 'utf8');
i1 = i1.replace(/<key>CFBundleShortVersionString<\/key>\s*<string>[^<]+<\/string>/, '<key>CFBundleShortVersionString</key>\n\t<string>1.2.0</string>');
i1 = i1.replace(/<key>CFBundleVersion<\/key>\s*<string>[^<]+<\/string>/, '<key>CFBundleVersion</key>\n\t<string>7</string>');
fs.writeFileSync(antiPlist, i1);

console.log("Antigravity updated successfully");
