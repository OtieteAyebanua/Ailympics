import fs from 'fs';
let code = fs.readFileSync('src/hooks/useWallet.ts', 'utf8');
code = code.replace(
  "console.log('[Ailympics] Connecting with:', targetConnector.id, targetConnector.name);",
  "console.log('[Ailympics] All connectors:', connectors.map(c => ({ id: c.id, name: c.name, type: c.type })));\n    console.log('[Ailympics] Connecting with:', targetConnector.id, targetConnector.name);"
);
fs.writeFileSync('src/hooks/useWallet.ts', code);
