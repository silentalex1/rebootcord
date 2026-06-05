(function() {
  if (window.RebootFeedback) return;

  const style = document.createElement('style');
  style.textContent = `
    :root {
      --rbf-bg: #080808;
      --rbf-surface: #0f0f0f;
      --rbf-surface-2: #161616;
      --rbf-border: #1f1f1f;
      --rbf-border-bright: #2d2d2d;
      --rbf-text: #f4f4f4;
      --rbf-text-dim: #8a8a8a;
      --rbf-accent: #e63946;
      --rbf-accent-glow: rgba(230, 57, 70, 0.18);
      --rbf-green: #2ec27e;
      --rbf-blue: #5865f2;
      --rbf-radius: 10px;
      --rbf-transition: 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .rbf-feedback-btn {
      background: linear-gradient(135deg, var(--rbf-accent) 0%, #ff4d57 100%);
      color: #fff;
      padding: 12px 20px;
      border-radius: var(--rbf-radius);
      font-weight: 700;
      font-size: 13px;
      border: none;
      cursor: pointer;
      transition: var(--rbf-transition);
      box-shadow: 0 2px 12px var(--rbf-accent-glow), 0 0 0 1px rgba(230,57,70,0.1);
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      position: relative;
      overflow: hidden;
    }

    .rbf-feedback-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 20px var(--rbf-accent-glow), 0 0 0 2px rgba(230,57,70,0.15);
    }

    .rbf-feedback-btn::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 60%);
      pointer-events: none;
    }

    .rbf-feedback-btn.rbf-ghost {
      background: var(--rbf-surface);
      color: var(--rbf-text-dim);
      border: 1px solid var(--rbf-border);
      box-shadow: none;
    }

    .rbf-feedback-btn.rbf-ghost:hover {
      border-color: var(--rbf-border-bright);
      color: var(--rbf-text);
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      transform: none;
    }

    .rbf-feedback-btn.rbf-small {
      padding: 8px 14px;
      font-size: 12px;
    }

    .rbf-feedback-modal {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.7);
      backdrop-filter: blur(8px);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      animation: rbfModalIn 0.2s ease;
    }

    @keyframes rbfModalIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .rbf-modal-box {
      background: var(--rbf-surface);
      border: 1px solid var(--rbf-border-bright);
      border-radius: 16px;
      padding: 24px;
      width: 100%;
      max-width: 480px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.6);
      animation: rbfBoxIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      position: relative;
    }

    @keyframes rbfBoxIn {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }

    .rbf-modal-title {
      font-size: 18px;
      font-weight: 800;
      color: var(--rbf-text);
      margin-bottom: 16px;
    }

    .rbf-modal-desc {
      font-size: 14px;
      color: var(--rbf-text-dim);
      margin-bottom: 20px;
      line-height: 1.6;
    }

    .rbf-form-group {
      margin-bottom: 16px;
    }

    .rbf-label {
      display: block;
      font-size: 12px;
      font-weight: 700;
      color: var(--rbf-text-dim);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 8px;
    }

    .rbf-input, .rbf-textarea {
      width: 100%;
      background: var(--rbf-surface-2);
      border: 1px solid var(--rbf-border);
      border-radius: 8px;
      padding: 12px 16px;
      color: var(--rbf-text);
      font-size: 14px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      outline: none;
      transition: var(--rbf-transition);
      box-sizing: border-box;
    }

    .rbf-input:focus, .rbf-textarea:focus {
      border-color: var(--rbf-accent);
      box-shadow: 0 0 0 2px var(--rbf-accent-glow);
    }

    .rbf-textarea {
      min-height: 120px;
      resize: vertical;
    }

    .rbf-actions {
      display: flex;
      gap: 12px;
    }

    .rbf-cancel {
      flex: 1;
      background: var(--rbf-surface);
      border: 1px solid var(--rbf-border);
      color: var(--rbf-text-dim);
      padding: 10px;
      border-radius: 8px;
      font-weight: 700;
      cursor: pointer;
      transition: var(--rbf-transition);
    }

    .rbf-cancel:hover {
      background: var(--rbf-surface-2);
      color: var(--rbf-text);
    }

    .rbf-submit {
      flex: 2;
      background: linear-gradient(135deg, var(--rbf-accent) 0%, #ff4d57 100%);
      border: none;
      color: #fff;
      padding: 10px;
      border-radius: 8px;
      font-weight: 800;
      cursor: pointer;
      transition: var(--rbf-transition);
    }

    .rbf-submit:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px var(--rbf-accent-glow);
    }

    .rbf-close {
      position: absolute;
      top: 14px;
      right: 14px;
      background: rgba(255,255,255,0.04);
      border: 1px solid var(--rbf-border);
      color: var(--rbf-text-dim);
      font-size: 18px;
      cursor: pointer;
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      transition: var(--rbf-transition);
      line-height: 1;
      padding: 0;
      z-index: 10;
    }

    .rbf-close:hover {
      background: rgba(255,255,255,0.08);
      color: var(--rbf-text);
      border-color: var(--rbf-border-bright);
    }

    .rbf-chat-widget {
      position: fixed;
      bottom: 80px;
      right: 24px;
      width: 360px;
      height: 480px;
      background: var(--rbf-surface);
      border: 1px solid var(--rbf-border-bright);
      border-radius: 16px;
      box-shadow: 0 16px 48px rgba(0,0,0,0.6);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      z-index: 10001;
      animation: rbfWidgetIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    @keyframes rbfWidgetIn {
      from { opacity: 0; transform: scale(0.9) translateY(20px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }

    .rbf-widget-header {
      padding: 14px 16px;
      border-bottom: 1px solid var(--rbf-border);
      background: var(--rbf-surface-2);
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
    }

    .rbf-widget-header-left {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .rbf-widget-avatar {
      width: 28px;
      height: 28px;
      background: linear-gradient(135deg, var(--rbf-accent), #ff4d57);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      flex-shrink: 0;
    }

    .rbf-widget-title {
      font-size: 14px;
      font-weight: 700;
      color: var(--rbf-text);
    }

    .rbf-widget-subtitle {
      font-size: 11px;
      color: var(--rbf-text-dim);
      margin-top: 1px;
    }

    .rbf-widget-close {
      background: rgba(255,255,255,0.04);
      border: 1px solid var(--rbf-border);
      color: var(--rbf-text-dim);
      font-size: 16px;
      cursor: pointer;
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 7px;
      transition: var(--rbf-transition);
      line-height: 1;
      padding: 0;
      flex-shrink: 0;
    }

    .rbf-widget-close:hover {
      background: rgba(255,255,255,0.08);
      color: var(--rbf-text);
      border-color: var(--rbf-border-bright);
    }

    .rbf-widget-tabs {
      display: flex;
      padding: 8px 12px;
      gap: 4px;
      border-bottom: 1px solid var(--rbf-border);
      background: var(--rbf-surface-2);
      flex-shrink: 0;
    }

    .rbf-tab {
      padding: 5px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      border: none;
      background: transparent;
      color: var(--rbf-text-dim);
      transition: var(--rbf-transition);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .rbf-tab.active {
      background: var(--rbf-accent);
      color: #fff;
    }

    .rbf-tab:not(.active):hover {
      background: rgba(255,255,255,0.05);
      color: var(--rbf-text);
    }

    .rbf-widget-messages {
      flex: 1;
      overflow-y: auto;
      padding: 14px 14px 8px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      scroll-behavior: smooth;
    }

    .rbf-widget-messages::-webkit-scrollbar {
      width: 4px;
    }

    .rbf-widget-messages::-webkit-scrollbar-track {
      background: transparent;
    }

    .rbf-widget-messages::-webkit-scrollbar-thumb {
      background: var(--rbf-border-bright);
      border-radius: 4px;
    }

    .rbf-message {
      padding: 10px 14px;
      border-radius: 12px;
      font-size: 13px;
      line-height: 1.6;
      max-width: 88%;
      word-wrap: break-word;
    }

    .rbf-message-user {
      align-self: flex-end;
      background: linear-gradient(135deg, var(--rbf-blue) 0%, #6b7cff 100%);
      color: #fff;
      border-radius: 12px 12px 3px 12px;
    }

    .rbf-message-bot {
      align-self: flex-start;
      background: var(--rbf-surface-2);
      border: 1px solid var(--rbf-border);
      color: var(--rbf-text);
      border-radius: 3px 12px 12px 12px;
    }

    .rbf-message-bot-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--rbf-accent);
      display: block;
      margin-bottom: 4px;
    }

    .rbf-message-typing {
      align-self: flex-start;
      background: var(--rbf-surface-2);
      border: 1px solid var(--rbf-border);
      color: var(--rbf-text-dim);
      border-radius: 3px 12px 12px 12px;
      padding: 10px 14px;
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .rbf-typing-dots {
      display: flex;
      gap: 3px;
    }

    .rbf-typing-dots span {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: var(--rbf-text-dim);
      animation: rbfDot 1.2s infinite;
    }

    .rbf-typing-dots span:nth-child(2) { animation-delay: 0.2s; }
    .rbf-typing-dots span:nth-child(3) { animation-delay: 0.4s; }

    @keyframes rbfDot {
      0%, 60%, 100% { opacity: 0.3; transform: scale(1); }
      30% { opacity: 1; transform: scale(1.2); }
    }

    .rbf-help-btn-wrap {
      padding: 8px 14px;
      border-top: 1px solid var(--rbf-border);
      background: var(--rbf-surface-2);
      flex-shrink: 0;
    }

    .rbf-need-help-btn {
      width: 100%;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      border: 1px solid rgba(88,101,242,0.35);
      color: var(--rbf-blue-bright, #7289da);
      padding: 9px 14px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      transition: var(--rbf-transition);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }

    .rbf-need-help-btn:hover {
      background: linear-gradient(135deg, #1e1e3a 0%, #1a2550 100%);
      border-color: rgba(88,101,242,0.6);
      transform: translateY(-1px);
      box-shadow: 0 4px 14px rgba(88,101,242,0.15);
    }

    .rbf-need-help-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }

    .rbf-widget-input-area {
      padding: 10px 14px;
      border-top: 1px solid var(--rbf-border);
      background: var(--rbf-surface-2);
      display: flex;
      gap: 8px;
      flex-shrink: 0;
    }

    .rbf-widget-input {
      flex: 1;
      background: var(--rbf-surface);
      border: 1px solid var(--rbf-border);
      color: var(--rbf-text);
      padding: 9px 13px;
      border-radius: 8px;
      font-size: 13px;
      outline: none;
      transition: var(--rbf-transition);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .rbf-widget-input::placeholder {
      color: var(--rbf-text-muted, #4a4a4a);
    }

    .rbf-widget-input:focus {
      border-color: var(--rbf-accent);
      box-shadow: 0 0 0 2px var(--rbf-accent-glow);
    }

    .rbf-widget-send {
      background: var(--rbf-accent);
      border: none;
      color: #fff;
      padding: 9px 13px;
      border-radius: 8px;
      cursor: pointer;
      transition: var(--rbf-transition);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 15px;
      flex-shrink: 0;
    }

    .rbf-widget-send:hover {
      background: #ff4d57;
      transform: scale(1.05);
    }

    .rbf-widget-send:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }

    .rbf-hidden {
      display: none !important;
    }

    .rbf-status-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 10px;
      color: var(--rbf-green);
      font-weight: 600;
    }

    .rbf-status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--rbf-green);
      animation: rbfPulse 2s infinite;
    }

    @keyframes rbfPulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
  `;
  document.head.appendChild(style);

  let currentApiKey = '';
  let chatHistory = [];
  let isTyping = false;
  let helpRequested = false;

  function createFeedbackButton(options) {
    const config = options || {};
    currentApiKey = config.apiKey || '';
    const button = document.createElement('button');
    button.className = 'rbf-feedback-btn' + (config.ghost ? ' rbf-ghost' : '') + (config.small ? ' rbf-small' : '');
    button.innerHTML = config.label || 'Send Feedback';
    button.onclick = openFeedbackModal;
    return button;
  }

  function openFeedbackModal() {
    const overlay = document.createElement('div');
    overlay.className = 'rbf-feedback-modal';

    const box = document.createElement('div');
    box.className = 'rbf-modal-box';
    box.style.position = 'relative';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'rbf-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.onclick = function() { overlay.remove(); };

    const title = document.createElement('div');
    title.className = 'rbf-modal-title';
    title.textContent = 'Send Feedback';

    const desc = document.createElement('div');
    desc.className = 'rbf-modal-desc';
    desc.textContent = 'Share your thoughts and suggestions with us. Your feedback helps us improve the platform.';

    const formGroup = document.createElement('div');
    formGroup.className = 'rbf-form-group';

    const label = document.createElement('label');
    label.className = 'rbf-label';
    label.textContent = 'Message';

    const textarea = document.createElement('textarea');
    textarea.className = 'rbf-textarea';
    textarea.placeholder = 'Describe your feedback...';

    const emailGroup = document.createElement('div');
    emailGroup.className = 'rbf-form-group';

    const emailLabel = document.createElement('label');
    emailLabel.className = 'rbf-label';
    emailLabel.textContent = 'Email (optional)';

    const emailInput = document.createElement('input');
    emailInput.className = 'rbf-input';
    emailInput.type = 'email';
    emailInput.placeholder = 'your@email.com';

    const statusDiv = document.createElement('div');
    statusDiv.style.cssText = 'font-size:13px;padding:8px 12px;border-radius:6px;margin-top:10px;display:none;';

    const actions = document.createElement('div');
    actions.className = 'rbf-actions';
    actions.style.marginTop = '16px';

    const cancel = document.createElement('button');
    cancel.className = 'rbf-cancel';
    cancel.textContent = 'Cancel';
    cancel.onclick = function() { overlay.remove(); };

    const submit = document.createElement('button');
    submit.className = 'rbf-submit';
    submit.textContent = 'Submit';
    submit.onclick = async function() {
      const msg = textarea.value.trim();
      if (!msg || msg.length < 3) {
        statusDiv.style.display = 'block';
        statusDiv.style.cssText = 'font-size:13px;padding:8px 12px;border-radius:6px;margin-top:10px;background:rgba(230,57,70,0.1);border:1px solid rgba(230,57,70,0.2);color:#f08080;';
        statusDiv.textContent = 'Message too short.';
        return;
      }
      submit.disabled = true;
      submit.textContent = 'Sending...';
      try {
        const res = await fetch('/api/v1/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: msg, email: emailInput.value || '', type: 'user-feedback', page: location.pathname })
        });
        const data = await res.json();
        if (data.success) {
          statusDiv.style.cssText = 'font-size:13px;padding:8px 12px;border-radius:6px;margin-top:10px;background:rgba(46,194,126,0.1);border:1px solid rgba(46,194,126,0.2);color:#5de0a4;';
          statusDiv.style.display = 'block';
          statusDiv.textContent = 'Feedback received. Thank you!';
          setTimeout(function() { overlay.remove(); }, 1200);
        } else {
          statusDiv.style.cssText = 'font-size:13px;padding:8px 12px;border-radius:6px;margin-top:10px;background:rgba(230,57,70,0.1);border:1px solid rgba(230,57,70,0.2);color:#f08080;';
          statusDiv.style.display = 'block';
          statusDiv.textContent = data.message || 'Failed to send.';
          submit.disabled = false;
          submit.textContent = 'Submit';
        }
      } catch (e) {
        statusDiv.style.cssText = 'font-size:13px;padding:8px 12px;border-radius:6px;margin-top:10px;background:rgba(230,57,70,0.1);border:1px solid rgba(230,57,70,0.2);color:#f08080;';
        statusDiv.style.display = 'block';
        statusDiv.textContent = 'Network error. Try again.';
        submit.disabled = false;
        submit.textContent = 'Submit';
      }
    };

    formGroup.appendChild(label);
    formGroup.appendChild(textarea);
    emailGroup.appendChild(emailLabel);
    emailGroup.appendChild(emailInput);
    actions.appendChild(cancel);
    actions.appendChild(submit);

    box.appendChild(closeBtn);
    box.appendChild(title);
    box.appendChild(desc);
    box.appendChild(formGroup);
    box.appendChild(emailGroup);
    box.appendChild(statusDiv);
    box.appendChild(actions);

    overlay.appendChild(box);
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
    document.body.appendChild(overlay);

    setTimeout(function() { textarea.focus(); }, 100);
  }

  function addMessage(messagesEl, text, type) {
    const msg = document.createElement('div');
    if (type === 'user') {
      msg.className = 'rbf-message rbf-message-user';
      msg.textContent = text;
    } else {
      msg.className = 'rbf-message rbf-message-bot';
      const label = document.createElement('span');
      label.className = 'rbf-message-bot-label';
      label.textContent = 'rebootcord helper';
      const content = document.createElement('span');
      content.textContent = text;
      msg.appendChild(label);
      msg.appendChild(content);
    }
    messagesEl.appendChild(msg);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return msg;
  }

  function showTyping(messagesEl) {
    const typing = document.createElement('div');
    typing.className = 'rbf-message-typing';
    typing.id = 'rbf-typing';
    typing.innerHTML = '<span style="font-size:11px;color:var(--rbf-text-dim)">typing</span><div class="rbf-typing-dots"><span></span><span></span><span></span></div>';
    messagesEl.appendChild(typing);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return typing;
  }

  function removeTyping() {
    const t = document.getElementById('rbf-typing');
    if (t) t.remove();
  }

  async function sendAIMessage(userText, messagesEl, inputEl, sendBtn, helpBtn) {
    if (isTyping) return;
    isTyping = true;
    if (inputEl) inputEl.disabled = true;
    if (sendBtn) sendBtn.disabled = true;
    if (helpBtn) helpBtn.disabled = true;

    chatHistory.push({ role: 'user', content: userText });

    const typingEl = showTyping(messagesEl);

    try {
      const res = await fetch('/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gemini-2.0-flash',
          messages: [
            {
              role: 'system',
              content: 'You are the Rebootcord helper assistant. Rebootcord is a web hosting platform for Discord bots and other projects. You help users with questions about the platform, API setup, bot hosting, project management, and troubleshooting. Be helpful, concise, and friendly. Keep answers short and practical.'
            },
            ...chatHistory
          ],
          max_tokens: 512
        })
      });

      const data = await res.json();
      removeTyping();

      let replyText = '';
      if (data.choices && data.choices[0] && data.choices[0].message) {
        replyText = data.choices[0].message.content;
      } else if (data.error) {
        replyText = 'Something went wrong. Please try again.';
      } else {
        replyText = 'No response received.';
      }

      chatHistory.push({ role: 'assistant', content: replyText });
      addMessage(messagesEl, replyText, 'bot');
    } catch (e) {
      removeTyping();
      addMessage(messagesEl, 'Connection error. Please check your network and try again.', 'bot');
    }

    isTyping = false;
    if (inputEl) inputEl.disabled = false;
    if (sendBtn) sendBtn.disabled = false;
    if (helpBtn && !helpRequested) helpBtn.disabled = false;
  }

  function createChatWidget() {
    const widget = document.createElement('div');
    widget.className = 'rbf-chat-widget rbf-hidden';
    widget.id = 'rbf-feedback-widget';

    const header = document.createElement('div');
    header.className = 'rbf-widget-header';

    const headerLeft = document.createElement('div');
    headerLeft.className = 'rbf-widget-header-left';

    const avatar = document.createElement('div');
    avatar.className = 'rbf-widget-avatar';
    avatar.textContent = '🤖';

    const titleWrap = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'rbf-widget-title';
    title.textContent = 'rebootcord helper';
    const statusBadge = document.createElement('div');
    statusBadge.className = 'rbf-status-badge';
    statusBadge.innerHTML = '<span class="rbf-status-dot"></span> online';
    titleWrap.appendChild(title);
    titleWrap.appendChild(statusBadge);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'rbf-widget-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.setAttribute('aria-label', 'Close chat');
    closeBtn.onclick = function() {
      widget.classList.add('rbf-hidden');
    };

    headerLeft.appendChild(avatar);
    headerLeft.appendChild(titleWrap);
    header.appendChild(headerLeft);
    header.appendChild(closeBtn);

    const tabs = document.createElement('div');
    tabs.className = 'rbf-widget-tabs';

    const chatTab = document.createElement('button');
    chatTab.className = 'rbf-tab active';
    chatTab.textContent = 'Chat';

    const feedbackTab = document.createElement('button');
    feedbackTab.className = 'rbf-tab';
    feedbackTab.textContent = 'Feedback';

    tabs.appendChild(chatTab);
    tabs.appendChild(feedbackTab);

    const chatPanel = document.createElement('div');
    chatPanel.style.cssText = 'display:flex;flex-direction:column;flex:1;overflow:hidden;';

    const messages = document.createElement('div');
    messages.className = 'rbf-widget-messages';

    const welcomeMsg = document.createElement('div');
    welcomeMsg.className = 'rbf-message rbf-message-bot';
    const welcomeLabel = document.createElement('span');
    welcomeLabel.className = 'rbf-message-bot-label';
    welcomeLabel.textContent = 'rebootcord helper';
    const welcomeText = document.createElement('span');
    welcomeText.textContent = 'Hey! 👋 I\'m the Rebootcord AI assistant. Ask me anything about hosting bots, API setup, projects, or platform features.';
    welcomeMsg.appendChild(welcomeLabel);
    welcomeMsg.appendChild(welcomeText);
    messages.appendChild(welcomeMsg);

    const helpBtnWrap = document.createElement('div');
    helpBtnWrap.className = 'rbf-help-btn-wrap';

    const needHelpBtn = document.createElement('button');
    needHelpBtn.className = 'rbf-need-help-btn';
    needHelpBtn.innerHTML = '🙋 Need actual help? Click this.';
    needHelpBtn.onclick = async function() {
      if (helpRequested) return;
      helpRequested = true;
      needHelpBtn.disabled = true;
      needHelpBtn.textContent = 'Request sent...';

      addMessage(messages, 'I need to speak with an admin.', 'user');

      try {
        await fetch('/api/v1/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'User requested admin help via chat widget.', type: 'admin-help', page: location.pathname })
        });
      } catch (e) {}

      addMessage(messages, 'Please wait while an admin responds back.', 'bot');
      needHelpBtn.textContent = '✅ Admin notified';
    };

    helpBtnWrap.appendChild(needHelpBtn);

    const inputArea = document.createElement('div');
    inputArea.className = 'rbf-widget-input-area';

    const input = document.createElement('input');
    input.className = 'rbf-widget-input';
    input.placeholder = 'Ask about API setup...';
    input.setAttribute('autocomplete', 'off');

    const sendBtn = document.createElement('button');
    sendBtn.className = 'rbf-widget-send';
    sendBtn.innerHTML = '&#10148;';
    sendBtn.setAttribute('aria-label', 'Send message');

    const doSend = function() {
      const text = input.value.trim();
      if (!text || isTyping) return;
      addMessage(messages, text, 'user');
      input.value = '';
      sendAIMessage(text, messages, input, sendBtn, needHelpBtn);
    };

    sendBtn.onclick = doSend;
    input.onkeydown = function(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); } };

    inputArea.appendChild(input);
    inputArea.appendChild(sendBtn);

    const feedbackPanel = document.createElement('div');
    feedbackPanel.style.cssText = 'display:none;flex:1;flex-direction:column;padding:16px;gap:12px;overflow-y:auto;';

    const fbLabel = document.createElement('label');
    fbLabel.className = 'rbf-label';
    fbLabel.textContent = 'Your message';

    const fbTextarea = document.createElement('textarea');
    fbTextarea.className = 'rbf-textarea';
    fbTextarea.placeholder = 'Share feedback, report a bug, or suggest a feature...';
    fbTextarea.style.minHeight = '90px';

    const fbEmailLabel = document.createElement('label');
    fbEmailLabel.className = 'rbf-label';
    fbEmailLabel.style.marginTop = '4px';
    fbEmailLabel.textContent = 'Email (optional)';

    const fbEmail = document.createElement('input');
    fbEmail.className = 'rbf-input';
    fbEmail.type = 'email';
    fbEmail.placeholder = 'your@email.com';

    const fbStatus = document.createElement('div');
    fbStatus.style.display = 'none';

    const fbSubmit = document.createElement('button');
    fbSubmit.style.cssText = 'background:linear-gradient(135deg,var(--rbf-accent),#ff4d57);border:none;color:#fff;padding:10px 16px;border-radius:8px;font-weight:700;font-size:13px;cursor:pointer;margin-top:4px;';
    fbSubmit.textContent = 'Submit Feedback';
    fbSubmit.onclick = async function() {
      const msg = fbTextarea.value.trim();
      if (!msg || msg.length < 3) {
        fbStatus.style.cssText = 'display:block;font-size:12px;padding:7px 10px;border-radius:6px;background:rgba(230,57,70,0.1);border:1px solid rgba(230,57,70,0.2);color:#f08080;margin-top:4px;';
        fbStatus.textContent = 'Message too short.';
        return;
      }
      fbSubmit.disabled = true;
      fbSubmit.textContent = 'Sending...';
      try {
        const res = await fetch('/api/v1/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: msg, email: fbEmail.value || '', type: 'widget-feedback', page: location.pathname })
        });
        const data = await res.json();
        if (data.success) {
          fbStatus.style.cssText = 'display:block;font-size:12px;padding:7px 10px;border-radius:6px;background:rgba(46,194,126,0.1);border:1px solid rgba(46,194,126,0.2);color:#5de0a4;margin-top:4px;';
          fbStatus.textContent = 'Feedback sent. Thank you!';
          fbTextarea.value = '';
          fbEmail.value = '';
          fbSubmit.textContent = 'Submit Feedback';
          fbSubmit.disabled = false;
        } else {
          fbStatus.style.cssText = 'display:block;font-size:12px;padding:7px 10px;border-radius:6px;background:rgba(230,57,70,0.1);border:1px solid rgba(230,57,70,0.2);color:#f08080;margin-top:4px;';
          fbStatus.textContent = data.message || 'Failed to send.';
          fbSubmit.disabled = false;
          fbSubmit.textContent = 'Submit Feedback';
        }
      } catch (e) {
        fbStatus.style.cssText = 'display:block;font-size:12px;padding:7px 10px;border-radius:6px;background:rgba(230,57,70,0.1);border:1px solid rgba(230,57,70,0.2);color:#f08080;margin-top:4px;';
        fbStatus.textContent = 'Network error.';
        fbSubmit.disabled = false;
        fbSubmit.textContent = 'Submit Feedback';
      }
    };

    feedbackPanel.appendChild(fbLabel);
    feedbackPanel.appendChild(fbTextarea);
    feedbackPanel.appendChild(fbEmailLabel);
    feedbackPanel.appendChild(fbEmail);
    feedbackPanel.appendChild(fbStatus);
    feedbackPanel.appendChild(fbSubmit);

    chatTab.onclick = function() {
      chatTab.classList.add('active');
      feedbackTab.classList.remove('active');
      chatPanel.style.display = 'flex';
      feedbackPanel.style.display = 'none';
    };

    feedbackTab.onclick = function() {
      feedbackTab.classList.add('active');
      chatTab.classList.remove('active');
      chatPanel.style.display = 'none';
      feedbackPanel.style.display = 'flex';
    };

    chatPanel.appendChild(messages);
    chatPanel.appendChild(helpBtnWrap);
    chatPanel.appendChild(inputArea);

    widget.appendChild(header);
    widget.appendChild(tabs);
    widget.appendChild(chatPanel);
    widget.appendChild(feedbackPanel);

    document.body.appendChild(widget);
    return widget;
  }

  function openFeedbackWidget() {
    let widget = document.getElementById('rbf-feedback-widget');
    if (!widget) widget = createChatWidget();
    widget.classList.remove('rbf-hidden');
  }

  window.RebootFeedback = {
    init: function(options) {
      const config = options || {};
      currentApiKey = config.apiKey || '';

      if (config.button) {
        const existingButtons = document.querySelectorAll('[data-rbf-button]');
        existingButtons.forEach(function(btn) {
          const btnConfig = JSON.parse(btn.dataset.rbfConfig || '{}');
          const newBtn = createFeedbackButton(Object.assign({}, config, btnConfig));
          btn.parentNode.replaceChild(newBtn, btn);
        });
      }

      if (config.widget) {
        createChatWidget();
      }
    },
    createButton: createFeedbackButton,
    openWidget: openFeedbackWidget,
    openFeedbackModal: openFeedbackModal
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      window.RebootFeedback.init();
    });
  }
})();
