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
      top: 16px;
      right: 16px;
      background: transparent;
      border: none;
      color: var(--rbf-text-dim);
      font-size: 24px;
      cursor: pointer;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content:center;
      border-radius: 8px;
      transition: var(--rbf-transition);
    }

    .rbf-close:hover {
      background: var(--rbf-surface);
      color: var(--rbf-text);
    }

    .rbf-chat-widget {
      position: fixed;
      bottom: 80px;
      right: 24px;
      width: 350px;
      height: 450px;
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
      padding: 16px 20px;
      border-bottom: 1px solid var(--rbf-border);
      background: var(--rbf-surface-2);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .rbf-widget-title {
      font-size: 14px;
      font-weight: 700;
      color: var(--rbf-text);
    }

    .rbf-widget-close {
      background: transparent;
      border: none;
      color: var(--rbf-text-dim);
      font-size: 20px;
      cursor: pointer;
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content:center;
      border-radius: 6px;
      transition: var(--rbf-transition);
    }

    .rbf-widget-close:hover {
      background: var(--rbf-surface);
      color: var(--rbf-text);
    }

    .rbf-widget-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px 20px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .rbf-message {
      padding: 12px 16px;
      border-radius: 12px;
      font-size: 13px;
      line-height: 1.6;
      max-width: 85%;
    }

    .rbf-message-user {
      align-self: flex-end;
      background: linear-gradient(135deg, var(--rbf-accent) 0%, #ff4d57 100%);
      color: #fff;
    }

    .rbf-message-admin {
      align-self: flex-start;
      background: var(--rbf-surface-2);
      border: 1px solid var(--rbf-border);
      color: var(--rbf-text);
    }

    .rbf-message-admin::before {
      content: 'Admin';
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--rbf-accent);
      display: block;
      margin-bottom: 4px;
    }

    .rbf-widget-input-area {
      padding: 16px 20px;
      border-top: 1px solid var(--rbf-border);
      background: var(--rbf-surface-2);
      display: flex;
      gap: 8px;
    }

    .rbf-widget-input {
      flex: 1;
      background: var(--rbf-surface);
      border: 1px solid var(--rbf-border);
      color: var(--rbf-text);
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 13px;
      outline: none;
      transition: var(--rbf-transition);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .rbf-widget-input:focus {
      border-color: var(--rbf-accent);
      box-shadow: 0 0 0 2px var(--rbf-accent-glow);
    }

    .rbf-widget-send {
      background: var(--rbf-accent);
      border: none;
      color: #fff;
      padding: 10px 12px;
      border-radius: 8px;
      cursor: pointer;
      transition: var(--rbf-transition);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .rbf-widget-send:hover {
      background: #ff4d57;
    }

    .rbf-hidden {
      display: none !important;
    }
  `;
  document.head.appendChild(style);

  let currentApiKey = '';
  let feedbackWidgetOpen = false;
  let feedbackMessages = [];
  let currentChatId = null;

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
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'rbf-close';
    closeBtn.innerHTML = '×';
    closeBtn.onclick = () => document.body.removeChild(overlay);
    
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
    
    const actions = document.createElement('div');
    actions.className = 'rbf-actions';
    
    const cancel = document.createElement('button');
    cancel.className = 'rbf-cancel';
    cancel.textContent = 'Cancel';
    cancel.onclick = () => document.body.removeChild(overlay);
    
    const submit = document.createElement('button');
    submit.className = 'rbf-submit';
    submit.textContent = 'Submit';
    submit.onclick = () => submitFeedback(textarea.value, emailInput.value, () => document.body.removeChild(overlay));
    
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
    box.appendChild(actions);
    
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    
    setTimeout(() => textarea.focus(), 100);
  }

  async function submitFeedback(message, email, callback) {
    if (!message || message.trim().length === 0) {
      alert('Please enter a message');
      return;
    }
    
    try {
      const response = await fetch('/api/v1/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': currentApiKey ? `rc_live_${currentApiKey}` : ''
        },
        body: JSON.stringify({
          message: message.trim(),
          email: email || '',
          type: 'user-feedback'
        })
      });
      
      const data = await response.json();
      if (data.success) {
        alert('Thank you for your feedback!');
        if (callback) callback();
      } else {
        alert('Failed to submit feedback: ' + (data.message || 'Unknown error'));
      }
    } catch (error) {
      alert('Error submitting feedback. Please try again.');
    }
  }

  function createFeedbackWidget() {
    const widget = document.createElement('div');
    widget.className = 'rbf-chat-widget rbf-hidden';
    widget.id = 'rbf-feedback-widget';
    
    const header = document.createElement('div');
    header.className = 'rbf-widget-header';
    
    const title = document.createElement('div');
    title.className = 'rbf-widget-title';
    title.textContent = 'Support Chat';
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'rbf-widget-close';
    closeBtn.innerHTML = '×';
    closeBtn.onclick = () => {
      widget.classList.add('rbf-hidden');
    };
    
    const messages = document.createElement('div');
    messages.className = 'rbf-widget-messages';
    
    const inputArea = document.createElement('div');
    inputArea.className = 'rbf-widget-input-area';
    
    const input = document.createElement('input');
    input.className = 'rbf-widget-input';
    input.placeholder = 'Type your message...';
    
    const sendBtn = document.createElement('button');
    sendBtn.className = 'rbf-widget-send';
    sendBtn.innerHTML = '→';
    sendBtn.onclick = () => sendUserMessage(input.value);
    
    header.appendChild(title);
    header.appendChild(closeBtn);
    inputArea.appendChild(input);
    inputArea.appendChild(sendBtn);
    widget.appendChild(header);
    widget.appendChild(messages);
    widget.appendChild(inputArea);
    
    document.body.appendChild(widget);
    return widget;
  }

  function openFeedbackWidget() {
    const widget = document.getElementById('rbf-feedback-widget');
    if (widget) {
      widget.classList.remove('rbf-hidden');
    }
  }

  async function sendUserMessage(message) {
    if (!message || message.trim().length === 0) return;
    
    const widget = document.getElementById('rbf-feedback-widget');
    const messages = widget.querySelector('.rbf-widget-messages');
    
    const userMsg = document.createElement('div');
    userMsg.className = 'rbf-message rbf-message-user';
    userMsg.textContent = message;
    messages.appendChild(userMsg);
    
    try {
      const response = await fetch('/api/v1/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': currentApiKey ? `rc_live_${currentApiKey}` : ''
        },
        body: JSON.stringify({
          message: message.trim(),
          type: 'user-support'
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        const systemMsg = document.createElement('div');
        systemMsg.className = 'rbf-message rbf-message-admin';
        systemMsg.textContent = 'Thank you for reaching out! Our team will review your message and get back to you soon.';
        messages.appendChild(systemMsg);
      }
    } catch (error) {
      const errorMsg = document.createElement('div');
      errorMsg.className = 'rbf-message rbf-message-admin';
      errorMsg.textContent = 'Failed to send message. Please try again.';
      messages.appendChild(errorMsg);
    }
    
    messages.scrollTop = messages.scrollHeight;
  }

  window.RebootFeedback = {
    init: function(options) {
      const config = options || {};
      currentApiKey = config.apiKey || '';
      
      if (config.button) {
        const existingButtons = document.querySelectorAll('[data-rbf-button]');
        existingButtons.forEach(btn => {
          const btnConfig = JSON.parse(btn.dataset.rbfConfig || '{}');
          const newBtn = createFeedbackButton({ ...config, ...btnConfig });
          btn.parentNode.replaceChild(newBtn, btn);
        });
      }
      
      if (config.widget) {
        createFeedbackWidget();
      }
    },
    createButton: createFeedbackButton,
    submit: submitFeedback,
    openWidget: openFeedbackWidget
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.RebootFeedback.init();
    });
  }
})();