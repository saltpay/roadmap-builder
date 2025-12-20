/**
 * AI Agent UI - User interface components for the AI Agent
 */
class AIAgentUI {
    constructor(aiAgentUtility) {
        this.agent = aiAgentUtility;
        this.chatContainer = null;
        this.isOpen = false;
        this.currentStoryCallback = null; // Callback to apply changes to story
    }

    /**
     * Initialize AI Agent UI and add to the page
     * @param {Function} applyChangesCallback - Callback function to apply AI suggestions to story form
     */
    initialize(applyChangesCallback) {
        this.currentStoryCallback = applyChangesCallback;
        this.createAIAgentHTML();
        this.attachEventListeners();
    }

    /**
     * Create the HTML structure for AI Agent
     */
    createAIAgentHTML() {
        // Remove existing AI agent if any
        const existing = document.getElementById('aiAgentContainer');
        if (existing) {
            existing.remove();
        }

        const html = `
            <div id="aiAgentContainer" class="ai-agent-container" style="display: none;">
                <div class="ai-agent-header">
                    <div class="ai-agent-title">
                        <span class="ai-agent-icon">🤖</span>
                        <span>AI Story Assistant</span>
                    </div>
                    <button class="ai-agent-close" id="aiAgentClose">✕</button>
                </div>
                
                <div class="ai-agent-status" id="aiAgentStatus">
                    <span class="status-indicator" id="aiStatusIndicator">●</span>
                    <span id="aiStatusText">Not configured</span>
                </div>

                <div class="ai-agent-quick-actions" id="aiQuickActions" style="display: none;">
                    <div class="quick-actions-title">Quick Actions:</div>
                    <button class="quick-action-btn" data-action="improve_title">✨ Improve Title</button>
                    <button class="quick-action-btn" data-action="add_bullets">📝 Generate Bullets</button>
                    <button class="quick-action-btn" data-action="estimate_timeline">📅 Suggest Timeline</button>
                    <button class="quick-action-btn" data-action="identify_risks">⚠️ Identify Risks</button>
                    <button class="quick-action-btn" data-action="acceptance_criteria">✓ Acceptance Criteria</button>
                </div>

                <div class="ai-agent-chat" id="aiAgentChat">
                    <div class="ai-chat-messages" id="aiChatMessages">
                        <div class="ai-message ai-welcome-message">
                            👋 Hi! I'm your AI Story Assistant. I can help you:
                            <ul>
                                <li>Write better story titles</li>
                                <li>Generate detailed bullet points</li>
                                <li>Suggest realistic timelines</li>
                                <li>Identify risks and dependencies</li>
                                <li>Create acceptance criteria</li>
                            </ul>
                            Use the Quick Actions above or ask me anything!
                        </div>
                    </div>
                    
                    <div class="ai-chat-input-container">
                        <textarea 
                            id="aiChatInput" 
                            class="ai-chat-input" 
                            placeholder="Ask me anything about this story..."
                            rows="2"
                        ></textarea>
                        <button id="aiSendBtn" class="ai-send-btn" title="Send message">
                            <span>Send</span>
                        </button>
                    </div>
                </div>

                <div class="ai-agent-config" id="aiAgentConfig">
                    <h4>⚙️ Configure AI Agent</h4>
                    <p class="config-description">To use the AI Story Assistant, you need to provide an API key:</p>
                    
                    <div class="config-provider-select">
                        <label>
                            <input type="radio" name="aiProvider" value="openai" checked> 
                            OpenAI (GPT-4)
                        </label>
                        <label>
                            <input type="radio" name="aiProvider" value="anthropic"> 
                            Anthropic (Claude)
                        </label>
                    </div>

                    <div class="config-input-group">
                        <label for="aiApiKeyInput">API Key:</label>
                        <input 
                            type="password" 
                            id="aiApiKeyInput" 
                            class="config-input" 
                            placeholder="Enter your API key..."
                        />
                        <small class="config-hint">
                            Your API key is stored locally and never sent to our servers.
                            <br>
                            Get your key: 
                            <a href="https://platform.openai.com/api-keys" target="_blank">OpenAI</a> | 
                            <a href="https://console.anthropic.com/settings/keys" target="_blank">Anthropic</a>
                        </small>
                    </div>

                    <div class="config-buttons">
                        <button id="aiSaveConfigBtn" class="config-save-btn">Save & Activate</button>
                        <button id="aiClearConfigBtn" class="config-clear-btn">Clear Saved Key</button>
                    </div>
                </div>
            </div>

            <!-- AI Agent Toggle Button (floating) -->
            <button id="aiAgentToggle" class="ai-agent-toggle" title="AI Story Assistant">
                🤖 AI Assistant
            </button>
        `;

        document.body.insertAdjacentHTML('beforeend', html);
    }

    /**
     * Attach event listeners to AI Agent UI elements
     */
    attachEventListeners() {
        // Toggle button
        document.getElementById('aiAgentToggle').addEventListener('click', () => {
            this.toggle();
        });

        // Close button
        document.getElementById('aiAgentClose').addEventListener('click', () => {
            this.close();
        });

        // Send message
        document.getElementById('aiSendBtn').addEventListener('click', () => {
            this.sendUserMessage();
        });

        // Enter key to send
        document.getElementById('aiChatInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendUserMessage();
            }
        });

        // Quick action buttons
        document.querySelectorAll('.quick-action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                this.handleQuickAction(action);
            });
        });

        // Config save button
        document.getElementById('aiSaveConfigBtn').addEventListener('click', () => {
            this.saveConfiguration();
        });

        // Config clear button
        document.getElementById('aiClearConfigBtn').addEventListener('click', () => {
            this.clearConfiguration();
        });

        // Provider selection
        document.querySelectorAll('input[name="aiProvider"]').forEach(radio => {
            radio.addEventListener('change', () => {
                // Clear API key input when switching providers
                document.getElementById('aiApiKeyInput').value = '';
            });
        });

        // Load saved configuration on initialization
        this.loadSavedConfiguration();
    }

    /**
     * Toggle AI Agent panel
     */
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    /**
     * Open AI Agent panel
     */
    open() {
        const container = document.getElementById('aiAgentContainer');
        container.style.display = 'flex';
        this.isOpen = true;

        // Focus on input if configured
        if (this.agent.isConfigured()) {
            setTimeout(() => {
                document.getElementById('aiChatInput').focus();
            }, 100);
        }
    }

    /**
     * Close AI Agent panel
     */
    close() {
        const container = document.getElementById('aiAgentContainer');
        container.style.display = 'none';
        this.isOpen = false;
    }

    /**
     * Send user message to AI
     */
    async sendUserMessage() {
        const input = document.getElementById('aiChatInput');
        const message = input.value.trim();

        if (!message) return;

        if (!this.agent.isConfigured()) {
            this.addMessage('system', '⚠️ Please configure your API key first.');
            return;
        }

        // Add user message to chat
        this.addMessage('user', message);
        input.value = '';

        // Show typing indicator
        this.showTypingIndicator();

        try {
            const response = await this.agent.sendMessage(message);
            this.hideTypingIndicator();
            this.addMessage('assistant', response);

            // Check if response contains actionable suggestions
            this.checkForActionableSuggestions(response);
        } catch (error) {
            this.hideTypingIndicator();
            this.addMessage('error', `Error: ${error.message}`);
        }
    }

    /**
     * Handle quick action buttons
     * @param {string} action - Action type
     */
    async handleQuickAction(action) {
        if (!this.agent.isConfigured()) {
            this.addMessage('system', '⚠️ Please configure your API key first.');
            return;
        }

        this.showTypingIndicator();

        try {
            const response = await this.agent.getQuickSuggestion(action);
            this.hideTypingIndicator();
            this.addMessage('assistant', response);

            // Offer to apply suggestions
            this.offerToApplySuggestion(response, action);
        } catch (error) {
            this.hideTypingIndicator();
            this.addMessage('error', `Error: ${error.message}`);
        }
    }

    /**
     * Add a message to the chat
     * @param {string} role - 'user', 'assistant', 'system', or 'error'
     * @param {string} content - Message content
     */
    addMessage(role, content) {
        const messagesContainer = document.getElementById('aiChatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `ai-message ai-message-${role}`;

        if (role === 'user') {
            messageDiv.innerHTML = `<div class="message-content">${this.escapeHtml(content)}</div>`;
        } else if (role === 'assistant') {
            messageDiv.innerHTML = `<div class="message-content">${this.formatAssistantMessage(content)}</div>`;
        } else if (role === 'system') {
            messageDiv.innerHTML = `<div class="message-content">${content}</div>`;
        } else if (role === 'error') {
            messageDiv.innerHTML = `<div class="message-content">${content}</div>`;
        }

        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    /**
     * Show typing indicator
     */
    showTypingIndicator() {
        const messagesContainer = document.getElementById('aiChatMessages');
        const indicator = document.createElement('div');
        indicator.className = 'ai-message ai-typing-indicator';
        indicator.id = 'typingIndicator';
        indicator.innerHTML = '<div class="typing-dots"><span>●</span><span>●</span><span>●</span></div>';
        messagesContainer.appendChild(indicator);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    /**
     * Hide typing indicator
     */
    hideTypingIndicator() {
        const indicator = document.getElementById('typingIndicator');
        if (indicator) {
            indicator.remove();
        }
    }

    /**
     * Check if AI response contains actionable suggestions
     * @param {string} response - AI response
     */
    checkForActionableSuggestions(response) {
        // Check for title suggestions
        if (response.toLowerCase().includes('title:') || response.toLowerCase().includes('new title')) {
            this.addApplyButton('title', response);
        }

        // Check for bullet suggestions
        if (response.includes('- ') || response.includes('• ')) {
            this.addApplyButton('bullets', response);
        }

        // Check for timeline suggestions
        if ((response.toLowerCase().includes('start:') && response.toLowerCase().includes('end:')) ||
            (response.toLowerCase().includes('timeline'))) {
            this.addApplyButton('timeline', response);
        }
    }

    /**
     * Offer to apply AI suggestion with a button
     * @param {string} suggestion - AI suggestion
     * @param {string} actionType - Type of action
     */
    offerToApplySuggestion(suggestion, actionType) {
        const fieldMap = {
            'improve_title': 'title',
            'add_bullets': 'bullets',
            'estimate_timeline': 'timeline',
            'acceptance_criteria': 'bullets'
        };

        const field = fieldMap[actionType];
        if (field) {
            this.addApplyButton(field, suggestion);
        }
    }

    /**
     * Add an "Apply" button to apply AI suggestions
     * @param {string} field - Field to apply to
     * @param {string} suggestion - Suggestion text
     */
    addApplyButton(field, suggestion) {
        const messagesContainer = document.getElementById('aiChatMessages');
        const lastMessage = messagesContainer.lastElementChild;

        // Check if apply button already exists
        if (lastMessage.querySelector('.apply-suggestion-btn')) {
            return;
        }

        const buttonDiv = document.createElement('div');
        buttonDiv.className = 'apply-suggestion-container';
        buttonDiv.innerHTML = `
            <button class="apply-suggestion-btn" data-field="${field}">
                ✨ Apply to ${field === 'title' ? 'Title' : field === 'bullets' ? 'Bullets' : 'Timeline'}
            </button>
        `;

        lastMessage.appendChild(buttonDiv);

        buttonDiv.querySelector('.apply-suggestion-btn').addEventListener('click', () => {
            this.applySuggestionToForm(field, suggestion);
            buttonDiv.remove();
        });
    }

    /**
     * Apply AI suggestion to the story form
     * @param {string} field - Field to apply to
     * @param {string} suggestion - Suggestion text
     */
    applySuggestionToForm(field, suggestion) {
        const parsed = this.agent.parseAISuggestion(suggestion, field);

        if (this.currentStoryCallback) {
            this.currentStoryCallback(parsed);
            this.addMessage('system', `✅ Applied suggestions to ${field}!`);
        } else {
            this.addMessage('error', '⚠️ Unable to apply suggestions. No callback function set.');
        }
    }

    /**
     * Save AI configuration
     */
    saveConfiguration() {
        const provider = document.querySelector('input[name="aiProvider"]:checked').value;
        const apiKey = document.getElementById('aiApiKeyInput').value.trim();

        if (!apiKey) {
            alert('Please enter an API key');
            return;
        }

        // Save to agent utility
        this.agent.setAPICredentials(provider, apiKey);

        // Save to localStorage
        AIAgentUtility.saveAPIKey(provider, apiKey);

        // Update UI
        this.updateStatus('ready', `Connected (${provider})`);
        document.getElementById('aiAgentConfig').style.display = 'none';
        document.getElementById('aiAgentChat').style.display = 'flex';
        document.getElementById('aiQuickActions').style.display = 'block';

        this.addMessage('system', `✅ AI Agent configured successfully using ${provider}!`);
    }

    /**
     * Clear saved configuration
     */
    clearConfiguration() {
        if (confirm('Are you sure you want to clear your saved API key?')) {
            AIAgentUtility.clearAPIKeys();
            this.agent.setAPICredentials(null, null);
            document.getElementById('aiApiKeyInput').value = '';
            this.updateStatus('not-configured', 'Not configured');
            this.addMessage('system', '🔓 API key cleared.');
        }
    }

    /**
     * Load saved configuration from localStorage
     */
    loadSavedConfiguration() {
        // Try OpenAI first
        let apiKey = AIAgentUtility.loadAPIKey('openai');
        let provider = 'openai';

        if (!apiKey) {
            // Try Anthropic
            apiKey = AIAgentUtility.loadAPIKey('anthropic');
            provider = 'anthropic';
        }

        if (apiKey) {
            this.agent.setAPICredentials(provider, apiKey);
            document.querySelector(`input[name="aiProvider"][value="${provider}"]`).checked = true;
            document.getElementById('aiAgentConfig').style.display = 'none';
            document.getElementById('aiAgentChat').style.display = 'flex';
            document.getElementById('aiQuickActions').style.display = 'block';
            this.updateStatus('ready', `Connected (${provider})`);
        } else {
            document.getElementById('aiAgentConfig').style.display = 'block';
            document.getElementById('aiAgentChat').style.display = 'none';
            document.getElementById('aiQuickActions').style.display = 'none';
            this.updateStatus('not-configured', 'Not configured');
        }
    }

    /**
     * Update status indicator
     * @param {string} status - 'ready', 'not-configured', 'error'
     * @param {string} text - Status text
     */
    updateStatus(status, text) {
        const indicator = document.getElementById('aiStatusIndicator');
        const statusText = document.getElementById('aiStatusText');

        indicator.className = `status-indicator status-${status}`;
        statusText.textContent = text;
    }

    /**
     * Format assistant message (preserve line breaks, bullets, etc.)
     * @param {string} content - Message content
     * @returns {string} - Formatted HTML
     */
    formatAssistantMessage(content) {
        // Escape HTML first
        let formatted = this.escapeHtml(content);

        // Convert line breaks to <br>
        formatted = formatted.replace(/\n/g, '<br>');

        // Make bullet points stand out
        formatted = formatted.replace(/^([-•*])\s/gm, '<span class="bullet-point">$1</span> ');

        return formatted;
    }

    /**
     * Escape HTML to prevent XSS
     * @param {string} text - Text to escape
     * @returns {string}
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Set the story context for the AI agent
     * @param {Object} story - Story data
     */
    setStoryContext(story) {
        this.agent.setStoryContext(story);
    }

    /**
     * Reset the conversation
     */
    resetConversation() {
        const messagesContainer = document.getElementById('aiChatMessages');
        messagesContainer.innerHTML = `
            <div class="ai-message ai-welcome-message">
                👋 Hi! I'm your AI Story Assistant. I can help you:
                <ul>
                    <li>Write better story titles</li>
                    <li>Generate detailed bullet points</li>
                    <li>Suggest realistic timelines</li>
                    <li>Identify risks and dependencies</li>
                    <li>Create acceptance criteria</li>
                </ul>
                Use the Quick Actions above or ask me anything!
            </div>
        `;
        this.agent.resetConversation();
    }
}

// Export for both CommonJS and browser environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AIAgentUI };
} else if (typeof window !== 'undefined') {
    window.AIAgentUI = AIAgentUI;
}

