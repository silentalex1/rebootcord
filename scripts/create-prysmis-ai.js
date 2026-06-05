#!/usr/bin/env node
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const MODelfile = path.join(__dirname, '..', 'prysmis-ai.Modelfile');
const TARGET_MODEL = process.env.TARGET_OLLAMA_MODEL || 'prysmis-ai';
const BASE_FROM = process.env.OLLAMA_BASE_MODEL || 'llava:7b';

if (!fs.existsSync(MODelfile)) {
  console.error('Modelfile not found:', MODelfile);
  process.exit(1);
}

console.log('=== PrysmisAI Model Creator ===');
console.log('Modelfile:', MODelfile);
console.log('Target model name:', TARGET_MODEL);
console.log('Base (FROM):', BASE_FROM);
console.log('');

try {
  console.log('Ensuring base model is available (this may take time if not pulled)...');
  execSync(`ollama pull ${BASE_FROM}`, { stdio: 'inherit' });
} catch (e) {
  console.warn('ollama pull had issues (continuing):', e.message);
}

console.log('\nCreating / updating custom PrysmisAI model from Modelfile (this is the "fine-tune" step)...');
try {
  const cmd = `ollama create ${TARGET_MODEL} -f "${MODelfile}"`;
  console.log('> ' + cmd);
  execSync(cmd, { stdio: 'inherit' });
  console.log('\nSuccess! PrysmisAI model created: ' + TARGET_MODEL);
  console.log('You can now chat with it: ollama run ' + TARGET_MODEL);
  console.log('\nRecommended .env / shell:');
  console.log('  OLLAMA_VISION_MODEL=' + TARGET_MODEL);
  console.log('  AI_PROVIDER=ollama');
  console.log('  PORT=1000   # server now defaults to 1000');
  console.log('\nRestart the server (on port 1000) to pick up the new PrysmisAI model. It works on http://127.0.0.1:1000 and https://rebootcord.world.');
} catch (e) {
  console.error('\nollama create failed:', e.message);
  console.log('Make sure Ollama is running (ollama list should work) and the base model is pulled.');
  process.exit(1);
}
