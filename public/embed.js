/**
 * NongGuide AI Chat Widget - Standalone Embed Script
 * Supports Real-Time SSE Streaming, Dynamic Theme Customization & Shadow DOM Isolation
 */
(function () {
  const currentScriptAtLoad = document.currentScript;

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
    let script = currentScriptAtLoad || document.currentScript;
    if (!script) {
      const candidates = document.querySelectorAll(
        'script[data-bot-key], script[data-api-key], script[data-key], script[data-public-key], script[data-token], script[data-bot], script[data-bot-id], script[src*="widget.js"], script[src*="embed.js"]'
      );
      if (candidates.length > 0) {
        script = candidates[candidates.length - 1];
      }
    }

    let scriptUrlParams = null;
    if (script && script.src) {
      try {
        scriptUrlParams = new URL(script.src, window.location.href).searchParams;
      } catch (e) {
        scriptUrlParams = null;
      }
    }

    const globalCfg =
      (typeof window !== 'undefined' && (window.NongGuideConfig || window.MatchaChatbotConfig)) || {};

    const publicKey = (
      (script &&
        (script.getAttribute('data-bot-key') ||
          script.getAttribute('data-api-key') ||
          script.getAttribute('data-key') ||
          script.getAttribute('data-public-key') ||
          script.getAttribute('data-token'))) ||
      (scriptUrlParams &&
        (scriptUrlParams.get('key') ||
          scriptUrlParams.get('apiKey') ||
          scriptUrlParams.get('botKey') ||
          scriptUrlParams.get('publicKey'))) ||
      globalCfg.apiKey ||
      globalCfg.publicKey ||
      globalCfg.botKey ||
      ''
    ).trim();

    const botId = (
      (script &&
        (script.getAttribute('data-bot') ||
          script.getAttribute('data-bot-id') ||
          script.getAttribute('data-botid'))) ||
      (scriptUrlParams && (scriptUrlParams.get('botId') || scriptUrlParams.get('bot'))) ||
      globalCfg.botId ||
      ''
    ).trim();

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
        width: 390px;
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
        padding: 15px 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.06);
      }
      .bot-info {
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 0;
      }
      .bot-details {
        min-width: 0;
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
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .bot-status {
        font-size: 11.5px;
        color: rgba(255, 255, 255, 0.85);
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 2px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .status-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: #34D399;
        box-shadow: 0 0 6px #34D399;
        flex-shrink: 0;
      }
      .header-actions {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-shrink: 0;
      }
      .header-btn,
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
        transition: background 0.2s, transform 0.15s;
      }
      .header-btn:hover,
      .close-btn:hover {
        background: rgba(255, 255, 255, 0.25);
      }
      .header-btn:active,
      .close-btn:active {
        transform: scale(0.92);
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
        scrollbar-width: thin;
        scrollbar-color: rgba(100, 116, 139, 0.28) transparent;
      }
      .chat-messages::-webkit-scrollbar {
        width: 5px;
      }
      .chat-messages::-webkit-scrollbar-track {
        background: transparent;
      }
      .chat-messages::-webkit-scrollbar-thumb {
        background: rgba(100, 116, 139, 0.28);
        border-radius: 9999px;
      }
      .chat-messages::-webkit-scrollbar-thumb:hover {
        background: rgba(100, 116, 139, 0.48);
      }

      .msg {
        position: relative;
        max-width: 86%;
        padding: 11px 15px;
        border-radius: 18px;
        font-size: 13.5px;
        line-height: 1.55;
        word-break: break-word;
        animation: msgSlideIn 0.24s cubic-bezier(0.16, 1, 0.3, 1);
      }
      @keyframes msgSlideIn {
        from { opacity: 0; transform: translateY(8px) scale(0.98); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }

      .msg.bot {
        align-self: flex-start;
        background: #FFFFFF;
        color: #1E293B;
        border-bottom-left-radius: 4px;
        border: 1px solid #E2E8F0;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03);
        padding-right: 15px;
      }
      .msg-content p {
        margin: 0 0 8px 0;
      }
      .msg-content p:last-child {
        margin-bottom: 0;
      }
      .msg-content ul {
        margin: 4px 0 8px 0;
        padding-left: 18px;
        list-style-type: disc;
      }
      .msg-content ul:last-child {
        margin-bottom: 0;
      }
      .msg-content li {
        margin-bottom: 4px;
      }
      .msg-content li:last-child {
        margin-bottom: 0;
      }
      .msg-content strong {
        font-weight: 600;
        color: #0F172A;
      }

      .msg-copy-btn {
        position: absolute;
        top: 6px;
        right: 6px;
        background: rgba(255, 255, 255, 0.92);
        border: 1px solid #E2E8F0;
        color: #64748B;
        border-radius: 8px;
        padding: 4px 6px;
        font-size: 10.5px;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        cursor: pointer;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.16s ease, background 0.15s ease, color 0.15s ease;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
      }
      .msg.bot:hover .msg-copy-btn,
      .msg.bot:focus-within .msg-copy-btn,
      .msg-copy-btn.copied {
        opacity: 1;
        pointer-events: auto;
      }
      .msg-copy-btn:hover {
        background: #F1F5F9;
        color: #0F172A;
      }
      .msg-copy-btn.copied {
        background: #ECFDF5;
        border-color: #A7F3D0;
        color: #047857;
      }

      .msg.user {
        align-self: flex-end;
        background: var(--primary);
        color: #ffffff;
        border-bottom-right-radius: 4px;
        font-weight: 500;
        white-space: pre-wrap;
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
        white-space: pre-wrap;
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
        -ms-overflow-style: none;
        scroll-behavior: smooth;
        -webkit-overflow-scrolling: touch;
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

      /* Mobile bottom-sheet adaptation (< 480px) */
      @media (max-width: 480px) {
        .chat-window {
          position: fixed;
          left: 0;
          right: 0;
          bottom: 0;
          width: 100vw;
          max-width: 100vw;
          height: 88vh;
          height: 88dvh;
          max-height: 92dvh;
          border-radius: 20px 20px 0 0;
          transform-origin: bottom center;
          box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.22);
        }
        .chat-window.open ~ .widget-launcher {
          opacity: 0;
          pointer-events: none;
          transform: scale(0.8);
        }
        .brand-footer {
          padding-bottom: max(8px, env(safe-area-inset-bottom));
        }
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
              <h4 id="bot-name">${attrBotName || 'NongGuide AI'}</h4>
              <div class="bot-status" id="bot-status">
                <span class="status-dot"></span> พร้อมให้บริการ 24 ชม.
              </div>
            </div>
          </div>
          <div class="header-actions">
            <button class="header-btn" id="clear-btn" title="เริ่มแชทใหม่" aria-label="Clear chat">
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                <path d="M3 3v5h5"></path>
              </svg>
            </button>
            <button class="close-btn" id="close-btn" title="ปิดหน้าต่างแชท" aria-label="Close chat">
              <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
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
          ขับเคลื่อนโดย <a href="#" target="_blank">NongGuide AI</a>
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
    const clearBtn = shadow.getElementById('clear-btn');
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
    let initialGreetingEl = shadow.getElementById('initial-greeting');
    const quickPromptsEl = shadow.getElementById('quick-prompts');

    let isOpen = false;
    let enableStreaming = true;
    let currentGreetingText = attrGreeting || 'สวัสดีครับ! ยินดีต้อนรับ มีข้อมูลหรือบริการใดให้ช่วยเหลือไหมครับ?';

    // XSS-safe basic Markdown renderer (**bold**, bullet lists, clean paragraphs)
    const escapeHtml = (str) =>
      String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const formatInlineMarkdown = (escapedLine) =>
      escapedLine.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    const renderMarkdownHtml = (rawText) => {
      const normalized = String(rawText || '').replace(/\r\n/g, '\n').trim();
      if (!normalized) return '';
      const blocks = normalized.split(/\n{2,}/);
      return blocks
        .map((block) => {
          const lines = block.split('\n');
          let html = '';
          let inList = false;
          let paraLines = [];

          const flushPara = () => {
            if (paraLines.length > 0) {
              html += `<p>${paraLines.map((l) => formatInlineMarkdown(escapeHtml(l))).join('<br>')}</p>`;
              paraLines = [];
            }
          };

          for (const rawLine of lines) {
            const trimmed = rawLine.trim();
            const bulletMatch = trimmed.match(/^(?:[-•*])\s+(.+)$/);
            if (bulletMatch) {
              flushPara();
              if (!inList) {
                html += '<ul>';
                inList = true;
              }
              html += `<li>${formatInlineMarkdown(escapeHtml(bulletMatch[1]))}</li>`;
            } else {
              if (inList) {
                html += '</ul>';
                inList = false;
              }
              if (trimmed) {
                paraLines.push(rawLine);
              }
            }
          }
          if (inList) html += '</ul>';
          flushPara();
          return html;
        })
        .join('');
    };

    const COPY_ICON_SVG = `<svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
    const CHECK_ICON_SVG = `<svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

    const attachCopyButton = (bubbleEl, getPlainText) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'msg-copy-btn';
      btn.title = 'คัดลอกข้อความ';
      btn.setAttribute('aria-label', 'Copy reply');
      btn.innerHTML = COPY_ICON_SVG;
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const plain = (typeof getPlainText === 'function' ? getPlainText() : String(getPlainText || '')).replace(/\*\*/g, '').trim();
        if (!plain) return;
        try {
          if (navigator?.clipboard?.writeText) {
            await navigator.clipboard.writeText(plain);
          } else {
            const ta = document.createElement('textarea');
            ta.value = plain;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
          }
          btn.classList.add('copied');
          btn.innerHTML = `${CHECK_ICON_SVG}<span>คัดลอกแล้ว</span>`;
          setTimeout(() => {
            btn.classList.remove('copied');
            btn.innerHTML = COPY_ICON_SVG;
          }, 1800);
        } catch {
          // ignore clipboard errors
        }
      });
      bubbleEl.appendChild(btn);
    };

    const createBotMessageBubble = (initialText) => {
      const bubble = document.createElement('div');
      bubble.className = 'msg bot';
      const contentEl = document.createElement('div');
      contentEl.className = 'msg-content';
      let currentRaw = initialText || '';
      if (currentRaw) {
        contentEl.innerHTML = renderMarkdownHtml(currentRaw);
      }
      bubble.appendChild(contentEl);
      attachCopyButton(bubble, () => currentRaw);
      return {
        bubble,
        contentEl,
        setText: (nextText) => {
          currentRaw = nextText || '';
          contentEl.innerHTML = renderMarkdownHtml(currentRaw);
        },
      };
    };

    // Upgrade initial greeting bubble with Markdown + copy button
    if (initialGreetingEl) {
      const greetingBubble = createBotMessageBubble(currentGreetingText);
      greetingBubble.bubble.id = 'initial-greeting';
      initialGreetingEl.replaceWith(greetingBubble.bubble);
      initialGreetingEl = greetingBubble.bubble;
      initialGreetingEl._setText = greetingBubble.setText;
    }

    // Smooth horizontal mouse-wheel scrolling on quick-prompt chips row
    quickPromptsEl.addEventListener(
      'wheel',
      (e) => {
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
          e.preventDefault();
          quickPromptsEl.scrollLeft += e.deltaY;
        }
      },
      { passive: false }
    );

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
        currentGreetingText = cfg.greetingMessage;
        if (initialGreetingEl && typeof initialGreetingEl._setText === 'function') {
          initialGreetingEl._setText(cfg.greetingMessage);
        } else if (initialGreetingEl) {
          initialGreetingEl.textContent = cfg.greetingMessage;
        }
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

    // Fetch dynamic bot config from server if publicKey or botId is available
    if (publicKey || botId) {
      const cfgParams = new URLSearchParams();
      if (publicKey) cfgParams.set('key', publicKey);
      if (botId) cfgParams.set('botId', botId);
      fetch(`${apiBaseUrl}/api/widget/config?${cfgParams.toString()}`, {
        headers: publicKey
          ? {
              'x-api-key': publicKey,
              Authorization: `Bearer ${publicKey}`,
            }
          : {},
      })
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

    // Conversation memory (sent to the server so follow-up questions keep context)
    const conversationHistory = [];
    const MAX_HISTORY_TURNS = 10;
    const rememberTurn = (userText, botText) => {
      if (!userText || !botText) return;
      conversationHistory.push({ role: 'user', text: userText });
      conversationHistory.push({ role: 'assistant', text: botText });
      while (conversationHistory.length > MAX_HISTORY_TURNS * 2) conversationHistory.shift();
    };

    // Clear chat handler (resets conversation back to welcome message)
    const handleClearChat = () => {
      conversationHistory.length = 0;
      showTyping(false);
      const children = Array.from(chatMessages.children);
      for (const child of children) {
        if (child !== typingIndicator) {
          chatMessages.removeChild(child);
        }
      }
      const greetingBubble = createBotMessageBubble(currentGreetingText);
      greetingBubble.bubble.id = 'initial-greeting';
      greetingBubble.bubble._setText = greetingBubble.setText;
      chatMessages.insertBefore(greetingBubble.bubble, typingIndicator);
      initialGreetingEl = greetingBubble.bubble;
      chatInput.value = '';
      chatInput.focus();
      scrollToBottom();
    };
    if (clearBtn) {
      clearBtn.addEventListener('click', handleClearChat);
    }

    // Send Message with Real-Time SSE Streaming
    const handleSendMessage = async () => {
      const text = chatInput.value.trim();
      if (!text) return;
      const historyPayload = conversationHistory.slice(-MAX_HISTORY_TURNS);

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
          const reqHeaders = {
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream',
          };
          if (publicKey) {
            reqHeaders['x-api-key'] = publicKey;
            reqHeaders['Authorization'] = `Bearer ${publicKey}`;
          }
          const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: reqHeaders,
            body: JSON.stringify({
              publicKey: publicKey,
              botKey: publicKey,
              apiKey: publicKey,
              botId: botId || undefined,
              message: text,
              sessionId: sessionId,
              history: historyPayload,
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
          const botBubble = createBotMessageBubble('');
          const botMsgDiv = botBubble.bubble;
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
                    botBubble.setText(fullReply);
                    scrollToBottom();
                  } else if (eventData.type === 'done') {
                    if (eventData.botName && !attrBotName) {
                      botNameEl.textContent = eventData.botName;
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

          if (!fullReply.trim() && botBubble.contentEl.textContent === '') {
            botBubble.setText('ขออภัยครับ ไม่สามารถตอบกลับได้ในขณะนี้');
          } else if (fullReply.trim() && botMsgDiv.className !== 'msg system-error') {
            rememberTurn(text, fullReply.replace(/\*\*/g, '').trim());
          }
        } else {
          // --- Non-Streaming Fallback Mode ---
          const fallbackHeaders = {
            'Content-Type': 'application/json',
          };
          if (publicKey) {
            fallbackHeaders['x-api-key'] = publicKey;
            fallbackHeaders['Authorization'] = `Bearer ${publicKey}`;
          }
          const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: fallbackHeaders,
            body: JSON.stringify({
              publicKey: publicKey,
              botKey: publicKey,
              apiKey: publicKey,
              botId: botId || undefined,
              message: text,
              sessionId: sessionId,
              history: historyPayload,
              stream: false,
            }),
          });

          const data = await response.json();
          showTyping(false);

          if (response.ok && data.reply) {
            if (data.botName && !attrBotName) {
              botNameEl.textContent = data.botName;
            }
            const botBubble = createBotMessageBubble(data.reply || '');
            const botMsgDiv = botBubble.bubble;

            chatMessages.insertBefore(botMsgDiv, typingIndicator);
            rememberTurn(text, (data.reply || '').replace(/\*\*/g, '').trim());
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
