import fs from 'fs';

const js = fs.readFileSync('C:/Users/petrm/.gemini/antigravity-ide/brain/8bf215bc-e1aa-498e-8057-89a4badbf56a/scratch/main_bundle.js', 'utf8');

// Find all image paths
const imgRegex = /static\/media\/[^"']+\.(?:png|jpg|jpeg|svg|webp)/g;
const images = Array.from(new Set(js.match(imgRegex) || []));
console.log('Images count:', images.length);
fs.writeFileSync('C:/Users/petrm/.gemini/antigravity-ide/brain/8bf215bc-e1aa-498e-8057-89a4badbf56a/scratch/images.json', JSON.stringify(images, null, 2));

// Search for product items or strings in the bundle
// Let's look for known keywords: Balloon, Tube, Cube, Cloud, Diamond, Flat Light, Pad Light, Underwater
const keywords = ['Sphere', 'Tube', 'Cube', 'Cloud', 'Diamond', 'Ellipse', 'No Gravity', 'Pad Light', 'Flat Light', 'Underwater', 'HMI', 'Tungsten', 'RGBWW'];

const productSnippets = [];
for (const kw of keywords) {
    let pos = 0;
    while ((pos = js.indexOf(kw, pos)) !== -1) {
        const start = Math.max(0, pos - 150);
        const end = Math.min(js.length, pos + 250);
        productSnippets.push({
            keyword: kw,
            snippet: js.slice(start, end)
        });
        pos += kw.length + 50;
    }
}

console.log('Found snippets:', productSnippets.length);
fs.writeFileSync('C:/Users/petrm/.gemini/antigravity-ide/brain/8bf215bc-e1aa-498e-8057-89a4badbf56a/scratch/snippets.json', JSON.stringify(productSnippets, null, 2));
