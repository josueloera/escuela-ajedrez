const fs = require('fs');

console.log("Building single-file index.html...");

let html = fs.readFileSync('index.html', 'utf8');
let clientJs = fs.readFileSync('js/client.js', 'utf8');

// 1. Remove the "Error controlado" block which confuses things
const errorBlockRegex = /<script>\s*window\.onerror = function \(msg, url, line\) \{[\s\S]*?<\/script>/;
html = html.replace(errorBlockRegex, '');

// 2. Inject Client JS
// Find <script src="js/client.js"></script>
const scriptTag = '<script src="js/client.js"></script>';
const inlineScript = `<script>\n${clientJs}\n</script>`;

if (html.includes(scriptTag)) {
    html = html.replace(scriptTag, inlineScript);
    console.log("Inlined client.js successfully.");
} else {
    console.error("Could not find script tag for client.js");
}

// 3. Save
fs.writeFileSync('index.html', html);
console.log("Build complete: index.html updated.");
