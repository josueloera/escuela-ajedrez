const fs = require('fs');

console.log("Removing debug code from index.html...");

let html = fs.readFileSync('index.html', 'utf8');

// 1. Remove Debug Script Block
// Matches <script> ... // ON-SCREEN DEBUGGER ... </script>
// We use a regex that matches the specific comment inside a script tag
const debugScriptRegex = /<script>\s*\/\/ ON-SCREEN DEBUGGER[\s\S]*?<\/script>/;
if (debugScriptRegex.test(html)) {
    html = html.replace(debugScriptRegex, '');
    console.log("Removed Debug Script.");
} else {
    console.log("Debug Script not found.");
}

// 2. Remove Debug Console Div
// Matches <div id="debug-console" ... </div>
const debugDivRegex = /<div id="debug-console"[\s\S]*?>[\s\S]*?<\/div>/;
if (debugDivRegex.test(html)) {
    html = html.replace(debugDivRegex, '');
    console.log("Removed Debug Console Div.");
} else {
    console.log("Debug Console Div not found.");
}

// 3. Replace Verbal Error Check with Silent One
const errorCheckRegex = /<script>\s*\/\/ Verificación de Carga de Librerías[\s\S]*?<\/script>/;
const silentCheck = `<script>
        // Verificación de Carga (Silenciosa)
        window.addEventListener('load', function () {
            if (typeof io === 'undefined') {
                console.error("Critical: Socket.IO failed to load.");
            }
        });
    </script>`;

if (errorCheckRegex.test(html)) {
    html = html.replace(errorCheckRegex, silentCheck);
    console.log("Replaced Error Check.");
} else {
    console.log("Error Check block not found.");
}

fs.writeFileSync('index.html', html);
console.log("Cleanup complete.");
