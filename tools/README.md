# Rebuilding the bundled Three.js
`frontend/static/js/vendor/three-bundle.js` is Three.js (MIT) + OrbitControls bundled as one offline script.
Only needed if you want to upgrade it:
```
npm i three@0.170.0 esbuild
npx esbuild tools/three_entry.js --bundle --minify --format=iife --outfile=frontend/static/js/vendor/three-bundle.js
```
