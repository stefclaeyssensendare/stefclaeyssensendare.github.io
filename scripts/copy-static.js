// scripts/copy-static.js
const fs = require("fs");
const path = require("path");

const from = path.join(__dirname, "..", ".next", "static");
const to = path.join(__dirname, "..", "out", "nn-next", "_next", "static");

if (!fs.existsSync(from)) {
  console.error(".next/static does not exist. Did the build succeed?");
  process.exit(1);
}

fs.mkdirSync(to, { recursive: true });

const copyRecursive = (src, dest) => {
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
};

copyRecursive(from, to);
console.log("Copied .next/static -> out/nn-next/_next/static");
