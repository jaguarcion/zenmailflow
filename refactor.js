const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else { 
            if (file.endsWith('route.js')) results.push(file);
        }
    });
    return results;
}

const files = walk('./app/api');
let count = 0;

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    if (content.includes('if (!isAuthenticated(request)) {')) {
        // Add import if missing
        if (!content.includes('checkFail2Ban')) {
            content = content.replace("import { isAuthenticated } from '@/lib/auth';", "import { isAuthenticated, checkFail2Ban } from '@/lib/auth';");
            content = content.replace("import { isAuthenticated } from \"@/lib/auth\";", "import { isAuthenticated, checkFail2Ban } from \"@/lib/auth\";");
            // Also replace relative imports if any
            content = content.replace(/import \{ isAuthenticated \} from ['"]\.\.\/\.\.\/.*?lib\/auth['"];/g, "import { isAuthenticated, checkFail2Ban } from '@/lib/auth';");
        }
        
        const replacement = `
    const authStatus = await checkFail2Ban(request);
    if (authStatus.banned) return NextResponse.json({ error: 'Banned for 24h' }, { status: 429 });
    if (!authStatus.isAuth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        `.trim();
        
        // This regex finds the if block safely, assuming it ends with a return and }
        content = content.replace(/if \(!isAuthenticated\(request\)\) \{[\s\S]*?return NextResponse\.json\([\s\S]*?\}, \{ status: 401 \}\n?\s*\);\n?\s*\}/g, replacement);
        // Sometimes the status might be on the same line
        content = content.replace(/if \(!isAuthenticated\(request\)\) \{[\s\S]*?return NextResponse\.json\([\s\S]*?status: 401 \}\);\n?\s*\}/g, replacement);
        
        fs.writeFileSync(file, content);
        count++;
    }
}

console.log(`Refactored ${count} files.`);
