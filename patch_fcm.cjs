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


// Patch for CapacitorFirebaseAuthentication to enable GoogleSignIn in SPM
try {
  let pkg = fs.readFileSync('node_modules/@capacitor-firebase/authentication/Package.swift', 'utf-8');
  if (!pkg.includes('GoogleSignIn-iOS')) {
    pkg = pkg.replace(
      'dependencies: [',
      'dependencies: [\n        .package(url: "https://github.com/google/GoogleSignIn-iOS.git", from: "7.1.0"),'
    );
    pkg = pkg.replace(
      '.product(name: "FirebaseCore", package: "firebase-ios-sdk")',
      '.product(name: "FirebaseCore", package: "firebase-ios-sdk"),\n                .product(name: "GoogleSignIn", package: "GoogleSignIn-iOS")'
    );
    fs.writeFileSync('node_modules/@capacitor-firebase/authentication/Package.swift', pkg);
  }

  ['FirebaseAuthentication.swift', 'handlers/GoogleAuthProviderHandler.swift'].forEach(file => {
    let p = 'node_modules/@capacitor-firebase/authentication/ios/Plugin/' + file;
    let code = fs.readFileSync(p, 'utf-8');
    code = code.replace(/#if RGCFA_INCLUDE_GOOGLE/g, '#if true');
    fs.writeFileSync(p, code);
  });
} catch(e) {}
