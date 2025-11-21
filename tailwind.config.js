module.exports = {
  content: [
    './preview/**/*.{js,jsx,ts,tsx,html}',
    './src/**/*.{js,jsx,ts,tsx}',
    './index.html'
  ],
  safelist: [
    { pattern: /left-\[.*px\]/ },
    { pattern: /top-\[.*px\]/ },
    { pattern: /w-\[.*px\]/ },
    { pattern: /h-\[.*px\]/ },
    { pattern: /bg-\[.*\]/ },
    { pattern: /border-\[.*px\]/ },
    { pattern: /rounded-\[.*px\]/ },
    { pattern: /text-\[.*\]/ }
  ],
  theme: { extend: {} },
  plugins: []
}