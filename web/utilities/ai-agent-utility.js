/**
 * AI Agent Utility - Provides AI-powered assistance for story creation and editing
 * Supports OpenAI and Anthropic Claude APIs
 */
class AIAgentUtility {
    constructor() {
        this.apiProvider = 'openai'; // 'openai' or 'anthropic'
        this.apiKey = null;
        this.conversationHistory = [];
        this.currentStoryContext = null;
    }

    /**
     * Set the API provider and key
     * @param {string} provider - 'openai', 'anthropic', or 'glean'
     * @param {string} apiKey - API key for the provider
     */
    setAPICredentials(provider, apiKey) {
        this.apiProvider = provider;
        this.apiKey = apiKey;
    }

    /**
     * Check if API credentials are configured
     * @returns {boolean}
     */
    isConfigured() {
        return this.apiKey !== null && this.apiKey.trim() !== '';
    }

    /**
     * Set the current story context for the AI agent
     * @param {Object} story - Current story data
     */
    setStoryContext(story) {
        this.currentStoryContext = story;
        this.conversationHistory = [];
    }

    /**
     * Build system prompt based on story context
     * @returns {string}
     */
    buildSystemPrompt() {
        const context = this.currentStoryContext;
        
        let prompt = `You are an AI assistant helping a product team create and edit roadmap stories. 

Your role is to:
1. Help write clear, concise story titles
2. Generate actionable bullet points for story details
3. Suggest appropriate timelines and milestones
4. Help identify dependencies and risks
5. Provide guidance on IMO (Important Measurable Outcome) alignment

Story format:
- Title: Brief, action-oriented description
- Bullets: Key deliverables, technical details, or acceptance criteria
- Start/End dates: Timeline for completion
- IMO: Important Measurable Outcome number (if applicable)
- Status flags: Done, Cancelled, At Risk, New Story, Proposed, etc.

Current context:`;

        if (context) {
            prompt += `\nTeam: ${context.teamName || 'Unknown'}`;
            prompt += `\nEpic: ${context.epicName || 'Unknown'}`;
            if (context.title) prompt += `\nCurrent Title: ${context.title}`;
            if (context.bullets) prompt += `\nCurrent Bullets: ${context.bullets}`;
            if (context.startDate || context.startMonth) {
                prompt += `\nStart: ${context.startDate || context.startMonth}`;
            }
            if (context.endDate || context.endMonth) {
                prompt += `\nEnd: ${context.endDate || context.endMonth}`;
            }
            if (context.imo) prompt += `\nIMO: ${context.imo}`;
        }

        prompt += `\n\nProvide helpful, concise responses. When suggesting changes, format them clearly.`;
        
        return prompt;
    }

    /**
     * Send a message to the AI agent
     * @param {string} userMessage - Message from the user
     * @returns {Promise<string>} - AI response
     */
    async sendMessage(userMessage) {
        if (!this.isConfigured()) {
            throw new Error('AI Agent is not configured. Please set up your API key.');
        }

        // Add user message to history
        this.conversationHistory.push({
            role: 'user',
            content: userMessage
        });

        let response;
        
        try {
            if (this.apiProvider === 'openai') {
                response = await this.callOpenAI(userMessage);
            } else if (this.apiProvider === 'anthropic') {
                response = await this.callAnthropic(userMessage);
            } else if (this.apiProvider === 'glean') {
                response = await this.callGlean(userMessage);
            } else {
                throw new Error('Invalid API provider');
            }

            // Add assistant response to history
            this.conversationHistory.push({
                role: 'assistant',
                content: response
            });

            return response;
        } catch (error) {
            console.error('AI Agent error:', error);
            throw error;
        }
    }

    /**
     * Call OpenAI API
     * @param {string} userMessage - User message
     * @returns {Promise<string>}
     */
    async callOpenAI(userMessage) {
        const messages = [
            {
                role: 'system',
                content: this.buildSystemPrompt()
            },
            ...this.conversationHistory
        ];

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: messages,
                temperature: 0.7,
                max_tokens: 1500
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'OpenAI API request failed');
        }

        const data = await response.json();
        return data.choices[0].message.content;
    }

    /**
     * Call Anthropic Claude API
     * @param {string} userMessage - User message
     * @returns {Promise<string>}
     */
    async callAnthropic(userMessage) {
        const systemPrompt = this.buildSystemPrompt();
        
        // Convert conversation history to Anthropic format
        const messages = this.conversationHistory.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.content
        }));

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-3-sonnet-20240229',
                max_tokens: 1000,
                system: systemPrompt,
                messages: messages
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Anthropic API request failed');
        }

        const data = await response.json();
        return data.content[0].text;
    }

    /**
     * Call Glean AI Assistant API
     * @param {string} userMessage - User message
     * @returns {Promise<string>}
     */
    async callGlean(userMessage) {
        const systemPrompt = this.buildSystemPrompt();
        
        // Build the full prompt with system context
        const fullPrompt = `${systemPrompt}\n\nUser: ${userMessage}`;
        
        // Include conversation history
        let conversationContext = '';
        if (this.conversationHistory.length > 2) {
            // Include last few messages for context
            const recentHistory = this.conversationHistory.slice(-4);
            conversationContext = recentHistory.map(msg => 
                `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
            ).join('\n') + '\n\n';
        }

        const response = await fetch('https://app.glean.com/api/v1/search/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
                query: conversationContext + fullPrompt,
                useKnowledgeBase: true,
                maxResults: 5
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Glean API request failed');
        }

        const data = await response.json();
        
        // Extract the AI response from Glean's response format
        if (data.answer) {
            return data.answer;
        } else if (data.response) {
            return data.response;
        } else if (data.text) {
            return data.text;
        } else {
            throw new Error('Unexpected Glean API response format');
        }
    }

    /**
     * Get quick suggestions for common tasks
     * @param {string} suggestionType - Type of suggestion needed
     * @returns {Promise<string>}
     */
    async getQuickSuggestion(suggestionType) {
        const prompts = {
            'improve_title': 'Suggest a better, more action-oriented title for this story.',
            'add_bullets': 'Generate 3-5 bullet points describing key deliverables or acceptance criteria for this story.',
            'estimate_timeline': 'Based on the story description, suggest a realistic timeline (start and end dates).',
            'identify_risks': 'What potential risks or dependencies should we consider for this story?',
            'imo_alignment': 'How can this story be aligned with an IMO (Important Measurable Outcome)?',
            'acceptance_criteria': 'Generate clear acceptance criteria for this story.'
        };

        const prompt = prompts[suggestionType];
        if (!prompt) {
            throw new Error('Invalid suggestion type');
        }

        return await this.sendMessage(prompt);
    }

    /**
     * Apply AI suggestion to story fields
     * @param {string} suggestion - AI suggestion text
     * @param {string} field - Field to apply to ('title', 'bullets', 'timeline')
     * @returns {Object} - Parsed values to apply
     */
    parseAISuggestion(suggestion, field) {
        const result = {};

        if (field === 'title') {
            // Extract title from suggestion
            const titleMatch = suggestion.match(/(?:Title:|New title:)?\s*"?([^"\n]+)"?/i);
            if (titleMatch) {
                result.title = titleMatch[1].trim();
            }
        } else if (field === 'bullets') {
            // Extract bullet points
            const bullets = [];
            const lines = suggestion.split('\n');
            lines.forEach(line => {
                const bulletMatch = line.match(/^[\-\*•]\s*(.+)$/);
                if (bulletMatch) {
                    bullets.push(bulletMatch[1].trim());
                }
            });
            if (bullets.length > 0) {
                result.bullets = bullets.join('\n');
            }
        } else if (field === 'timeline') {
            // Extract dates from suggestion
            const startMatch = suggestion.match(/(?:Start|Begin|From):\s*([A-Za-z]+\s*\d+|\d+\/\d+\/\d+)/i);
            const endMatch = suggestion.match(/(?:End|Complete|To|By):\s*([A-Za-z]+\s*\d+|\d+\/\d+\/\d+)/i);
            
            if (startMatch) result.start = startMatch[1].trim();
            if (endMatch) result.end = endMatch[1].trim();
        }

        return result;
    }

    /**
     * Reset conversation history
     */
    resetConversation() {
        this.conversationHistory = [];
    }

    /**
     * Save API key to local storage
     * @param {string} provider - API provider
     * @param {string} apiKey - API key
     */
    static saveAPIKey(provider, apiKey) {
        try {
            localStorage.setItem(`aiAgent_${provider}_key`, apiKey);
        } catch (e) {
            console.warn('Could not save API key to localStorage:', e);
        }
    }

    /**
     * Load API key from local storage
     * @param {string} provider - API provider
     * @returns {string|null}
     */
    static loadAPIKey(provider) {
        try {
            return localStorage.getItem(`aiAgent_${provider}_key`);
        } catch (e) {
            console.warn('Could not load API key from localStorage:', e);
            return null;
        }
    }

    /**
     * Clear saved API keys
     */
    static clearAPIKeys() {
        try {
            localStorage.removeItem('aiAgent_openai_key');
            localStorage.removeItem('aiAgent_anthropic_key');
            localStorage.removeItem('aiAgent_glean_key');
        } catch (e) {
            console.warn('Could not clear API keys:', e);
        }
    }
}

// Export for both CommonJS and browser environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AIAgentUtility };
} else if (typeof window !== 'undefined') {
    window.AIAgentUtility = AIAgentUtility;
}

