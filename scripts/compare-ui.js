// Node.js script for automated UI quality comparison
// Requires: pngjs, pixelmatch, fs
// Usage: node compare-ui.js

const fs = require('fs');
const pixelmatch = require('pixelmatch');
const PNG = require('pngjs').PNG;

// 1. 스크린 이름으로 파일 매칭
const screenName = process.argv[2] || 'screen_CM_Confirmation';
const refImagePath = `screenshot/${screenName}_0000.png`;
const genImagePath = `output/${screenName}_react.png`;

if (!fs.existsSync(refImagePath)) {
  console.error('정답지 이미지가 없습니다:', refImagePath);
  process.exit(1);
}
if (!fs.existsSync(genImagePath)) {
  console.error('React 렌더링 결과 이미지가 없습니다:', genImagePath);
  process.exit(1);
}

// 2. 이미지 비교
const img1 = PNG.sync.read(fs.readFileSync(refImagePath));
const img2 = PNG.sync.read(fs.readFileSync(genImagePath));
const { width, height } = img1;
const diff = new PNG({ width, height });

const mismatch = pixelmatch(img1.data, img2.data, diff.data, width, height, { threshold: 0.1 });
const mismatchRate = (mismatch / (width * height)) * 100;

console.log(`Mismatch rate: ${mismatchRate.toFixed(2)}%`);
fs.writeFileSync(`output/${screenName}_diff.png`, PNG.sync.write(diff));

if (mismatchRate > 2) {
  console.log('변환 로직 개선 필요!');
} else {
  console.log('UI 품질 기준 통과!');
}
