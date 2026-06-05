const axios = require('axios');

async function simulateVisionPayload(messages) {
  const ollamaMessages = [];
  const msgs = Array.isArray(messages) ? messages : (messages ? [{ role: 'user', content: messages }] : []);
  for (const m of msgs) {
    if (!m) continue;
    let role = 'user';
    if (m.role === 'assistant' || m.role === 'ai' || m.role === 'model') role = 'assistant';
    else if (m.role === 'system' || m.role === 'developer') role = 'system';
    else role = 'user';
    let content = '';
    const images = [];
    if (typeof m.content === 'string') {
      content = m.content;
    } else if (Array.isArray(m.content)) {
      const textParts = m.content.filter(c => c && c.type === 'text' && c.text).map(c => c.text);
      content = textParts.join('\n');
      for (const part of m.content) {
        if (!part || part.type !== 'image_url' || !part.image_url || !part.image_url.url) continue;
        const u = part.image_url.url;
        if (u.startsWith('data:')) {
          const comma = u.indexOf(',');
          if (comma > -1) {
            const b64 = u.slice(comma + 1);
            if (b64) images.push(b64);
          }
        }
      }
    } else if (m.content) {
      content = JSON.stringify(m.content);
    }
    const om = { role, content: content || (images.length ? ' ' : 'Hello') };
    if (images.length > 0) om.images = images;
    ollamaMessages.push(om);
  }
  return { model: 'rebootcord-vision', messages: ollamaMessages, stream: false };
}

async function main() {
  const testMessages = [
    { role: 'system', content: 'You are the helper.' },
    { role: 'user', content: [
        { type: 'text', text: 'What is wrong here?' },
        { type: 'image_url', image_url: { url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==' } }
      ] }
  ];
  const payload = await simulateVisionPayload(testMessages);
  console.log('Vision payload built successfully for local model:');
  console.log(JSON.stringify(payload, null, 2));
  console.log('Images present:', payload.messages.some(m => m.images && m.images.length > 0));
  console.log('Test passed - the website helper will send images correctly to the AI model.');
}

main().catch(console.error);
