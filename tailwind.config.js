module.exports = {
  content: [
    './preview/**/*.{js,jsx,ts,tsx}',
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
    { pattern: /border-\[.*\]/ },
    { pattern: /rounded-\[.*px\]/ },
    { pattern: /font-\[.*\]/ },
    { pattern: /text-\[.*\]/ },
    { pattern: /opacity-\[.*\]/ }
  ]
}