/**
 * AI Charming Chat Widget - Standalone Embed Script
 * Supports Real-Time SSE Streaming, Dynamic Theme Customization & Shadow DOM Isolation
 */
(function () {
  function initWidget() {
    if (document.getElementById('matcha-chatbot-widget-root')) {
      return;
    }
    if (!document.body) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initWidget);
      } else {
        setTimeout(initWidget, 50);
      }
      return;
    }

    // 1. Identify script element and extract configuration attributes
    let script = document.currentScript;
    if (!script) {
      const candidates = document.querySelectorAll(
        'script[data-bot-key], script[data-key], script[data-api-key], script[src*="widget.js"], script[src*="embed.js"]'
      );
      if (candidates.length > 0) {
        script = candidates[candidates.length - 1];
      }
    }

    const publicKey = script
      ? (
          script.getAttribute('data-bot-key') ||
          script.getAttribute('data-key') ||
          script.getAttribute('data-api-key') ||
          script.getAttribute('data-token') ||
          ''
        ).trim()
      : '';

    // Determine host origin for backend chat API
    let apiBaseUrl = '';
    if (script) {
      const explicitHost =
        script.getAttribute('data-api-host') ||
        script.getAttribute('data-host') ||
        script.getAttribute('data-origin');
      if (explicitHost) {
        apiBaseUrl = explicitHost.replace(/\/+$/, '');
      } else if (script.src) {
        try {
          const parsed = new URL(script.src, window.location.href);
          apiBaseUrl = parsed.origin;
        } catch (e) {
          apiBaseUrl = window.location.origin;
        }
      }
    }
    if (!apiBaseUrl) {
      apiBaseUrl = window.location.origin;
    }

    // Attribute overrides
    const attrPrimaryColor = script?.getAttribute('data-primary-color');
    const attrPosition = script?.getAttribute('data-position') || 'right';
    const attrBotName = script?.getAttribute('data-bot-name');
    const attrGreeting = script?.getAttribute('data-greeting');
    const attrQuickPrompts = script?.getAttribute('data-quick-prompts');
    const attrShowSources = script?.getAttribute('data-show-sources');

    // Sources citation visibility ("แหล่งข้อมูล:") - defaults to false
    let showSources = attrShowSources === 'true';

    // 2. Persistent session ID
    const sessionKey = `matcha_session_${publicKey.slice(0, 12) || 'default'}`;
    let sessionId = '';
    try {
      sessionId = localStorage.getItem(sessionKey);
      if (!sessionId) {
        sessionId = 'sess_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
        localStorage.setItem(sessionKey, sessionId);
      }
    } catch (e) {
      sessionId = 'sess_' + Math.random().toString(36).substring(2, 15);
    }

    // 3. Create host element and Shadow DOM
    const host = document.createElement('div');
    host.id = 'matcha-chatbot-widget-root';
    host.style.position = 'fixed';
    host.style.bottom = '24px';
    if (attrPosition === 'left') {
      host.style.left = '24px';
      host.style.right = 'auto';
    } else {
      host.style.right = '24px';
      host.style.left = 'auto';
    }
    host.style.zIndex = '2147483647';
    document.body.appendChild(host);

    const shadow = host.attachShadow({ mode: 'open' });

    // Initial styles with CSS variables for dynamic customization
    const primaryColor = attrPrimaryColor || '#334539';
    const style = document.createElement('style');
    style.id = 'widget-style';
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Prompt:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap');

      :host {
        --primary: ${primaryColor};
        --primary-hover: ${shadeColor(primaryColor, -15)};
        --primary-light: ${shadeColor(primaryColor, 40)};
      }

      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
        font-family: 'Prompt', 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        -webkit-font-smoothing: antialiased;
      }
      
      .widget-launcher {
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: var(--primary);
        color: #ffffff;
        border: none;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.22);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.25s;
        outline: none;
        position: relative;
      }
      .widget-launcher:hover {
        transform: scale(1.08);
        box-shadow: 0 12px 30px rgba(0, 0, 0, 0.28);
      }
      .widget-launcher:active {
        transform: scale(0.96);
      }
      .widget-launcher svg {
        width: 28px;
        height: 28px;
        fill: currentColor;
        transition: transform 0.25s ease;
      }

      .chat-window {
        position: absolute;
        bottom: 74px;
        ${attrPosition === 'left' ? 'left: 0;' : 'right: 0;'}
        width: 380px;
        max-width: calc(100vw - 32px);
        height: 610px;
        max-height: calc(100vh - 110px);
        background: #F9FAF8;
        border-radius: 20px;
        box-shadow: 0 16px 48px rgba(0, 0, 0, 0.18), 0 0 0 1px rgba(0, 0, 0, 0.05);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        opacity: 0;
        transform: translateY(20px) scale(0.95);
        transform-origin: ${attrPosition === 'left' ? 'bottom left' : 'bottom right'};
        pointer-events: none;
        transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      }

      .chat-window.open {
        opacity: 1;
        transform: translateY(0) scale(1);
        pointer-events: auto;
      }

      .chat-header {
        background: var(--primary);
        color: #ffffff;
        padding: 16px 18px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.06);
      }
      .bot-info {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .bot-avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.18);
        border: 2px solid rgba(255, 255, 255, 0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        font-size: 16px;
        overflow: hidden;
        color: #FFFFFF;
        flex-shrink: 0;
      }
      .bot-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .bot-details h4 {
        font-size: 15px;
        font-weight: 600;
        letter-spacing: -0.2px;
        line-height: 1.2;
      }
      .bot-status {
        font-size: 11.5px;
        color: rgba(255, 255, 255, 0.85);
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 2px;
      }
      .status-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: #34D399;
        box-shadow: 0 0 6px #34D399;
      }
      .close-btn {
        background: rgba(255, 255, 255, 0.12);
        border: none;
        color: #ffffff;
        cursor: pointer;
        padding: 7px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
      }
      .close-btn:hover {
        background: rgba(255, 255, 255, 0.25);
      }

      .chat-messages {
        flex: 1;
        padding: 16px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 12px;
        background: #F8FAF9;
        scroll-behavior: smooth;
      }
      .chat-messages::-webkit-scrollbar {
        width: 5px;
      }
      .chat-messages::-webkit-scrollbar-thumb {
        background: #CBD5E1;
        border-radius: 4px;
      }

      .msg {
        max-width: 85%;
        padding: 11px 15px;
        border-radius: 18px;
        font-size: 13.5px;
        line-height: 1.5;
        word-break: break-word;
        white-space: pre-wrap;
        animation: fadeInMsg 0.2s ease-out;
      }
      @keyframes fadeInMsg {
        from { opacity: 0; transform: translateY(6px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .msg.bot {
        align-self: flex-start;
        background: #FFFFFF;
        color: #1E293B;
        border-bottom-left-radius: 4px;
        border: 1px solid #E2E8F0;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03);
      }

      .msg.user {
        align-self: flex-end;
        background: var(--primary);
        color: #ffffff;
        border-bottom-right-radius: 4px;
        font-weight: 500;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
      }

      .msg.system-error {
        align-self: center;
        background: #FEF2F2;
        border: 1px solid #FECACA;
        color: #991B1B;
        font-size: 12px;
        text-align: center;
        max-width: 92%;
      }

      .sources-container {
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px solid #E2E8F0;
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        font-size: 11px;
      }
      .source-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 8px;
        background: #F1F5F9;
        color: #475569;
        border-radius: 12px;
        font-size: 10.5px;
        font-weight: 500;
      }

      /* Quick Prompts Bar */
      .quick-prompts-container {
        padding: 8px 14px;
        background: #F1F5F3;
        display: flex;
        gap: 8px;
        overflow-x: auto;
        white-space: nowrap;
        border-top: 1px solid #E5E9E7;
        scrollbar-width: none;
      }
      .quick-prompts-container::-webkit-scrollbar {
        display: none;
      }
      .quick-chip {
        display: inline-flex;
        align-items: center;
        padding: 5px 12px;
        background: #FFFFFF;
        color: #334155;
        border: 1px solid #CBD5E1;
        border-radius: 16px;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.15s ease;
        flex-shrink: 0;
      }
      .quick-chip:hover {
        background: var(--primary);
        color: #FFFFFF;
        border-color: var(--primary);
        transform: translateY(-1px);
      }

      .typing-indicator {
        align-self: flex-start;
        background: #FFFFFF;
        padding: 10px 16px;
        border-radius: 16px;
        border-bottom-left-radius: 4px;
        border: 1px solid #E2E8F0;
        display: none;
        align-items: center;
        gap: 5px;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03);
      }
      .typing-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--primary);
        opacity: 0.7;
        animation: typingBounce 1.4s infinite ease-in-out both;
      }
      .typing-dot:nth-child(1) { animation-delay: 0s; }
      .typing-dot:nth-child(2) { animation-delay: 0.2s; }
      .typing-dot:nth-child(3) { animation-delay: 0.4s; }

      @keyframes typingBounce {
        0%, 80%, 100% { transform: scale(0.6); opacity: 0.3; }
        40% { transform: scale(1.1); opacity: 1; }
      }

      .chat-input-area {
        padding: 12px 14px;
        background: #FFFFFF;
        border-top: 1px solid #E2E8F0;
        display: flex;
        gap: 8px;
        align-items: center;
      }
      .chat-input {
        flex: 1;
        background: #F8FAFC;
        border: 1px solid #CBD5E1;
        color: #0F172A;
        padding: 10px 14px;
        border-radius: 12px;
        font-size: 13.5px;
        outline: none;
        transition: border-color 0.2s, box-shadow 0.2s;
      }
      .chat-input:focus {
        border-color: var(--primary);
        background: #FFFFFF;
        box-shadow: 0 0 0 2px rgba(51, 69, 57, 0.15);
      }
      .send-btn {
        background: var(--primary);
        color: #FFFFFF;
        border: none;
        width: 40px;
        height: 40px;
        border-radius: 12px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s, transform 0.1s;
        flex-shrink: 0;
      }
      .send-btn:hover {
        background: var(--primary-hover);
      }
      .send-btn:active {
        transform: scale(0.95);
      }
      .send-btn svg {
        width: 18px;
        height: 18px;
        fill: currentColor;
      }
      .brand-footer {
        text-align: center;
        padding: 6px 0;
        background: #FFFFFF;
        font-size: 10px;
        color: #94A3B8;
        border-top: 1px solid #F1F5F9;
      }
      .brand-footer a {
        color: var(--primary);
        font-weight: 600;
        text-decoration: none;
      }
    `;

    function shadeColor(color, percent) {
      let num = parseInt(color.replace('#', ''), 16);
      if (isNaN(num)) return color;
      let amt = Math.round(2.55 * percent);
      let R = (num >> 16) + amt;
      let B = ((num >> 8) & 0x00FF) + amt;
      let G = (num & 0x0000FF) + amt;
      return (
        '#' +
        (
          0x1000000 +
          (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
          (B < 255 ? (B < 1 ? 0 : B) : 255) * 0x100 +
          (G < 255 ? (G < 1 ? 0 : G) : 255)
        )
          .toString(16)
          .slice(1)
      );
    }

    const container = document.createElement('div');
    container.innerHTML = `
      <div class="chat-window" id="chat-window">
        <div class="chat-header">
          <div class="bot-info">
            <div class="bot-avatar" id="bot-avatar">
              <span id="bot-avatar-initial">AI</span>
            </div>
            <div class="bot-details">
              <h4 id="bot-name">${attrBotName || 'AI Charming Assistant'}</h4>
              <div class="bot-status" id="bot-status">
                <span class="status-dot"></span> พร้อมให้บริการ 24 ชม.
              </div>
            </div>
          </div>
          <button class="close-btn" id="close-btn" aria-label="Close chat">
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div class="chat-messages" id="chat-messages">
          <div class="msg bot" id="initial-greeting">${attrGreeting || 'สวัสดีครับ! ยินดีต้อนรับ มีข้อมูลหรือบริการใดให้ช่วยเหลือไหมครับ?'}</div>
          <div class="typing-indicator" id="typing-indicator">
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
          </div>
        </div>

        <div class="quick-prompts-container" id="quick-prompts"></div>

        <div class="chat-input-area">
          <input type="text" class="chat-input" id="chat-input" placeholder="พิมพ์คำถามของคุณที่นี่..." />
          <button class="send-btn" id="send-btn" aria-label="Send message">
            <svg viewBox="0 0 24 24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        </div>

        <div class="brand-footer" id="brand-footer">
          ขับเคลื่อนโดย <a href="#" target="_blank">AI Charming Bot</a>
        </div>
      </div>

      <button class="widget-launcher" id="launcher-btn" aria-label="Open chat">
        <svg id="icon-chat" viewBox="0 0 24 24">
          <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"/>
        </svg>
        <svg id="icon-close" viewBox="0 0 24 24" style="display:none;" stroke="currentColor" stroke-width="2.5" fill="none">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    `;

    shadow.appendChild(style);
    shadow.appendChild(container);

    // Elements
    const launcherBtn = shadow.getElementById('launcher-btn');
    const chatWindow = shadow.getElementById('chat-window');
    const closeBtn = shadow.getElementById('close-btn');
    const iconChat = shadow.getElementById('icon-chat');
    const iconClose = shadow.getElementById('icon-close');
    const chatMessages = shadow.getElementById('chat-messages');
    const typingIndicator = shadow.getElementById('typing-indicator');
    const chatInput = shadow.getElementById('chat-input');
    const sendBtn = shadow.getElementById('send-btn');
    const botNameEl = shadow.getElementById('bot-name');
    const botStatusEl = shadow.getElementById('bot-status');
    const botAvatarEl = shadow.getElementById('bot-avatar');
    const botAvatarInitial = shadow.getElementById('bot-avatar-initial');
    const initialGreetingEl = shadow.getElementById('initial-greeting');
    const quickPromptsEl = shadow.getElementById('quick-prompts');

    let isOpen = false;
    let enableStreaming = true;

    // Toggle Chat
    const toggleChat = () => {
      isOpen = !isOpen;
      if (isOpen) {
        chatWindow.classList.add('open');
        iconChat.style.display = 'none';
        iconClose.style.display = 'block';
        setTimeout(() => chatInput.focus(), 150);
      } else {
        chatWindow.classList.remove('open');
        iconChat.style.display = 'block';
        iconClose.style.display = 'none';
      }
    };

    launcherBtn.addEventListener('click', toggleChat);
    closeBtn.addEventListener('click', toggleChat);

    const scrollToBottom = () => {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    };

    const showTyping = (show) => {
      if (show) {
        chatMessages.appendChild(typingIndicator);
        typingIndicator.style.display = 'flex';
      } else {
        typingIndicator.style.display = 'none';
      }
      scrollToBottom();
    };

    const renderQuickPrompts = (prompts) => {
      if (!Array.isArray(prompts) || prompts.length === 0) {
        quickPromptsEl.style.display = 'none';
        return;
      }
      quickPromptsEl.style.display = 'flex';
      quickPromptsEl.innerHTML = '';
      prompts.forEach((promptText) => {
        const chip = document.createElement('button');
        chip.className = 'quick-chip';
        chip.textContent = promptText;
        chip.addEventListener('click', () => {
          chatInput.value = promptText;
          handleSendMessage();
        });
        quickPromptsEl.appendChild(chip);
      });
    };

    // Apply Dynamic Theme Configuration
    const applyConfig = (cfg) => {
      if (!cfg) return;

      if (cfg.primaryColor) {
        style.textContent = style.textContent
          .replace(/--primary:\s*#[a-fA-F0-9]{3,6}/, `--primary: ${cfg.primaryColor}`)
          .replace(/--primary-hover:\s*#[a-fA-F0-9]{3,6}/, `--primary-hover: ${shadeColor(cfg.primaryColor, -15)}`);
      }

      if (cfg.botName && !attrBotName) {
        botNameEl.textContent = cfg.botName;
        if (botAvatarInitial) {
          botAvatarInitial.textContent = cfg.botName.slice(0, 2).toUpperCase();
        }
      }

      if (cfg.botSubtitle) {
        botStatusEl.innerHTML = `<span class="status-dot"></span> ${cfg.botSubtitle}`;
      }

      if (cfg.avatarUrl) {
        botAvatarEl.innerHTML = `<img src="${cfg.avatarUrl}" alt="Avatar" />`;
      }

      if (cfg.greetingMessage && !attrGreeting) {
        initialGreetingEl.textContent = cfg.greetingMessage;
      }

      if (cfg.placeholderText) {
        chatInput.placeholder = cfg.placeholderText;
      }

      if (cfg.quickPrompts && !attrQuickPrompts) {
        renderQuickPrompts(cfg.quickPrompts);
      }

      if (typeof cfg.enableStreaming === 'boolean') {
        enableStreaming = cfg.enableStreaming;
      }

      if (typeof cfg.showSources === 'boolean' && attrShowSources === null) {
        showSources = cfg.showSources;
      }
    };

    // Render initial quick prompts if provided via script tag
    if (attrQuickPrompts) {
      try {
        const parsed = attrQuickPrompts.startsWith('[') ? JSON.parse(attrQuickPrompts) : attrQuickPrompts.split(',').map((s) => s.trim());
        renderQuickPrompts(parsed);
      } catch (e) {
        renderQuickPrompts(attrQuickPrompts.split(',').map((s) => s.trim()));
      }
    }

    // Fetch dynamic bot config from server if publicKey is available
    if (publicKey) {
      fetch(`${apiBaseUrl}/api/widget/config?key=${encodeURIComponent(publicKey)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.config) {
            applyConfig(data.config);
          }
        })
        .catch(() => {
          // silently continue with defaults
        });
    }

    // Send Message with Real-Time SSE Streaming
    const handleSendMessage = async () => {
      const text = chatInput.value.trim();
      if (!text) return;

      // Add user message
      const userMsgDiv = document.createElement('div');
      userMsgDiv.className = 'msg user';
      userMsgDiv.textContent = text;
      chatMessages.insertBefore(userMsgDiv, typingIndicator);
      scrollToBottom();

      chatInput.value = '';
      chatInput.disabled = true;
      sendBtn.disabled = true;
      showTyping(true);

      const apiEndpoint = `${apiBaseUrl}/api/v1/widget/chat`;

      try {
        if (enableStreaming && typeof ReadableStream !== 'undefined') {
          // --- Real-Time Streaming Mode ---
          const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'text/event-stream',
            },
            body: JSON.stringify({
              publicKey: publicKey,
              message: text,
              sessionId: sessionId,
              stream: true,
            }),
          });

          if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            showTyping(false);
            const errDiv = document.createElement('div');
            errDiv.className = 'msg system-error';
            errDiv.textContent = errData.error || 'ขออภัยครับ เกิดข้อผิดพลาดในการเชื่อมต่อ';
            chatMessages.insertBefore(errDiv, typingIndicator);
            scrollToBottom();
            chatInput.disabled = false;
            sendBtn.disabled = false;
            chatInput.focus();
            return;
          }

          // Create streaming bot message bubble
          showTyping(false);
          const botMsgDiv = document.createElement('div');
          botMsgDiv.className = 'msg bot';
          chatMessages.insertBefore(botMsgDiv, typingIndicator);

          const reader = response.body.getReader();
          const decoder = new TextDecoder('utf-8');
          let partialChunk = '';
          let fullReply = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            partialChunk += chunk;

            const lines = partialChunk.split('\n');
            partialChunk = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed.startsWith('data:')) {
                const jsonStr = trimmed.slice(5).trim();
                if (!jsonStr) continue;
                try {
                  const eventData = JSON.parse(jsonStr);
                  if (eventData.type === 'chunk' && eventData.text) {
                    fullReply += eventData.text;
                    botMsgDiv.textContent = fullReply.replace(/\*\*/g, '');
                    scrollToBottom();
                  } else if (eventData.type === 'done') {
                    if (eventData.botName && !attrBotName) {
                      botNameEl.textContent = eventData.botName;
                    }
                    if (showSources && eventData.sources && eventData.sources.length > 0) {
                      const sourcesDiv = document.createElement('div');
                      sourcesDiv.className = 'sources-container';
                      sourcesDiv.innerHTML = `<span style="color:#64748B;font-weight:600;font-size:10px;">แหล่งข้อมูล:</span> ` +
                        eventData.sources
                          .map((s) => `<span class="source-badge">📄 ${s.title} (${s.relevance}%)</span>`)
                          .join(' ');
                      botMsgDiv.appendChild(sourcesDiv);
                      scrollToBottom();
                    }
                  } else if (eventData.type === 'error') {
                    botMsgDiv.className = 'msg system-error';
                    botMsgDiv.textContent = eventData.error || 'ระบบขัดข้องชั่วคราว';
                  }
                } catch (e) {
                  // Ignore JSON parse errors for incomplete chunks
                }
              }
            }
          }

          if (!fullReply.trim() && botMsgDiv.textContent === '') {
            botMsgDiv.textContent = 'ขออภัยครับ ไม่สามารถตอบกลับได้ในขณะนี้';
          }
        } else {
          // --- Non-Streaming Fallback Mode ---
          const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              publicKey: publicKey,
              message: text,
              sessionId: sessionId,
              stream: false,
            }),
          });

          const data = await response.json();
          showTyping(false);

          if (response.ok && data.reply) {
            if (data.botName && !attrBotName) {
              botNameEl.textContent = data.botName;
            }
            const botMsgDiv = document.createElement('div');
            botMsgDiv.className = 'msg bot';
            botMsgDiv.textContent = (data.reply || '').replace(/\*\*/g, '');

            if (showSources && data.sources && data.sources.length > 0) {
              const sourcesDiv = document.createElement('div');
              sourcesDiv.className = 'sources-container';
              sourcesDiv.innerHTML = `<span style="color:#64748B;font-weight:600;font-size:10px;">แหล่งข้อมูล:</span> ` +
                data.sources
                  .map((s) => `<span class="source-badge">📄 ${s.title} (${s.relevance}%)</span>`)
                  .join(' ');
              botMsgDiv.appendChild(sourcesDiv);
            }

            chatMessages.insertBefore(botMsgDiv, typingIndicator);
          } else {
            const errDiv = document.createElement('div');
            errDiv.className = 'msg system-error';
            errDiv.textContent = data.error || 'ขออภัยครับ เกิดข้อผิดพลาดในการเชื่อมต่อ';
            chatMessages.insertBefore(errDiv, typingIndicator);
          }
        }
      } catch (err) {
        showTyping(false);
        const errDiv = document.createElement('div');
        errDiv.className = 'msg system-error';
        errDiv.textContent = 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง';
        chatMessages.insertBefore(errDiv, typingIndicator);
      } finally {
        chatInput.disabled = false;
        sendBtn.disabled = false;
        scrollToBottom();
        chatInput.focus();
      }
    };

    sendBtn.addEventListener('click', handleSendMessage);
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSendMessage();
      }
    });
  }

  initWidget();
})();
