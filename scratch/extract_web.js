const fs = require('fs');
const js = fs.readFileSync('C:/Users/petrm/.gemini/antigravity-ide/brain/8bf215bc-e1aa-498e-8057-89a4badbf56a/scratch/main_bundle.js', 'utf8');

// Look for image urls and product strings
const imgRegex = /static\/media\/[^"']+\.(?:png|jpg|jpeg|svg|webp)/g;
const images = Array.from(new Set(js.match(imgRegex) || []));
console.log('Images found:', images.length);
fs.writeFileSync('C:/Users/petrm/.gemini/antigravity-ide/brain/8bf215bc-e1aa-498e-8057-89a4badbf56a/scratch/images.json', JSON.stringify(images, null, 2));

// Search for product definitions (e.g. Balloon, Tube, Cube, Cloud, Flat Light, Underwater...)
const sections = [];
const keywordRegex = /("title":|"name":|"type":|"dimensions":|"power":|"category":|"description":)/g;
// Let's find arrays of objects
const matches = js.match(/\{"id":[0-9]+,"title":[^}]+\}/g) || js.match(/\{id:[0-9]+,title:[^}]+\}/g) || [];
console.log('JSON matches found:', matches.length);

// Let's find all text chunks in the bundle that look like product data
fs.writeFileSync('C:/Users/petrm/.gemini/antigravity-ide/brain/8bf215bc-e1aa-498e-8057-89a4badbf56a/scratch/sections.txt', matches.join('\n\n'));
