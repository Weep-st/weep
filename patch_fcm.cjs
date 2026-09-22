const fs = require('fs');

let content = fs.readFileSync('node_modules/@capacitor-community/fcm/Package.swift', 'utf-8');
content = content.replace('.upToNextMajor(from: "11.6.0")', '.upToNextMajor(from: "12.0.0")');
content = content.replace('"11.6.0"..<"12.0.0"', '.upToNextMajor(from: "12.0.0")');
fs.writeFileSync('node_modules/@capacitor-community/fcm/Package.swift', content);

try {
  let podspec = fs.readFileSync('node_modules/@capacitor-community/fcm/CapacitorCommunityFcm.podspec', 'utf-8');
  podspec = podspec.replace(/s\.dependency 'Firebase\/Messaging', '~\> 11\.6\.0'/g, "s.dependency 'Firebase/Messaging', '~> 12.0'");
  fs.writeFileSync('node_modules/@capacitor-community/fcm/CapacitorCommunityFcm.podspec', podspec);
} catch(e) {}
