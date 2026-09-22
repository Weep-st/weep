const fs = require('fs');
let content = fs.readFileSync('node_modules/@capacitor-community/fcm/Package.swift', 'utf-8');
content = content.replace('"11.6.0"..<"12.0.0"', '.upToNextMajor(from: "11.6.0")');
fs.writeFileSync('node_modules/@capacitor-community/fcm/Package.swift', content);
