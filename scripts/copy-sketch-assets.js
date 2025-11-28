// 이미지 파일을 Sketch 원본 폴더(GUI)에서 public/assets로 복사하는 스크립트
// 사용법: node scripts/copy-sketch-assets.js

const fs = require('fs');
const path = require('path');

// 원본 이미지 폴더 (Sketch 파일이 있는 곳)
const SRC_DIR = path.resolve(__dirname, '../../GUI');
// 복사 대상 폴더 (React 앱에서 접근 가능해야 함)
const DEST_DIR = path.resolve(__dirname, '../public/assets');

// 복사할 확장자
const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif'];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function copyImages(srcDir, destDir) {
  ensureDir(destDir);
  const files = fs.readdirSync(srcDir);
  let count = 0;
  files.forEach(file => {
    const ext = path.extname(file).toLowerCase();
    if (IMAGE_EXTS.includes(ext)) {
      const srcPath = path.join(srcDir, file);
      const destPath = path.join(destDir, file.replace(/ /g, ''));
      fs.copyFileSync(srcPath, destPath);
      count++;
      console.log(`Copied: ${file} -> ${destPath}`);
    }
  });
  if (count === 0) {
    console.log('No image files found in', srcDir);
  } else {
    console.log(`Total ${count} image(s) copied.`);
  }
}

copyImages(SRC_DIR, DEST_DIR);
