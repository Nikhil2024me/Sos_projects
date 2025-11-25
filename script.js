class SerialMonitor {
    constructor() {
        this.port = null;
        this.reader = null;
        this.isConnected = false;
        this.decoder = new TextDecoder();
        this.autoScroll = true;
        this.dataLog = [];
        
        this.connectBtn = document.getElementById('connectBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.autoScrollBtn = document.getElementById('autoScrollBtn');
        this.downloadBtn = document.getElementById('downloadBtn');
        this.terminal = document.getElementById('terminalContent');
        this.terminalWrapper = document.getElementById('terminal');
        this.statusText = document.getElementById('statusText');
        this.statusIndicators = [
            document.getElementById('statusIndicator'),
            document.getElementById('statusIndicator2')
        ];
        this.connectionSound = document.getElementById('connectionSound');
        this.emergencyOverlay = document.getElementById('emergencyOverlay');
        this.emergencyIcon = document.getElementById('emergencyIcon');
        this.emergencyTitle = document.getElementById('emergencyTitle');
        this.emergencyMessage = document.getElementById('emergencyMessage');
        this.acknowledgeBtn = document.getElementById('acknowledgeBtn');
        
        // Weather elements
        this.weatherWidget = document.getElementById('weatherWidget');
        this.weatherIcon = document.getElementById('weatherIcon');
        this.weatherLocation = document.getElementById('weatherLocation');
        this.weatherTemp = document.getElementById('weatherTemp');
        this.weatherWind = document.getElementById('weatherWind');
        this.weatherHumidity = document.getElementById('weatherHumidity');
        this.weatherFeels = document.getElementById('weatherFeels');
        this.weatherDescription = document.getElementById('weatherDescription');
        this.weatherVisibility = document.getElementById('weatherVisibility');
        this.weatherDewPoint = document.getElementById('weatherDewPoint');
        this.weatherUV = document.getElementById('weatherUV');
        this.weatherPressure = document.getElementById('weatherPressure');
        this.weatherCloudCover = document.getElementById('weatherCloudCover');
        this.weatherSolarRadiation = document.getElementById('weatherSolarRadiation');
        this.weatherEvaporation = document.getElementById('weatherEvaporation');
        
        // Meter elements
        this.tempValue = document.getElementById('tempValue');
        this.humidityValue = document.getElementById('humidityValue');
        this.phValue = document.getElementById('phValue');
        this.phStatus = document.getElementById('phStatus');
        this.tempMeterFill = document.getElementById('tempMeterFill');
        this.humidityMeterFill = document.getElementById('humidityMeterFill');
        this.phMeterFill = document.getElementById('phMeterFill');
        this.tempMeterDot = document.getElementById('tempMeterDot');
        this.humidityMeterDot = document.getElementById('humidityMeterDot');
        this.phMeterDot = document.getElementById('phMeterDot');
        
        // Crop recommendation elements
        this.cropWidget = document.getElementById('cropWidget');
        this.cropSeason = document.getElementById('cropSeason');
        this.cropRecommendations = document.getElementById('cropRecommendations');
        this.cropTips = document.getElementById('cropTips');
        this.tipContent = document.getElementById('tipContent');
        
        // Trends chart elements
        this.trendsCanvas = document.getElementById('sensorTrendsCanvas');
        this.trendsCtx = this.trendsCanvas?.getContext('2d');
        this.currentTrendSeries = 'temperature';
        this.trendData = {
            temperature: [],
            humidity: [],
            ph: [],
            labels: []
        };
        this.maxTrendPoints = 20;
        
        // AI Assistant elements
        this.aiAssistant = document.getElementById('aiAssistant');
        this.aiStatus = document.getElementById('aiStatus');
        this.aiOpenBtn = document.getElementById('aiOpenBtn');
        this.aiCloseBtn = document.getElementById('aiCloseBtn');
        this.aiClearChat = document.getElementById('aiClearChat');
        this.aiBody = document.getElementById('aiBody');
        this.aiChat = document.getElementById('aiChat');
        this.aiInput = document.getElementById('aiInput');
        this.aiSendBtn = document.getElementById('aiSendBtn');
        this.aiVisible = localStorage.getItem('aiVisible') !== 'false'; // Default to visible
        
        // Notification center elements
        this.notificationBell = document.getElementById('notificationBell');
        this.notificationBadge = document.getElementById('notificationBadge');
        this.notificationPanel = document.getElementById('notificationPanel');
        this.notificationList = document.getElementById('notificationList');
        this.clearNotifications = document.getElementById('clearNotifications');
        this.notifications = [];
        
        // Crop wiki elements
        this.cropWikiOverlay = document.getElementById('cropWikiOverlay');
        this.cropWikiClose = document.getElementById('cropWikiClose');
        this.cropWikiIcon = document.getElementById('cropWikiIcon');
        this.cropWikiTitle = document.getElementById('cropWikiTitle');
        this.cropWikiContent = document.getElementById('cropWikiContent');
        
        // Dynamic Island elements
        this.dynamicIsland = document.getElementById('dynamicIsland');
        this.islandContent = document.getElementById('islandContent');
        this.islandCompact = document.getElementById('islandCompact');
        this.islandConnection = document.getElementById('islandConnection');
        this.islandSensor = document.getElementById('islandSensor');
        this.islandEmergency = document.getElementById('islandEmergency');
        this.islandWeather = document.getElementById('islandWeather');
        this.islandData = document.getElementById('islandData');
        this.islandExpanded = document.getElementById('islandExpanded');
        this.islandAI = document.getElementById('islandAI');
        this.islandDownload = document.getElementById('islandDownload');
        this.islandClose = document.getElementById('islandClose');
        this.currentIslandState = 'compact';
        this.islandTimeout = null;
        
        // AI Mode elements
        this.aiModeSelector = document.getElementById('aiModeSelector');
        this.aiModeMenu = document.getElementById('aiModeMenu');
        this.currentAIMode = localStorage.getItem('sosAIMode') || 'sos';
        this.geminiApiKey = localStorage.getItem('geminiApiKey') || '';
        
        // API Key management elements
        this.apiKeyStatus = document.getElementById('apiKeyStatus');
        this.setApiKeyBtn = document.getElementById('setApiKeyBtn');
        this.viewApiKeyBtn = document.getElementById('viewApiKeyBtn');
        this.removeApiKeyBtn = document.getElementById('removeApiKeyBtn');
        
        // AI conversation history and context
        this.conversationHistory = [];
        this.userPreferences = this.loadUserPreferences();
        this.aiPersonality = {
            name: 'SOS AI',
            traits: ['helpful', 'knowledgeable', 'friendly', 'proactive'],
            expertise: ['serial communication', 'weather analysis', 'agriculture', 'emergency response']
        };
        this.learningData = {
            favoriteTopics: {},
            commonQuestions: {},
            userLocation: null,
            preferredCrops: [],
            lastInteractionTime: null,
            totalInteractions: 0
        };
        
        // Emergency keywords to monitor
        this.emergencyKeywords = {
            'land': { title: 'LANDING EMERGENCY', icon: '🛬', message: 'Emergency landing detected!', color: '#ef4444' },
            'any1': { title: 'EMERGENCY LEVEL 1', icon: '🚨', message: 'Priority 1 emergency detected!', color: '#f97316' },
            'any2': { title: 'EMERGENCY LEVEL 2', icon: '⚠️', message: 'Priority 2 emergency detected!', color: '#eab308' },
            'any3': { title: 'EMERGENCY LEVEL 3', icon: '⚡', message: 'Priority 3 emergency detected!', color: '#dc2626' },
            'emg|amb': { title: 'AMBULANCE EMERGENCY', icon: '🚑', message: 'Ambulance emergency detected!', color: '#dc2626' },
            'emg|fire': { title: 'FIRE EMERGENCY', icon: '🔥', message: 'Fire emergency detected!', color: '#ff4500' },
            'emg|pol': { title: 'POLICE EMERGENCY', icon: '👮', message: 'Police emergency detected!', color: '#1e40af' },
            'emg|emg': { title: 'CRITICAL EMERGENCY', icon: '🆘', message: 'Critical emergency situation!', color: '#b91c1c' }
        };

        this.initEventListeners();
        this.addScrollAnimation();
        this.initWeather();
        this.loadChatHistory();
        this.initMeters();
        this.initTrendsChart();
        this.initHourlyWeatherChart();
        this.updateAIModeUI();
        this.updateApiKeyStatus();
        this.initAIVisibility();
        this.initDynamicIsland();
        
        // Show welcome message after a short delay
        setTimeout(() => {
            this.showWelcomeMessage();
        }, 1500);
    }

    // Load user preferences from localStorage
    loadUserPreferences() {
        try {
            const saved = localStorage.getItem('sosConnectPreferences');
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (e) {
            console.error('Error loading preferences:', e);
        }
        return {};
    }

    // Save user preferences to localStorage
    saveUserPreferences(key, value) {
        try {
            this.userPreferences[key] = value;
            localStorage.setItem('sosConnectPreferences', JSON.stringify(this.userPreferences));
        } catch (e) {
            console.error('Error saving preferences:', e);
        }
    }

    // Load chat history from localStorage
    loadChatHistory() {
        try {
            const saved = localStorage.getItem('sosConnectChatHistory');
            if (saved) {
                const history = JSON.parse(saved);
                this.conversationHistory = history.slice(-50); // Keep last 50 messages
                
                // Restore visible chat messages safely
                if (this.aiChat) {
                    this.conversationHistory.forEach(msg => {
                        if (msg.role === 'user' || msg.role === 'assistant') {
                            const messageDiv = document.createElement('div');
                            messageDiv.className = `ai-message ai-${msg.role}-message`;
                            messageDiv.innerHTML = `
                                <div class="message-avatar">${msg.role === 'user' ? '👤' : '🤖'}</div>
                                <div class="message-content">${msg.message}</div>
                            `;
                            this.aiChat.appendChild(messageDiv);
                        }
                    });
                    
                    if (this.conversationHistory.length > 0) {
                        this.aiChat.scrollTop = this.aiChat.scrollHeight;
                    }
                }
            }
        } catch (e) {
            console.error('Error loading chat history:', e);
        }
    }

    // Save chat history to localStorage
    saveChatHistory() {
        try {
            localStorage.setItem('sosConnectChatHistory', JSON.stringify(this.conversationHistory));
        } catch (e) {
            console.error('Error saving chat history:', e);
        }
    }

    // Learn from user interactions
    learnFromInteraction(question, response) {
        try {
            // Show learning text
            if (this.aiStatus) {
                this.aiStatus.textContent = 'Learning...';
            }
            
            // Track favorite topics
            const topics = ['weather', 'crop', 'plant', 'emergency', 'connect', 'data'];
            topics.forEach(topic => {
                if (question.toLowerCase().includes(topic)) {
                    this.learningData.favoriteTopics[topic] = (this.learningData.favoriteTopics[topic] || 0) + 1;
                }
            });

            // Track common questions
            const questionKey = question.toLowerCase().substring(0, 50);
            this.learningData.commonQuestions[questionKey] = (this.learningData.commonQuestions[questionKey] || 0) + 1;

            // Update interaction stats
            this.learningData.totalInteractions++;
            this.learningData.lastInteractionTime = Date.now();

            // Save learning data
            localStorage.setItem('sosConnectLearning', JSON.stringify(this.learningData));
            
            // Stop learning after 10 seconds
            setTimeout(() => {
                if (this.aiStatus) {
                    this.aiStatus.textContent = this.currentAIMode === 'gemini' ? 'Powered by Gemini' : '';
                }
            }, 10000);
        } catch (e) {
            console.error('Error in learning:', e);
        }
    }

    // Get personalized greeting based on learning
    getPersonalizedGreeting() {
        const hour = new Date().getHours();
        const timeGreeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
        
        const favoriteTopic = Object.keys(this.learningData.favoriteTopics).sort((a, b) => 
            this.learningData.favoriteTopics[b] - this.learningData.favoriteTopics[a]
        )[0];

        let personalNote = '';
        if (this.learningData.totalInteractions > 10) {
            personalNote = ` We've had ${this.learningData.totalInteractions} great conversations!`;
        }
        if (favoriteTopic) {
            personalNote += ` I noticed you're interested in ${favoriteTopic}. `;
        }

        return `${timeGreeting}!${personalNote}`;
    }

    showWelcomeMessage() {
        // Only show if no chat history
        if (this.conversationHistory.length === 0) {
            const greeting = this.getPersonalizedGreeting();
            const welcomeMsg = `<strong>${greeting}</strong><br><br>I'm <strong>SOS AI</strong>. I can help with:<br>
                • 🔌 Serial device connections<br>
                • 🌤️ Weather information and analysis<br>
                • 🌾 Crop recommendations for Indian seasons<br>
                • 🚨 Emergency alert management<br>
                • 📊 Data logging and analysis<br><br>
                Ask me anything! I learn from our conversations to better assist you.`;
            this.addAIMessageWithTyping(welcomeMsg, 'assistant');
        }
    }

    initEventListeners() {
        // Add null checks to prevent errors if elements don't exist
        this.connectBtn?.addEventListener('click', () => {
            if (this.isConnected) {
                this.disconnect();
            } else {
                this.connect();
            }
        });

        this.clearBtn?.addEventListener('click', () => {
            this.clearTerminal();
        });

        this.autoScrollBtn?.addEventListener('click', () => {
            this.toggleAutoScroll();
        });

        this.downloadBtn?.addEventListener('click', () => {
            this.downloadLog();
        });

        this.acknowledgeBtn?.addEventListener('click', () => {
            this.closeEmergencyAlert();
        });

        this.aiOpenBtn?.addEventListener('click', () => {
            this.openAI();
        });

        this.aiCloseBtn?.addEventListener('click', () => {
            this.closeAI();
        });

        this.aiClearChat?.addEventListener('click', () => {
            this.clearChatHistory();
        });

        this.aiSendBtn?.addEventListener('click', () => {
            this.sendAIMessage();
        });

        this.aiInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendAIMessage();
            }
        });

        this.notificationBell?.addEventListener('click', () => {
            this.toggleNotificationPanel();
        });

        this.clearNotifications?.addEventListener('click', () => {
            this.clearAllNotifications();
        });

        this.cropWikiClose?.addEventListener('click', () => {
            this.closeCropWiki();
        });

        this.cropWikiOverlay?.addEventListener('click', (e) => {
            if (e.target === this.cropWikiOverlay) {
                this.closeCropWiki();
            }
        });

        // Weather tabs with null check
        const weatherTabs = document.querySelectorAll('.weather-tab');
        weatherTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab;
                if (tabName) {
                    this.switchWeatherTab(tabName);
                }
            });
        });

        // Trends chart buttons
        const trendButtons = document.querySelectorAll('.trend-btn');
        trendButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const series = e.currentTarget.dataset.series;
                if (series) {
                    this.switchTrendSeries(series);
                }
            });
        });

        // Main tab navigation (both sidebar and old tabs)
        const mainTabs = document.querySelectorAll('.main-tab, .sidebar-item');
        mainTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.currentTarget.dataset.tab;
                if (tabName) {
                    this.switchMainTab(tabName);
                }
            });
        });

        // Config page event listeners
        this.initConfigListeners();

        // AI Mode selector with event propagation control
        this.aiModeSelector?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleModeMenu();
        });

        // AI Mode options
        const modeOptions = document.querySelectorAll('.mode-option');
        modeOptions.forEach(option => {
            option.addEventListener('click', (e) => {
                const mode = e.currentTarget.dataset.mode;
                if (mode) {
                    this.switchAIMode(mode);
                }
            });
        });

        // Close mode menu when clicking outside
        document.addEventListener('click', (e) => {
            if (this.aiModeMenu?.classList.contains('show')) {
                if (!this.aiModeSelector?.contains(e.target) && !this.aiModeMenu.contains(e.target)) {
                    this.aiModeMenu.classList.remove('show');
                }
            }
        });

        // API Key management buttons
        this.setApiKeyBtn?.addEventListener('click', () => {
            this.setGeminiApiKey();
        });

        this.viewApiKeyBtn?.addEventListener('click', () => {
            this.viewGeminiApiKey();
        });

        this.removeApiKeyBtn?.addEventListener('click', () => {
            this.removeGeminiApiKey();
        });

        // Manual scroll detection with throttling for better performance
        let scrollTimeout;
        this.terminalWrapper?.addEventListener('scroll', () => {
            if (scrollTimeout) {
                clearTimeout(scrollTimeout);
            }
            scrollTimeout = setTimeout(() => {
                const isAtBottom = this.terminalWrapper.scrollHeight - this.terminalWrapper.scrollTop <= this.terminalWrapper.clientHeight + 50;
                if (!isAtBottom && this.autoScroll) {
                    this.autoScroll = false;
                    this.updateAutoScrollButton();
                }
            }, 100);
        });

        // F5 key to toggle config menu visibility
        document.addEventListener('keydown', (e) => {
            if (e.key === 'F5') {
                e.preventDefault();
                this.toggleConfigMenu();
            }
        });

        // Theme selector buttons
        const themeButtons = document.querySelectorAll('.theme-btn');
        themeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const theme = btn.dataset.theme;
                this.switchTheme(theme);
            });
        });

        // Load saved theme
        const savedTheme = localStorage.getItem('sosTheme') || 'normal';
        this.switchTheme(savedTheme);

        // Chart tab switching (both old and new mini tabs)
        const chartTabs = document.querySelectorAll('.chart-tab, .chart-tab-mini');
        chartTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const chartType = tab.dataset.chart;
                this.switchChartType(chartType);
            });
        });
    }

    async connect() {
        try {
            // Check if Web Serial API is supported
            if (!('serial' in navigator)) {
                this.appendToTerminal('ERROR: Web Serial API is not supported in this browser.\n');
                this.appendToTerminal('Please use Chrome, Edge, or Opera browser.\n');
                return;
            }

            // Request a port
            this.port = await navigator.serial.requestPort();
            
            // Open the port with common serial settings
            await this.port.open({ 
                baudRate: 115200,
                dataBits: 8,
                stopBits: 1,
                parity: 'none'
            });

            this.isConnected = true;
            this.updateConnectionStatus(true);
            this.clearTerminal();
            this.appendToTerminal('Connected successfully!\n');
            this.appendToTerminal('Listening for data...\n\n');

            // Play connection sound
            this.playConnectionSound();
            
            // Add notification
            this.addNotification('success', 'Device Connected', 'Serial device connected successfully at 115200 baud rate', '🔌');

            // Start reading data
            this.readData();

        } catch (error) {
            console.error('Connection error:', error);
            this.appendToTerminal(`ERROR: ${error.message}\n`);
        }
    }

    async disconnect() {
        try {
            if (this.reader) {
                await this.reader.cancel();
                this.reader = null;
            }

            if (this.port) {
                await this.port.close();
                this.port = null;
            }

            this.isConnected = false;
            this.updateConnectionStatus(false);
            this.appendToTerminal('\nDisconnected.\n');
            
            // Add notification
            this.addNotification('info', 'Device Disconnected', 'Serial device has been disconnected', '📡');

        } catch (error) {
            console.error('Disconnection error:', error);
            this.appendToTerminal(`ERROR: ${error.message}\n`);
        }
    }

    async readData() {
        try {
            while (this.port && this.port.readable) {
                this.reader = this.port.readable.getReader();

                try {
                    while (true) {
                        const { value, done } = await this.reader.read();
                        
                        if (done) {
                            break;
                        }

                        // Decode and display the data
                        const text = this.decoder.decode(value);
                        this.appendToTerminal(text);
                    }
                } catch (error) {
                    console.error('Read error:', error);
                    this.appendToTerminal(`\nERROR: ${error.message}\n`);
                } finally {
                    this.reader.releaseLock();
                }
            }
        } catch (error) {
            console.error('Reading error:', error);
        }
    }

    updateConnectionStatus(connected) {
        // Safely update status indicators
        if (this.statusIndicators && Array.isArray(this.statusIndicators)) {
            this.statusIndicators.forEach(indicator => {
                if (indicator) {
                    if (connected) {
                        indicator.classList.add('connected');
                    } else {
                        indicator.classList.remove('connected');
                    }
                }
            });
        }

        if (this.statusText) {
            this.statusText.textContent = connected ? 'Connected' : 'Disconnected';
        }
        
        // Show Dynamic Island notification
        if (connected) {
            this.showConnectionIsland(true, 115200);
        }
        
        // Update sidebar status
        const sidebarStatusDot = document.getElementById('sidebarStatusDot');
        const sidebarStatusText = document.getElementById('sidebarStatusText');
        if (sidebarStatusDot) {
            if (connected) {
                sidebarStatusDot.classList.add('connected');
            } else {
                sidebarStatusDot.classList.remove('connected');
            }
        }
        if (sidebarStatusText) {
            sidebarStatusText.textContent = connected ? 'Connected' : 'Disconnected';
        }
        
        if (this.connectBtn) {
            this.connectBtn.innerHTML = connected 
                ? '<span class="btn-icon">📡</span> DISCONNECT'
                : '<span class="btn-icon">📡</span> CONNECT';
        }
    }

    appendToTerminal(text) {
        if (!this.terminal) {
            console.error('Terminal element not found');
            return;
        }

        if (this.terminal.textContent === 'Waiting for data...') {
            this.terminal.textContent = '';
        }
        
        // Add text with fade-in animation
        const currentText = this.terminal.textContent;
        this.terminal.textContent = currentText + text;
        
        // Store in log
        this.dataLog.push({
            timestamp: new Date().toISOString(),
            data: text
        });
        
        // Check for emergency keywords
        this.checkForEmergency(text);
        
        // Auto-scroll to bottom if enabled
        if (this.autoScroll) {
            this.smoothScrollToBottom();
        }

        // Add pulse animation to terminal
        this.terminal.classList.add('data-received');
        setTimeout(() => {
            this.terminal.classList.remove('data-received');
        }, 100);
    }

    checkForEmergency(text) {
        const lowerText = text.toLowerCase();
        
        for (const [keyword, config] of Object.entries(this.emergencyKeywords)) {
            if (lowerText.includes(keyword)) {
                this.showEmergencyAlert(config);
                break; // Show only the first match
            }
        }
    }

    showEmergencyAlert(config) {
        // Show Dynamic Island emergency first
        this.showEmergencyIsland(config.title);
        
        // Set emergency details
        this.emergencyIcon.textContent = config.icon;
        this.emergencyTitle.textContent = config.title;
        this.emergencyMessage.textContent = config.message;
        
        // Set custom color
        const modal = document.querySelector('.emergency-modal');
        modal.style.borderColor = config.color;
        this.emergencyTitle.style.color = config.color;
        
        // Show overlay with animation
        this.emergencyOverlay.classList.add('show');
        
        // Play emergency warning sound
        this.playEmergencySound();
        
        // Make terminal pulse red
        this.terminal.classList.add('emergency-pulse');
        
        // Add to notification center
        this.addNotification('emergency', config.title, config.message, config.icon);
    }

    closeEmergencyAlert() {
        this.emergencyOverlay.classList.remove('show');
        this.terminal.classList.remove('emergency-pulse');
        
        // Button press animation
        this.acknowledgeBtn.classList.add('btn-pressed');
        setTimeout(() => {
            this.acknowledgeBtn.classList.remove('btn-pressed');
        }, 200);
    }

    playEmergencySound() {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Create alarm-like sound pattern
            const times = [0, 0.15, 0.3, 0.45, 0.6];
            
            times.forEach((time, index) => {
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                // Alternating high-low frequency for alarm effect
                oscillator.frequency.value = index % 2 === 0 ? 1000 : 800;
                oscillator.type = 'square';
                
                const startTime = audioContext.currentTime + time;
                gainNode.gain.setValueAtTime(0, startTime);
                gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.01);
                gainNode.gain.linearRampToValueAtTime(0, startTime + 0.12);
                
                oscillator.start(startTime);
                oscillator.stop(startTime + 0.12);
            });
        } catch (error) {
            console.log('Emergency sound failed:', error);
        }
    }

    clearTerminal() {
        if (!this.terminal) {
            console.error('Terminal element not found');
            return;
        }

        this.terminal.classList.add('fade-out');
        setTimeout(() => {
            this.terminal.textContent = 'Waiting for data...';
            this.dataLog = [];
            this.terminal.classList.remove('fade-out');
            this.terminal.classList.add('fade-in');
            setTimeout(() => {
                this.terminal.classList.remove('fade-in');
            }, 300);
        }, 200);
    }

    smoothScrollToBottom() {
        if (!this.terminalWrapper) {
            return;
        }

        try {
            this.terminalWrapper.scrollTo({
                top: this.terminalWrapper.scrollHeight,
                behavior: 'smooth'
            });
        } catch (error) {
            // Fallback for browsers that don't support smooth scrolling
            this.terminalWrapper.scrollTop = this.terminalWrapper.scrollHeight;
        }
    }

    toggleAutoScroll() {
        this.autoScroll = !this.autoScroll;
        this.updateAutoScrollButton();
        
        if (this.autoScroll) {
            this.smoothScrollToBottom();
        }
        
        // Add button press animation
        this.autoScrollBtn.classList.add('btn-pressed');
        setTimeout(() => {
            this.autoScrollBtn.classList.remove('btn-pressed');
        }, 200);
    }

    updateAutoScrollButton() {
        this.autoScrollBtn.innerHTML = this.autoScroll 
            ? '<span class="btn-icon">📜</span> AUTO-SCROLL: ON'
            : '<span class="btn-icon">📜</span> AUTO-SCROLL: OFF';
        
        if (this.autoScroll) {
            this.autoScrollBtn.classList.remove('btn-off');
        } else {
            this.autoScrollBtn.classList.add('btn-off');
        }
    }

    downloadLog() {
        if (this.dataLog.length === 0 && this.terminal.textContent === 'Waiting for data...') {
            this.showNotification('No data to save!');
            return;
        }

        // Show download progress in Dynamic Island
        this.showDownloadIsland(0);
        
        const logContent = this.terminal.textContent;
        const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
        const filename = `serial-log-${timestamp}.txt`;

        // Simulate progress for visual feedback
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress += 20;
            this.showDownloadIsland(progress);
            if (progress >= 100) {
                clearInterval(progressInterval);
            }
        }, 100);

        setTimeout(() => {
            const blob = new Blob([logContent], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            this.showNotification('Log saved successfully!');
            
            // Add button press animation
            this.downloadBtn.classList.add('btn-pressed');
            setTimeout(() => {
                this.downloadBtn.classList.remove('btn-pressed');
            }, 200);
        }, 500);
    }

    showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.classList.add('show');
        }, 10);

        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 2000);
    }

    addScrollAnimation() {
        // Add floating animation to status indicators
        this.statusIndicators.forEach((indicator, index) => {
            indicator.style.animationDelay = `${index * 0.2}s`;
        });
    }

    playConnectionSound() {
        try {
            // Try to play the audio file first
            if (this.connectionSound && this.connectionSound.src) {
                this.connectionSound.currentTime = 0; // Reset to start
                this.connectionSound.play().catch(error => {
                    console.log('Audio file failed, using Web Audio API fallback:', error);
                    this.playWebAudioBeep();
                });
            } else {
                // Fallback to Web Audio API beep if no audio file
                this.playWebAudioBeep();
            }
        } catch (error) {
            console.log('Could not play sound:', error);
        }
    }

    playWebAudioBeep() {
        try {
            // Create a richer, broader, longer sound using Web Audio API
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Create multiple oscillators for a richer sound
            const oscillator1 = audioContext.createOscillator();
            const oscillator2 = audioContext.createOscillator();
            const oscillator3 = audioContext.createOscillator();
            
            const gainNode = audioContext.createGain();
            const filter = audioContext.createBiquadFilter();

            // Connect oscillators to filter for broader sound
            oscillator1.connect(filter);
            oscillator2.connect(filter);
            oscillator3.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(audioContext.destination);

            // Set up filter for broader, warmer sound
            filter.type = 'lowpass';
            filter.frequency.value = 2000;
            filter.Q.value = 1;

            // Create a chord (major triad) for richer sound
            oscillator1.frequency.value = 523.25; // C5
            oscillator2.frequency.value = 659.25; // E5
            oscillator3.frequency.value = 783.99; // G5
            
            // Use sawtooth for broader, richer tone
            oscillator1.type = 'sawtooth';
            oscillator2.type = 'sine';
            oscillator3.type = 'triangle';

            // Longer, more gradual fade with higher volume
            const duration = 1.2; // Longer duration
            gainNode.gain.setValueAtTime(0, audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.4, audioContext.currentTime + 0.1); // Quick attack
            gainNode.gain.linearRampToValueAtTime(0.35, audioContext.currentTime + 0.4); // Sustain
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration); // Gradual fade

            // Start all oscillators
            oscillator1.start(audioContext.currentTime);
            oscillator2.start(audioContext.currentTime);
            oscillator3.start(audioContext.currentTime);
            
            // Stop all oscillators
            oscillator1.stop(audioContext.currentTime + duration);
            oscillator2.stop(audioContext.currentTime + duration);
            oscillator3.stop(audioContext.currentTime + duration);
        } catch (error) {
            console.log('Web Audio API failed:', error);
        }
    }

    async initWeather() {
        try {
            // Get user's location
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        this.fetchWeather(position.coords.latitude, position.coords.longitude);
                    },
                    (error) => {
                        console.log('Location error:', error);
                        // Use default location (New York as example)
                        this.fetchWeather(40.7128, -74.0060);
                    }
                );
            } else {
                // Use default location
                this.fetchWeather(40.7128, -74.0060);
            }

            // Update weather every 10 minutes
            setInterval(() => {
                if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                        (position) => {
                            this.fetchWeather(position.coords.latitude, position.coords.longitude);
                        }
                    );
                }
            }, 600000);
        } catch (error) {
            console.log('Weather initialization failed:', error);
        }
    }

    async fetchWeather(lat, lon) {
        try {
            // Using Open-Meteo API (free, no API key required)
            const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,weather_code,surface_pressure,cloud_cover,visibility,dew_point_2m,uv_index,et0_fao_evapotranspiration,shortwave_radiation&timezone=auto`;
            
            const response = await fetch(weatherUrl);
            const data = await response.json();

            // Get location name using reverse geocoding
            const geoUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`;
            const geoResponse = await fetch(geoUrl);
            const geoData = await geoResponse.json();

            this.updateWeatherDisplay(data, geoData);
        } catch (error) {
            console.log('Weather fetch failed:', error);
            this.weatherLocation.textContent = 'Weather unavailable';
        }
    }

    updateWeatherDisplay(data, geoData) {
        const current = data.current;
        
        // Update location
        const location = geoData.city || geoData.locality || geoData.principalSubdivision || 'Unknown';
        this.weatherLocation.textContent = location;

        // Update temperature
        this.weatherTemp.textContent = `${Math.round(current.temperature_2m)}°C`;

        // Update wind speed
        this.weatherWind.textContent = `Wind: ${Math.round(current.wind_speed_10m)} km/h`;

        // Update humidity
        this.weatherHumidity.textContent = `Humidity: ${current.relative_humidity_2m}%`;

        // Update feels like
        this.weatherFeels.textContent = `Feels: ${Math.round(current.apparent_temperature)}°C`;

        // Update visibility (convert meters to kilometers)
        const visibilityKm = current.visibility ? (current.visibility / 1000).toFixed(1) : '--';
        this.weatherVisibility.textContent = `Visibility: ${visibilityKm} km`;

        // Update dew point
        this.weatherDewPoint.textContent = `Dew Point: ${Math.round(current.dew_point_2m)}°C`;

        // Update UV Index
        const uvValue = current.uv_index || 0;
        const uvLevel = this.getUVLevel(uvValue);
        this.weatherUV.textContent = `UV: ${uvValue.toFixed(1)} (${uvLevel})`;

        // Update air pressure
        this.weatherPressure.textContent = `Pressure: ${Math.round(current.surface_pressure)} hPa`;

        // Update cloud cover
        this.weatherCloudCover.textContent = `Cloud: ${current.cloud_cover}%`;

        // Update solar radiation (shortwave radiation)
        const solarRad = current.shortwave_radiation || 0;
        this.weatherSolarRadiation.textContent = `Solar: ${Math.round(solarRad)} W/m²`;

        // Update evaporation rate (ET0 FAO evapotranspiration)
        const evaporation = current.et0_fao_evapotranspiration || 0;
        this.weatherEvaporation.textContent = `Evap: ${evaporation.toFixed(2)} mm`;

        // Update weather icon and description based on weather code
        const weatherInfo = this.getWeatherInfo(current.weather_code);
        this.weatherIcon.textContent = weatherInfo.icon;
        this.weatherDescription.textContent = weatherInfo.description;

        // Update meters with weather data
        this.updateMeter('temperature', current.temperature_2m, 0, 50);
        this.updateMeter('humidity', current.relative_humidity_2m, 0, 100);

        // Add animation
        this.weatherWidget.classList.add('weather-loaded');
        
        // Update weather dashboard panel (summary only)
        const tempLarge = document.getElementById('weatherTempLarge');
        const iconLarge = document.getElementById('weatherIconLarge');
        const condition = document.getElementById('weatherCondition');
        const timeEl = document.getElementById('weatherTime');
        const panelPrecip = document.getElementById('panelPrecip');
        const panelHumidity = document.getElementById('panelHumidity');
        const panelWind = document.getElementById('panelWind');

        if (tempLarge) tempLarge.textContent = `${Math.round(current.temperature_2m)}°C`;
        if (iconLarge) iconLarge.textContent = weatherInfo.icon;
        if (condition) condition.textContent = weatherInfo.description;
        if (timeEl) {
            const now = new Date();
            const options = { weekday: 'long', hour: 'numeric', minute: '2-digit', hour12: true };
            timeEl.textContent = now.toLocaleString('en-US', options);
        }
        if (panelPrecip) panelPrecip.textContent = `0%`;
        if (panelHumidity) panelHumidity.textContent = `${current.relative_humidity_2m}%`;
        if (panelWind) panelWind.textContent = `${Math.round(current.wind_speed_10m)} km/h`;
        
        // Update crop recommendations based on weather
        this.updateCropRecommendations(current.temperature_2m, current.relative_humidity_2m, current.weather_code);

        // Show weather update in Dynamic Island
        this.showWeatherIsland(
            Math.round(current.temperature_2m),
            weatherInfo.icon,
            weatherInfo.description,
            location
        );
    }

    getUVLevel(uvIndex) {
        if (uvIndex <= 2) return 'Low';
        if (uvIndex <= 5) return 'Moderate';
        if (uvIndex <= 7) return 'High';
        if (uvIndex <= 10) return 'Very High';
        return 'Extreme';
    }

    getWeatherInfo(code) {
        // WMO Weather interpretation codes
        const weatherCodes = {
            0: { icon: '☀️', description: 'Clear sky' },
            1: { icon: '🌤️', description: 'Mainly clear' },
            2: { icon: '⛅', description: 'Partly cloudy' },
            3: { icon: '☁️', description: 'Overcast' },
            45: { icon: '🌫️', description: 'Foggy' },
            48: { icon: '🌫️', description: 'Foggy' },
            51: { icon: '🌦️', description: 'Light drizzle' },
            53: { icon: '🌦️', description: 'Drizzle' },
            55: { icon: '🌧️', description: 'Heavy drizzle' },
            61: { icon: '🌧️', description: 'Light rain' },
            63: { icon: '🌧️', description: 'Rain' },
            65: { icon: '🌧️', description: 'Heavy rain' },
            71: { icon: '🌨️', description: 'Light snow' },
            73: { icon: '🌨️', description: 'Snow' },
            75: { icon: '🌨️', description: 'Heavy snow' },
            77: { icon: '🌨️', description: 'Snow grains' },
            80: { icon: '🌦️', description: 'Light showers' },
            81: { icon: '🌧️', description: 'Showers' },
            82: { icon: '🌧️', description: 'Heavy showers' },
            85: { icon: '🌨️', description: 'Light snow showers' },
            86: { icon: '🌨️', description: 'Snow showers' },
            95: { icon: '⛈️', description: 'Thunderstorm' },
            96: { icon: '⛈️', description: 'Thunderstorm with hail' },
            99: { icon: '⛈️', description: 'Thunderstorm with hail' }
        };

        return weatherCodes[code] || { icon: '🌤️', description: 'Unknown' };
    }

    updateCropRecommendations(temp, humidity, weatherCode) {
        // Determine season based on Indian agricultural seasons
        const month = new Date().getMonth() + 1;
        let season = '';
        let seasonEmoji = '';
        let seasonDescription = '';
        
        if (month >= 3 && month <= 6) {
            season = 'Summer/Zaid Season';
            seasonEmoji = '☀️';
            seasonDescription = 'Short season crops between Rabi and Kharif';
        } else if (month >= 7 && month <= 10) {
            season = 'Kharif Season (Monsoon)';
            seasonEmoji = '🌧️';
            seasonDescription = 'Sowing: June-July | Harvesting: September-October';
        } else if (month >= 11 || month <= 2) {
            season = 'Rabi Season (Winter)';
            seasonEmoji = '❄️';
            seasonDescription = 'Sowing: October-December | Harvesting: April-May';
        }

        this.cropSeason.innerHTML = `Current Season: <strong>${seasonEmoji} ${season}</strong><br><small style="color: #94a3b8; font-size: 0.9rem;">${seasonDescription}</small>`;

        // Get crop recommendations based on temperature and season
        const crops = this.getCropRecommendations(temp, season, humidity);
        
        // Display recommendations with images
        let cropHTML = '';
        crops.forEach((crop, index) => {
            cropHTML += `
                <div class="crop-item" data-crop-index="${index}" onclick="serialMonitor.openCropWiki(${index})">
                    <div class="crop-image-wrapper">
                        <div class="crop-image" style="background: ${crop.gradient}">
                            <span class="crop-emoji-large">${crop.emoji}</span>
                        </div>
                    </div>
                    <div class="crop-details">
                        <span class="crop-name">${crop.name}</span>
                        <span class="crop-info">${crop.info}</span>
                    </div>
                    <div class="crop-click-hint">Click for details</div>
                </div>
            `;
        });
        
        // Store crops for wiki reference
        this.currentCrops = crops;
        
        this.cropRecommendations.innerHTML = cropHTML;

        // Get farming tips based on weather
        const tips = this.getFarmingTips(temp, humidity, weatherCode);
        this.tipContent.innerHTML = tips;

        // Add animation
        this.cropWidget.classList.add('crop-loaded');
    }

    getCropRecommendations(temp, season, humidity) {
        let crops = [];

        // Indian Season-based recommendations
        if (season === 'Kharif Season (Monsoon)') {
            // Kharif crops (June-October) - Monsoon crops
            crops.push(
                { emoji: '🍚', name: 'Rice (Paddy)', info: 'Main Kharif crop | 20-35°C', gradient: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)' },
                { emoji: '🌽', name: 'Maize (Corn)', info: 'High rainfall crop | 21-27°C', gradient: 'linear-gradient(135deg, #ffeaa7 0%, #fdcb6e 100%)' },
                { emoji: '🥜', name: 'Groundnut', info: 'Oilseed crop | 20-30°C', gradient: 'linear-gradient(135deg, #dfe6e9 0%, #b2bec3 100%)' },
                { emoji: '🫘', name: 'Soybean', info: 'Protein-rich legume | 20-30°C', gradient: 'linear-gradient(135deg, #a29bfe 0%, #6c5ce7 100%)' }
            );
            
            if (temp > 25) {
                crops.push(
                    { emoji: '🌾', name: 'Jowar (Sorghum)', info: 'Drought-resistant | 25-32°C', gradient: 'linear-gradient(135deg, #fab1a0 0%, #ff7675 100%)' },
                    { emoji: '🌱', name: 'Tur Dal (Pigeon Pea)', info: 'Major pulse crop | 20-30°C', gradient: 'linear-gradient(135deg, #ffeaa7 0%, #fdcb6e 100%)' }
                );
            }
            
        } else if (season === 'Rabi Season (Winter)') {
            // Rabi crops (October-March) - Winter crops
            crops.push(
                { emoji: '🌾', name: 'Wheat', info: 'Major Rabi crop | 10-25°C', gradient: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)' },
                { emoji: '🌾', name: 'Barley', info: 'Winter cereal | 12-25°C', gradient: 'linear-gradient(135deg, #e8c468 0%, #d4a574 100%)' },
                { emoji: '🥔', name: 'Potato', info: 'Cool season tuber | 15-20°C', gradient: 'linear-gradient(135deg, #dfe6e9 0%, #b2bec3 100%)' },
                { emoji: '🌻', name: 'Mustard', info: 'Oilseed crop | 10-25°C', gradient: 'linear-gradient(135deg, #ffeaa7 0%, #fdcb6e 100%)' }
            );
            
            if (temp < 20) {
                crops.push(
                    { emoji: '🫛', name: 'Chickpea (Chana)', info: 'Winter pulse | 10-30°C', gradient: 'linear-gradient(135deg, #fab1a0 0%, #ff7675 100%)' },
                    { emoji: '🧅', name: 'Onion', info: 'Winter vegetable | 13-24°C', gradient: 'linear-gradient(135deg, #fdcb6e 0%, #e17055 100%)' }
                );
            }
            
        } else if (season === 'Summer/Zaid Season') {
            // Zaid crops (March-June) - Summer crops
            crops.push(
                { emoji: '🍉', name: 'Watermelon', info: 'Summer fruit | 24-27°C', gradient: 'linear-gradient(135deg, #a29bfe 0%, #fd79a8 100%)' },
                { emoji: '🥒', name: 'Cucumber', info: 'High water content | 18-24°C', gradient: 'linear-gradient(135deg, #55efc4 0%, #00b894 100%)' },
                { emoji: '🍈', name: 'Muskmelon', info: 'Summer melon | 18-25°C', gradient: 'linear-gradient(135deg, #fdcb6e 0%, #e17055 100%)' },
                { emoji: '🥕', name: 'Carrot', info: 'Root vegetable | 16-21°C', gradient: 'linear-gradient(135deg, #ff7675 0%, #d63031 100%)' }
            );
            
            if (temp > 28) {
                crops.push(
                    { emoji: '🌶️', name: 'Green Chilli', info: 'Hot season spice | 20-30°C', gradient: 'linear-gradient(135deg, #00b894 0%, #00cec9 100%)' },
                    { emoji: '🍅', name: 'Tomato', info: 'Summer vegetable | 21-24°C', gradient: 'linear-gradient(135deg, #ff7675 0%, #d63031 100%)' }
                );
            }
        }

        // Temperature adjustments
        if (temp > 30 && humidity > 70) {
            // High temp + humidity: Add monsoon-friendly crops
            if (!crops.some(c => c.name === 'Rice (Paddy)')) {
                crops.push({ emoji: '🍚', name: 'Rice', info: 'High water requirement | 20-35°C', gradient: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)' });
            }
        } else if (temp < 15) {
            // Cool weather: Add winter crops
            if (!crops.some(c => c.name === 'Wheat')) {
                crops.push({ emoji: '🌾', name: 'Wheat', info: 'Cool season cereal | 10-25°C', gradient: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)' });
            }
        }

        return crops.slice(0, 4); // Return top 4 recommendations
    }

    getFarmingTips(temp, humidity, weatherCode) {
        let tips = [];

        // Temperature-based tips for Indian climate
        if (temp > 35) {
            tips.push('🌡️ <strong>Extreme Heat Alert:</strong> Use drip irrigation, apply mulch, and consider shade nets for vegetables. Best to water early morning or late evening.');
        } else if (temp > 30) {
            tips.push('☀️ <strong>Hot Weather:</strong> Ensure adequate irrigation. Consider growing heat-resistant varieties. Apply organic mulch to conserve soil moisture.');
        } else if (temp < 10) {
            tips.push('❄️ <strong>Cold Weather:</strong> Protect young plants with plastic sheets at night. Good time for Rabi crops like wheat and mustard.');
        } else if (temp >= 10 && temp <= 15) {
            tips.push('🌤️ <strong>Cool Season:</strong> Ideal for winter vegetables. Use organic manure and ensure proper soil preparation.');
        }

        // Humidity-based tips
        if (humidity > 80) {
            tips.push('💧 <strong>High Humidity:</strong> Watch for fungal diseases like blight and mildew. Use neem-based organic fungicides. Ensure good air circulation between plants.');
        } else if (humidity < 30) {
            tips.push('🌵 <strong>Low Humidity:</strong> Increase watering frequency. Use drip irrigation to conserve water. Apply mulch to retain soil moisture.');
        }

        // Monsoon-specific tips
        if (weatherCode >= 61 && weatherCode <= 82) {
            tips.push('🌧️ <strong>Monsoon/Rainy Season:</strong> Perfect time for Kharif crops (Rice, Maize, Cotton). Ensure proper drainage to prevent waterlogging. Watch for pest attacks during heavy rainfall.');
        } else if (weatherCode === 0 || weatherCode === 1) {
            tips.push('☀️ <strong>Clear Weather:</strong> Excellent for field preparation and harvesting. Good time for applying organic fertilizers. Ideal for transplanting seedlings.');
        } else if (weatherCode >= 95) {
            tips.push('⛈️ <strong>Storm Warning:</strong> Secure equipment, check drainage systems, postpone planting activities.');
        }

        // General Indian farming tips
        tips.push('🌱 <strong>Soil Management:</strong> Test soil pH regularly (ideal 6.0-7.5). Add vermicompost or farmyard manure. Practice crop rotation to maintain soil health.');
        
        // Season-specific additional tips
        const month = new Date().getMonth() + 1;
        if (month >= 7 && month <= 10) {
            tips.push('🌾 <strong>Kharif Season Tip:</strong> Monitor for monsoon pests. Use Integrated Pest Management (IPM). Ensure timely weeding for better crop growth.');
        } else if (month >= 11 || month <= 2) {
            tips.push('🌾 <strong>Rabi Season Tip:</strong> Irrigation is crucial. Use sprinkler or drip systems. Watch for aphids and other winter pests on wheat and mustard.');
        } else {
            tips.push('☀️ <strong>Zaid Season Tip:</strong> Focus on quick-growing vegetables. Ensure consistent water supply. Use protective structures for delicate crops.');
        }

        return tips.join('<br><br>');
    }

    initAIVisibility() {
        // Initialize AI assistant visibility
        if (this.aiVisible) {
            this.aiAssistant.classList.add('visible');
            this.aiOpenBtn.style.display = 'none';
        } else {
            this.aiAssistant.classList.remove('visible');
            this.aiOpenBtn.style.display = 'flex';
        }
    }

    openAI() {
        this.aiVisible = true;
        this.aiAssistant.classList.add('visible');
        this.aiOpenBtn.style.display = 'none';
        localStorage.setItem('aiVisible', 'true');
    }

    closeAI() {
        this.aiVisible = false;
        this.aiAssistant.classList.remove('visible');
        this.aiOpenBtn.style.display = 'flex';
        localStorage.setItem('aiVisible', 'false');
    }

    clearChatHistory() {
        if (this.conversationHistory.length === 0) {
            this.showNotification('Chat is already empty!');
            return;
        }

        // Confirm before clearing
        if (confirm('Are you sure you want to clear the chat history?')) {
            // Clear conversation history
            this.conversationHistory = [];
            
            // Clear learning data
            this.learningData = {
                favoriteTopics: {},
                commonQuestions: {},
                userLocation: null,
                preferredCrops: [],
                lastInteractionTime: null,
                totalInteractions: 0
            };
            
            // Clear from localStorage
            localStorage.removeItem('sosConnectChatHistory');
            localStorage.removeItem('sosConnectLearning');
            
            // Clear chat UI
            this.aiChat.innerHTML = '';
            
            // Show welcome message again
            this.showWelcomeMessage();
            
            // Show notification
            this.showNotification('Chat history cleared!');
            
            // Add animation to clear button
            this.aiClearChat.classList.add('btn-pressed');
            setTimeout(() => {
                this.aiClearChat.classList.remove('btn-pressed');
            }, 200);
        }
    }

    async sendAIMessage() {
        const message = this.aiInput?.value.trim();
        if (!message) return;

        // Check for #gemini command
        if (message.toLowerCase() === '#gemini') {
            this.switchAIMode('gemini');
            this.aiInput.value = '';
            return;
        }

        // Check for #sos command
        if (message.toLowerCase() === '#sos') {
            this.switchAIMode('sos');
            this.aiInput.value = '';
            return;
        }

        // Add user message to chat
        this.addAIMessage(message, 'user');
        
        // Store in conversation history
        this.conversationHistory.push({
            role: 'user',
            message: message,
            timestamp: Date.now()
        });
        
        this.aiInput.value = '';

        // Show Dynamic Island AI activity
        this.showAIIsland();

        // Show typing indicator
        if (this.aiStatus) {
            this.aiStatus.textContent = 'Thinking...';
            this.aiStatus.classList.add('thinking');
        }
        this.showTypingIndicator();

        try {
            // Generate response based on current mode
            let response;
            let thinkingTime;
            
            if (this.currentAIMode === 'gemini') {
                thinkingTime = 500; // Shorter wait for API call
                await new Promise(resolve => setTimeout(resolve, thinkingTime));
                response = await this.generateGeminiResponse(message);
                
                this.removeTypingIndicator();
                
                // Store AI response in history
                this.conversationHistory.push({
                    role: 'assistant',
                    message: response,
                    timestamp: Date.now()
                });
                this.saveChatHistory();

                // Add AI response with typing animation
                this.addAIMessageWithTyping(response, 'assistant');

                // Learn from the interaction
                this.learnFromInteraction(message, response);

                // Reset AI status
                if (this.aiStatus) {
                    this.aiStatus.textContent = 'Powered by Gemini';
                    this.aiStatus.classList.remove('thinking');
                }

                // Scroll chat to bottom
                setTimeout(() => {
                    if (this.aiChat) {
                        this.aiChat.scrollTop = this.aiChat.scrollHeight;
                    }
                }, 100);
            } else {
                // Simulate AI thinking with realistic delay for SOS AI
                thinkingTime = 800 + Math.random() * 700;
                setTimeout(() => {
                    response = this.generateAIResponse(message);
                    this.removeTypingIndicator();
                    
                    // Store AI response in history
                    this.conversationHistory.push({
                        role: 'assistant',
                        message: response,
                        timestamp: Date.now()
                    });
                    this.saveChatHistory();

                    // Add AI response with typing animation
                    this.addAIMessageWithTyping(response, 'assistant');

                    // Learn from the interaction
                    this.learnFromInteraction(message, response);

                    // Reset AI status
                    if (this.aiStatus) {
                        this.aiStatus.textContent = '';
                        this.aiStatus.classList.remove('thinking');
                    }

                    // Scroll chat to bottom
                    setTimeout(() => {
                        if (this.aiChat) {
                            this.aiChat.scrollTop = this.aiChat.scrollHeight;
                        }
                    }, 100);
                }, thinkingTime);
            }
        } catch (error) {
            console.error('AI Message Error:', error);
            this.removeTypingIndicator();
            
            if (this.aiStatus) {
                this.aiStatus.textContent = 'Error occurred';
                this.aiStatus.classList.remove('thinking');
            }
            
            // Show error message to user
            this.addAIMessage('Sorry, I encountered an error processing your message. Please try again.', 'assistant');
            
            // Reset status after a delay
            setTimeout(() => {
                if (this.aiStatus) {
                    this.aiStatus.textContent = this.currentAIMode === 'gemini' ? 'Powered by Gemini' : '';
                }
            }, 2000);
        }
    }
    
    showTypingIndicator() {
        if (!this.aiChat) return;
        
        const typingDiv = document.createElement('div');
        typingDiv.className = 'ai-message ai-assistant-message typing-indicator-msg';
        typingDiv.innerHTML = `
            <div class="message-avatar">🤖</div>
            <div class="message-content typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        `;
        this.aiChat.appendChild(typingDiv);
        this.aiChat.scrollTop = this.aiChat.scrollHeight;
    }
    
    removeTypingIndicator() {
        if (!this.aiChat) return;
        
        const typingMsg = this.aiChat.querySelector('.typing-indicator-msg');
        if (typingMsg) {
            typingMsg.remove();
        }
    }
    
    addAIMessageWithTyping(content, sender) {
        if (!this.aiChat) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `ai-message ai-${sender}-message`;
        
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.textContent = sender === 'user' ? '👤' : '🤖';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(contentDiv);
        this.aiChat.appendChild(messageDiv);
        
        // Type out the message character by character
        this.typeMessage(contentDiv, content);
    }

    addAIMessage(content, sender) {
        if (!this.aiChat) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `ai-message ai-${sender}-message`;
        
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.textContent = sender === 'user' ? '👤' : '🤖';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.innerHTML = content;
        
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(contentDiv);
        this.aiChat.appendChild(messageDiv);
        
        // Scroll to bottom
        this.aiChat.scrollTop = this.aiChat.scrollHeight;
    }
    
    typeMessage(element, htmlContent, speed = 15) {
        // Strip HTML for typing, then add back formatting
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlContent;
        const text = tempDiv.textContent;
        
        let index = 0;
        element.textContent = '';
        
        const typeInterval = setInterval(() => {
            if (index < text.length) {
                element.textContent += text[index];
                index++;
                this.aiChat.scrollTop = this.aiChat.scrollHeight;
            } else {
                clearInterval(typeInterval);
                // Replace with formatted HTML after typing
                element.innerHTML = htmlContent;
            }
        }, speed);
    }

    generateAIResponse(question) {
        const lowerQuestion = question.toLowerCase();
        
        // Get learning data for personalization
        const totalChats = this.learningData.totalInteractions;
        const hasHistory = totalChats > 5;
        const favTopics = this.learningData.favoriteTopics;
        
        // Personalization notes
        let personalNote = '';
        if (hasHistory && favTopics.weather > 3) {
            personalNote = "I've noticed you check weather frequently! ";
        } else if (hasHistory && favTopics.crops > 3) {
            personalNote = "I see you're really interested in crops! ";
        } else if (hasHistory && favTopics.emergency > 2) {
            personalNote = "Safety first - I appreciate your focus on emergency systems! ";
        }
        
        // Check conversation context for follow-up questions
        const lastMessages = this.conversationHistory.slice(-4);
        const hasRecentWeatherTopic = lastMessages.some(msg => 
            msg.message.toLowerCase().includes('weather') || 
            msg.message.toLowerCase().includes('temperature')
        );
        const hasRecentCropTopic = lastMessages.some(msg => 
            msg.message.toLowerCase().includes('crop') || 
            msg.message.toLowerCase().includes('plant')
        );
        
        // Greeting responses with personalization
        if (/^(hi|hello|hey|greetings|good morning|good afternoon|good evening)/i.test(lowerQuestion)) {
            const personalGreeting = this.getPersonalizedGreeting();
            const greetings = [
                `<strong>${personalGreeting} 👋</strong><br><br>${personalNote}I'm ${this.aiPersonality.name}, your intelligent assistant for SOS Connect Pro. ${hasHistory ? `We've chatted ${totalChats} times before! ` : ''}I'm here to help you with everything from device connections to agricultural insights. What would you like to explore today?`,
                `<strong>Hey! ${hasHistory ? 'Welcome back!' : 'Great to see you!'} 😊</strong><br><br>${personalNote}I'm your AI companion for this system. ${hasHistory ? `I remember our previous ${totalChats} conversations. ` : ''}Whether you need help with serial communications, weather analysis, or farming recommendations, I've got you covered. What can I assist you with?`,
                `<strong>Greetings! 🌟</strong><br><br>${personalNote}${hasHistory ? `Nice to continue our conversation (chat #${totalChats + 1})! ` : 'Welcome! '}I'm powered by advanced AI to help you navigate SOS Connect Pro. I can provide real-time insights, troubleshoot issues, and offer expert advice. How may I help you today?`
            ];
            return greetings[Math.floor(Math.random() * greetings.length)];
        }
        
        // Thank you responses
        if (/thank/i.test(lowerQuestion)) {
            return `<strong>You're very welcome! 😊</strong><br><br>I'm always here to help. Feel free to ask me anything else about your system, weather conditions, or farming strategies!`;
        }
        
        // Connection help with detailed troubleshooting
        if (lowerQuestion.includes('connect') || lowerQuestion.includes('connection') || lowerQuestion.includes('serial')) {
            const status = this.isConnected ? 'connected' : 'disconnected';
            return `<strong>Serial Connection ${status === 'connected' ? '✅ Active' : '⚠️ Not Active'}</strong><br><br>
                ${status === 'connected' ? 
                    `Great! Your device is currently connected and receiving data. You can:<br>
                    • View real-time data in the terminal below<br>
                    • Save logs for later analysis<br>
                    • Monitor for emergency alerts<br><br>
                    The connection is stable at 115200 baud rate.` :
                    `To connect your serial device:<br><br>
                    <strong>Step 1:</strong> Plug in your device via USB<br>
                    <strong>Step 2:</strong> Click the CONNECT button above<br>
                    <strong>Step 3:</strong> Select your device from the browser popup<br>
                    <strong>Step 4:</strong> Grant permission to access the port<br><br>
                    ⚡ <strong>Troubleshooting:</strong><br>
                    • Make sure you're using Chrome, Edge, or Opera<br>
                    • Check if the device is properly plugged in<br>
                    • Try a different USB port or cable<br>
                    • Restart your browser if issues persist`
                }`;
        }
        
        // Weather questions with context awareness
        if (lowerQuestion.includes('weather') || lowerQuestion.includes('temperature') || lowerQuestion.includes('rain') || lowerQuestion.includes('climate')) {
            const temp = this.weatherTemp.textContent;
            const humid = this.weatherHumidity.textContent;
            const desc = this.weatherDescription.textContent;
            
            if (lowerQuestion.includes('what') || lowerQuestion.includes('current') || lowerQuestion.includes('now')) {
                return `<strong>🌤️ Current Weather Analysis</strong><br><br>
                    <strong>Temperature:</strong> ${temp}<br>
                    <strong>Humidity:</strong> ${humid}<br>
                    <strong>Conditions:</strong> ${desc}<br><br>
                    ${this.getWeatherAdvice(desc)}<br><br>
                    💡 <strong>Tip:</strong> Weather updates automatically every 10 minutes to keep you informed of changing conditions.`;
            }
            
            if (lowerQuestion.includes('tomorrow') || lowerQuestion.includes('forecast')) {
                return `<strong>Weather Forecast 🔮</strong><br><br>
                    Currently, I'm showing real-time weather data from Open-Meteo. Based on current conditions (${desc}), here's what you should prepare for:<br><br>
                    ${this.getWeatherAdvice(desc)}<br><br>
                    I recommend checking local weather services for detailed forecasts!`;
            }
            
            return `<strong>Weather Intelligence 🌦️</strong><br><br>
                Right now it's ${temp} with ${humid} humidity. ${desc}.<br><br>
                ${this.getWeatherAdvice(desc)}<br><br>
                Would you like specific farming advice based on these conditions?`;
        }
        
        // Crop questions with seasonal and weather context
        if (lowerQuestion.includes('crop') || lowerQuestion.includes('plant') || lowerQuestion.includes('farm') || lowerQuestion.includes('grow')) {
            const temp = parseFloat(this.weatherTemp.textContent);
            const season = this.cropSeason.textContent;
            
            if (lowerQuestion.includes('what') || lowerQuestion.includes('which') || lowerQuestion.includes('recommend')) {
                let seasonAdvice = '';
                if (season.includes('Kharif')) {
                    seasonAdvice = '🌧️ <strong>Kharif/Monsoon crops</strong> like Rice, Maize, Soybean, and Groundnut are perfect now. These crops thrive with monsoon rainfall and will give excellent yields.';
                } else if (season.includes('Rabi')) {
                    seasonAdvice = '❄️ <strong>Rabi/Winter crops</strong> like Wheat, Barley, Mustard, and Chickpea are ideal for this season. Cool temperatures are perfect for these crops.';
                } else {
                    seasonAdvice = '☀️ <strong>Zaid/Summer crops</strong> like Watermelon, Cucumber, Muskmelon, and summer vegetables are best right now. Quick-growing crops suited for short season.';
                }
                
                return `<strong>🌾 Smart Crop Recommendations (India)</strong><br><br>
                    Based on current conditions:<br>
                    • Temperature: ${temp}°C<br>
                    • ${season}<br><br>
                    ${seasonAdvice}<br><br>
                    💡 Check the detailed recommendations above with beautiful crop cards showing ideal growing conditions for each crop!`;
            }
            
            if (lowerQuestion.includes('when') || lowerQuestion.includes('time') || lowerQuestion.includes('season')) {
                return `<strong>⏰ Indian Agricultural Seasons</strong><br><br>
                    <strong>🌧️ Kharif (Monsoon):</strong> June-October<br>
                    Crops: Rice, Maize, Cotton, Soybean, Groundnut<br><br>
                    <strong>❄️ Rabi (Winter):</strong> October-March<br>
                    Crops: Wheat, Barley, Mustard, Chickpea, Potato<br><br>
                    <strong>☀️ Zaid (Summer):</strong> March-June<br>
                    Crops: Watermelon, Cucumber, Muskmelon, Green vegetables<br><br>
                    Current temperature (${temp}°C) is ${temp > 30 ? 'hot - ideal for Kharif crops' : temp < 15 ? 'cool - perfect for Rabi crops' : 'moderate - good for Zaid season crops'}!`;
            }
            
            if (hasRecentWeatherTopic) {
                return `<strong>Weather + Crop Integration 🌱☀️</strong><br><br>
                    Great question! India's agricultural seasons are closely tied to weather patterns.<br><br>
                    With current conditions, I recommend focusing on the crops displayed above. They're specifically chosen based on Indian seasons (Kharif/Rabi/Zaid) and real-time temperature and humidity levels.<br><br>
                    <strong>Pro tip:</strong> Use the auto-refresh weather feature to track monsoon patterns and adjust your planting schedule accordingly!`;
            }
        }
        
        // Emergency questions with enhanced detail
        if (lowerQuestion.includes('emergency') || lowerQuestion.includes('alert') || lowerQuestion.includes('warning') || lowerQuestion.includes('sos')) {
            return `<strong>🚨 Emergency Alert System</strong><br><br>
                SOS Connect Pro monitors your serial data for critical keywords:<br><br>
                <strong>Monitored Keywords:</strong><br>
                • 🛬 LAND - Landing emergencies<br>
                • 🚨 ANY1/2/3 - Priority levels<br>
                • 🚑 EMG|AMB - Ambulance needed<br>
                • 🔥 EMG|FIRE - Fire emergency<br>
                • 👮 EMG|POL - Police emergency<br>
                • 🆘 EMG|EMG - Critical situation<br><br>
                When detected, the system will:<br>
                ✓ Display full-screen alert with visual/audio warnings<br>
                ✓ Highlight emergency data in terminal<br>
                ✓ Log emergency timestamp for records<br><br>
                ${this.dataLog.some(log => Object.keys(this.emergencyKeywords).some(key => log.data.toLowerCase().includes(key))) ?
                    '⚠️ <strong>Note:</strong> Emergency keywords have been detected in your session!' :
                    '✅ No emergency alerts detected yet. System is monitoring 24/7.'
                }`;
        }
        
        // Data questions with statistics
        if (lowerQuestion.includes('data') || lowerQuestion.includes('log') || lowerQuestion.includes('save') || lowerQuestion.includes('export')) {
            const dataPoints = this.dataLog.length;
            const dataSize = new Blob([this.terminal.textContent]).size;
            const sizeKB = (dataSize / 1024).toFixed(2);
            
            return `<strong>📊 Data Management</strong><br><br>
                <strong>Current Session Stats:</strong><br>
                • Data points logged: ${dataPoints}<br>
                • Terminal size: ${sizeKB} KB<br>
                • Auto-scroll: ${this.autoScroll ? 'ON ✅' : 'OFF ⏸️'}<br><br>
                <strong>Available Actions:</strong><br>
                • 💾 <strong>SAVE LOG:</strong> Download complete session data as .txt file<br>
                • 🗑️ <strong>CLEAR:</strong> Reset terminal (doesn't affect saved logs)<br>
                • 📜 <strong>AUTO-SCROLL:</strong> Toggle automatic scrolling<br><br>
                ${dataPoints > 0 ?
                    `You have ${dataPoints} data entries ready to export. Click SAVE LOG to download!` :
                    'Start collecting data by connecting your device first.'
                }`;
        }
        
        // Specific crop knowledge base
        if (lowerQuestion.includes('tomato') || lowerQuestion.includes('corn') || lowerQuestion.includes('potato') || lowerQuestion.includes('wheat') || lowerQuestion.includes('rice')) {
            const cropName = lowerQuestion.match(/tomato|corn|potato|wheat|rice|carrot|lettuce|cucumber|pepper/i)?.[0] || 'crop';
            const cropInfo = {
                tomato: { temp: '20-30°C', season: 'Spring-Summer', water: 'Regular, deep watering', emoji: '🍅' },
                corn: { temp: '21-30°C', season: 'Summer', water: 'Consistent moisture', emoji: '🌽' },
                potato: { temp: '15-20°C', season: 'Spring-Fall', water: 'Moderate watering', emoji: '🥔' },
                wheat: { temp: '12-25°C', season: 'Fall-Spring', water: 'Minimal irrigation', emoji: '🌾' },
                rice: { temp: '20-35°C', season: 'Summer', water: 'Flooded fields', emoji: '🌾' }
            };
            
            const info = cropInfo[cropName.toLowerCase()] || { temp: 'varies', season: 'varies', water: 'moderate', emoji: '🌱' };
            
            return `<strong>${info.emoji} ${cropName.charAt(0).toUpperCase() + cropName.slice(1)} Growing Guide</strong><br><br>
                <strong>Optimal Temperature:</strong> ${info.temp}<br>
                <strong>Best Season:</strong> ${info.season}<br>
                <strong>Water Needs:</strong> ${info.water}<br><br>
                <strong>Growing Tips:</strong><br>
                • Ensure well-draining soil<br>
                • Monitor for pests regularly<br>
                • Fertilize according to growth stage<br>
                • Harvest at peak ripeness<br><br>
                Check the current weather conditions above to see if now is a good time to plant ${cropName}!`;
        }
        
        // Help and capabilities
        if (lowerQuestion.includes('help') || lowerQuestion.includes('what can you') || lowerQuestion.includes('how') || lowerQuestion.includes('capabilities')) {
            return `<strong>🤖 AI Assistant Capabilities</strong><br><br>
                I'm an advanced AI with expertise in:<br><br>
                <strong>1. Serial Communications 📡</strong><br>
                • Connection troubleshooting<br>
                • Data monitoring guidance<br>
                • Port configuration help<br><br>
                <strong>2. Weather Intelligence 🌦️</strong><br>
                • Real-time weather analysis<br>
                • Condition interpretation<br>
                • Farming impact assessment<br><br>
                <strong>3. Agricultural Expertise 🌾</strong><br>
                • Crop recommendations<br>
                • Planting schedules<br>
                • Climate-based advice<br><br>
                <strong>4. Emergency Response 🚨</strong><br>
                • Alert system info<br>
                • Keyword monitoring<br>
                • Safety protocols<br><br>
                <strong>5. Data Analysis 📊</strong><br>
                • Log management<br>
                • Session statistics<br>
                • Export guidance<br><br>
                Try asking me: "What crops should I plant?" or "How's the weather looking for farming?"`;
        }
        
        // Context-aware follow-up handling
        if (hasRecentWeatherTopic && (lowerQuestion.includes('good') || lowerQuestion.includes('ok') || lowerQuestion.includes('suitable'))) {
            return `<strong>Weather Suitability Check ✅</strong><br><br>
                Based on current conditions, yes! The weather is ${this.weatherDescription.textContent.toLowerCase()}, which is ${
                    parseFloat(this.weatherTemp.textContent) > 25 ? 'warm and ideal for summer crops' :
                    parseFloat(this.weatherTemp.textContent) > 15 ? 'moderate and perfect for diverse planting' :
                    'cool and good for cold-weather crops'
                }.<br><br>
                Check the crop recommendations above for specific suggestions!`;
        }
        
        if (hasRecentCropTopic && (lowerQuestion.includes('more') || lowerQuestion.includes('other') || lowerQuestion.includes('else'))) {
            return `<strong>Additional Crop Options 🌱</strong><br><br>
                Beyond what's shown above, you could also consider:<br>
                • Herbs (basil, mint, cilantro)<br>
                • Root vegetables (radish, turnip)<br>
                • Legumes (chickpeas, lentils)<br>
                • Leafy greens (kale, chard)<br><br>
                The key is matching the crop's temperature preference with your current climate (${this.weatherTemp.textContent}). Want specific details about any of these?`;
        }
        
        // Personality-driven default with context
        const contextHint = hasRecentWeatherTopic ? ' I notice we were discussing weather - want to explore how it affects farming?' :
                           hasRecentCropTopic ? ' We were talking about crops - need more agricultural advice?' : '';
        
        return `<strong>Hmm, interesting question! 🤔</strong><br><br>
            I want to make sure I give you the best answer. "${question}" is a bit outside my current knowledge scope.${contextHint}<br><br>
            <strong>I'm really good at helping with:</strong><br>
            • Device connections and serial communication<br>
            • Weather analysis and interpretation<br>
            • Crop recommendations and farming tips<br>
            • Emergency alert system information<br>
            • Data logging and management<br><br>
            Could you rephrase your question in terms of these topics? Or try asking: "What should I plant now?" or "How do I connect my device?"`;
    }

    getWeatherAdvice(conditions) {
        conditions = conditions.toLowerCase();
        if (conditions.includes('clear') || conditions.includes('sunny')) {
            return '☀️ Great conditions for outdoor farm work! Remember to stay hydrated and use sun protection.';
        } else if (conditions.includes('rain') || conditions.includes('shower')) {
            return '🌧️ Good for planting! Soil moisture is high. Ensure proper drainage to prevent waterlogging.';
        } else if (conditions.includes('cloud')) {
            return '☁️ Mild conditions. Good for transplanting seedlings as they won\'t face harsh sun stress.';
        } else if (conditions.includes('storm') || conditions.includes('thunder')) {
            return '⛈️ Take precautions! Secure equipment and avoid outdoor work. Check drainage systems.';
        } else if (conditions.includes('snow')) {
            return '🌨️ Protect sensitive plants. Good time for indoor planning and equipment maintenance.';
        }
        return '🌤️ Monitor conditions and adjust farm activities accordingly.';
    }
    
    // Notification System Methods
    addNotification(type, title, message, icon) {
        const notification = {
            id: Date.now(),
            type: type, // 'success', 'info', 'emergency'
            title: title,
            message: message,
            icon: icon,
            time: new Date()
        };
        
        this.notifications.unshift(notification);
        this.updateNotificationBadge();
        this.renderNotifications();
        
        // Show toast notification
        this.showToast(title, message, type);
    }
    
    renderNotifications() {
        if (this.notifications.length === 0) {
            this.notificationList.innerHTML = '<div class="no-notifications">No notifications yet</div>';
            return;
        }
        
        this.notificationList.innerHTML = this.notifications.map(notif => `
            <div class="notification-item ${notif.type}">
                <div class="notification-item-header">
                    <span class="notification-icon">${notif.icon}</span>
                    <span class="notification-title">${notif.title}</span>
                    <span class="notification-time">${this.getTimeAgo(notif.time)}</span>
                </div>
                <div class="notification-message">${notif.message}</div>
            </div>
        `).join('');
    }
    
    getTimeAgo(date) {
        const seconds = Math.floor((new Date() - date) / 1000);
        if (seconds < 60) return 'Just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    }
    
    updateNotificationBadge() {
        const count = this.notifications.length;
        this.notificationBadge.textContent = count;
        this.notificationBadge.style.display = count > 0 ? 'block' : 'none';
    }
    
    toggleNotificationPanel() {
        this.notificationPanel.classList.toggle('show');
    }
    
    clearAllNotifications() {
        this.notifications = [];
        this.updateNotificationBadge();
        this.renderNotifications();
    }
    
    showToast(title, message, type) {
        const toast = document.createElement('div');
        toast.className = 'notification';
        toast.innerHTML = `<strong>${title}</strong><br>${message}`;
        
        // Add type-specific styling
        if (type === 'emergency') {
            toast.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
        } else if (type === 'info') {
            toast.style.background = 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)';
        }
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(toast);
            }, 300);
        }, 3000);
    }
    
    // Initialize meters with gradients
    initMeters() {
        // Create SVG gradients
        const svg = document.querySelector('.meter-svg');
        if (!svg) return;
        
        // Add gradients to first SVG
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        
        // Temperature gradient (blue to red)
        const tempGradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
        tempGradient.setAttribute('id', 'tempGradient');
        tempGradient.setAttribute('x1', '0%');
        tempGradient.setAttribute('y1', '0%');
        tempGradient.setAttribute('x2', '100%');
        tempGradient.setAttribute('y2', '0%');
        tempGradient.innerHTML = `
            <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:1" />
            <stop offset="50%" style="stop-color:#fbbf24;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#ef4444;stop-opacity:1" />
        `;
        
        // Humidity gradient (light blue to dark blue)
        const humidityGradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
        humidityGradient.setAttribute('id', 'humidityGradient');
        humidityGradient.setAttribute('x1', '0%');
        humidityGradient.setAttribute('y1', '0%');
        humidityGradient.setAttribute('x2', '100%');
        humidityGradient.setAttribute('y2', '0%');
        humidityGradient.innerHTML = `
            <stop offset="0%" style="stop-color:#7dd3fc;stop-opacity:1" />
            <stop offset="50%" style="stop-color:#3b82f6;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#1e40af;stop-opacity:1" />
        `;
        
        // pH gradient (red to green to blue)
        const phGradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
        phGradient.setAttribute('id', 'phGradient');
        phGradient.setAttribute('x1', '0%');
        phGradient.setAttribute('y1', '0%');
        phGradient.setAttribute('x2', '100%');
        phGradient.setAttribute('y2', '0%');
        phGradient.innerHTML = `
            <stop offset="0%" style="stop-color:#ef4444;stop-opacity:1" />
            <stop offset="50%" style="stop-color:#10b981;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#3b82f6;stop-opacity:1" />
        `;
        
        defs.appendChild(tempGradient);
        defs.appendChild(humidityGradient);
        defs.appendChild(phGradient);
        svg.appendChild(defs);
        
        // Set initial random values for demonstration
        setTimeout(() => {
            this.updateMeter('temperature', 25, 0, 50);
            this.updateMeter('humidity', 65, 0, 100);
            this.updateMeter('ph', 6.8, 3, 10);
        }, 1000);
        
        // Simulate sensor updates every 5 seconds
        setInterval(() => {
            // Simulate realistic sensor variations
            const temp = 20 + Math.random() * 15; // 20-35°C
            const humidity = 50 + Math.random() * 30; // 50-80%
            const ph = 5.5 + Math.random() * 2; // 5.5-7.5
            
            this.updateMeter('temperature', temp, 0, 50);
            this.updateMeter('humidity', humidity, 0, 100);
            this.updateMeter('ph', ph, 3, 10);
            
            // Add to trends chart
            this.addTrendDataPoint(temp, humidity, ph);
        }, 5000);
    }
    
    // Initialize Trends Chart
    initTrendsChart() {
        if (!this.trendsCanvas || !this.trendsCtx) {
            console.warn('Trends canvas not found');
            return;
        }

        // Set canvas size based on container
        const resizeCanvas = () => {
            const container = this.trendsCanvas.parentElement;
            if (container) {
                const rect = container.getBoundingClientRect();
                this.trendsCanvas.width = rect.width - 40;
                this.trendsCanvas.height = 300;
                this.drawTrendsChart();
            }
        };

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        // Initialize with some sample data
        this.addTrendDataPoint(25, 65, 6.8);
    }

    // Add data point to trends
    addTrendDataPoint(temp, humidity, ph) {
        const now = new Date();
        const timeLabel = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        this.trendData.labels.push(timeLabel);
        this.trendData.temperature.push(temp);
        this.trendData.humidity.push(humidity);
        this.trendData.ph.push(ph);

        // Check for alerts and show in Dynamic Island
        if (temp > 35) {
            this.showSensorAlert('temperature', `${temp.toFixed(1)}°C - High`);
        } else if (temp < 10) {
            this.showSensorAlert('temperature', `${temp.toFixed(1)}°C - Low`);
        }

        if (humidity > 85) {
            this.showSensorAlert('humidity', `${humidity.toFixed(0)}% - High`);
        } else if (humidity < 20) {
            this.showSensorAlert('humidity', `${humidity.toFixed(0)}% - Low`);
        }

        if (ph < 5.5 || ph > 8.0) {
            const status = ph < 5.5 ? 'Too Acidic' : 'Too Alkaline';
            this.showSensorAlert('ph', `${ph.toFixed(1)} - ${status}`);
        }

        // Keep only last maxTrendPoints
        if (this.trendData.labels.length > this.maxTrendPoints) {
            this.trendData.labels.shift();
            this.trendData.temperature.shift();
            this.trendData.humidity.shift();
            this.trendData.ph.shift();
        }

        this.drawTrendsChart();
    }

    // Initialize Hourly Weather Chart
    initHourlyWeatherChart() {
        const canvas = document.getElementById('hourlyWeatherChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        
        // Sample data for the chart
        this.hourlyData = {
            temperature: [29, 27, 26, 25, 24, 27, 32, 34],
            precipitation: [0, 5, 2, 0, 10, 15, 5, 0],
            wind: [18, 16, 12, 10, 8, 15, 18, 20],
            labels: ["6pm", "9pm", "12am", "3am", "6am", "9am", "12pm", "3pm"]
        };

        this.hourlyChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: this.hourlyData.labels,
                datasets: [{
                    label: 'Temperature (°C)',
                    data: this.hourlyData.temperature,
                    borderColor: '#FFD700',
                    backgroundColor: 'rgba(255, 215, 0, 0.2)',
                    fill: true,
                    tension: 0.4,
                    borderWidth: 3,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    pointBackgroundColor: '#FFD700',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        padding: 12,
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: '#FFD700',
                        borderWidth: 1
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)',
                            drawBorder: false
                        },
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.7)',
                            font: {
                                size: 11
                            }
                        }
                    },
                    x: {
                        grid: {
                            display: false,
                            drawBorder: false
                        },
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.7)',
                            font: {
                                size: 11
                            }
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        });
    }

    // Switch chart type (Temperature, Precipitation, Wind)
    switchChartType(type) {
        if (!this.hourlyChart) return;

        // Update active tab (both old and new mini tabs)
        document.querySelectorAll('.chart-tab, .chart-tab-mini').forEach(tab => {
            tab.classList.remove('active');
            if (tab.dataset.chart === type) {
                tab.classList.add('active');
            }
        });

        // Update chart data
        let data, label, color, bgColor;
        
        if (type === 'temperature') {
            data = this.hourlyData.temperature;
            label = 'Temperature (°C)';
            color = '#FFD700';
            bgColor = 'rgba(255, 215, 0, 0.2)';
        } else if (type === 'precipitation') {
            data = this.hourlyData.precipitation;
            label = 'Precipitation (%)';
            color = '#00BFFF';
            bgColor = 'rgba(0, 191, 255, 0.2)';
        } else if (type === 'wind') {
            data = this.hourlyData.wind;
            label = 'Wind (km/h)';
            color = '#90EE90';
            bgColor = 'rgba(144, 238, 144, 0.2)';
        }

        this.hourlyChart.data.datasets[0].data = data;
        this.hourlyChart.data.datasets[0].label = label;
        this.hourlyChart.data.datasets[0].borderColor = color;
        this.hourlyChart.data.datasets[0].backgroundColor = bgColor;
        this.hourlyChart.data.datasets[0].pointBackgroundColor = color;
        
        this.hourlyChart.update('active');
    }

    // Switch trend series
    switchTrendSeries(series) {
        this.currentTrendSeries = series;

        // Update button states
        document.querySelectorAll('.trend-btn').forEach(btn => {
            btn.classList.remove('active');
            btn.setAttribute('aria-pressed', 'false');
            if (btn.dataset.series === series) {
                btn.classList.add('active');
                btn.setAttribute('aria-pressed', 'true');
            }
        });

        this.drawTrendsChart();
    }

    // Draw the trends chart
    drawTrendsChart() {
        if (!this.trendsCtx || !this.trendsCanvas) return;

        const ctx = this.trendsCtx;
        const width = this.trendsCanvas.width;
        const height = this.trendsCanvas.height;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        if (this.trendData.labels.length === 0) {
            // Show "No data" message
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.font = '16px Segoe UI';
            ctx.textAlign = 'center';
            ctx.fillText('Waiting for sensor data...', width / 2, height / 2);
            return;
        }

        // Get current series data
        const data = this.trendData[this.currentTrendSeries];
        const labels = this.trendData.labels;

        // Calculate min and max for scaling
        const min = Math.min(...data);
        const max = Math.max(...data);
        const range = max - min || 1;

        // Define padding
        const padding = { top: 30, right: 40, bottom: 50, left: 60 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        // Draw grid lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        
        // Horizontal grid lines
        for (let i = 0; i <= 5; i++) {
            const y = padding.top + (chartHeight / 5) * i;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(width - padding.right, y);
            ctx.stroke();

            // Y-axis labels
            const value = max - (range / 5) * i;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.font = '12px Segoe UI';
            ctx.textAlign = 'right';
            ctx.fillText(value.toFixed(1), padding.left - 10, y + 4);
        }

        // Vertical grid lines and X-axis labels
        const stepX = chartWidth / (labels.length - 1 || 1);
        labels.forEach((label, i) => {
            const x = padding.left + stepX * i;
            
            // Grid line
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.beginPath();
            ctx.moveTo(x, padding.top);
            ctx.lineTo(x, height - padding.bottom);
            ctx.stroke();

            // X-axis label (show every other label to avoid crowding)
            if (i % Math.ceil(labels.length / 6) === 0) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
                ctx.font = '11px Segoe UI';
                ctx.textAlign = 'center';
                ctx.save();
                ctx.translate(x, height - padding.bottom + 15);
                ctx.rotate(-Math.PI / 6);
                ctx.fillText(label, 0, 0);
                ctx.restore();
            }
        });

        // Draw the line chart
        ctx.beginPath();
        ctx.lineWidth = 3;
        
        // Set color based on series
        const colors = {
            temperature: '#ef4444',
            humidity: '#3b82f6',
            ph: '#10b981'
        };
        ctx.strokeStyle = colors[this.currentTrendSeries] || '#60a5fa';

        data.forEach((value, i) => {
            const x = padding.left + stepX * i;
            const y = padding.top + chartHeight - ((value - min) / range) * chartHeight;
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });

        ctx.stroke();

        // Draw gradient fill under line
        const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
        gradient.addColorStop(0, colors[this.currentTrendSeries] + '40');
        gradient.addColorStop(1, colors[this.currentTrendSeries] + '00');

        ctx.beginPath();
        data.forEach((value, i) => {
            const x = padding.left + stepX * i;
            const y = padding.top + chartHeight - ((value - min) / range) * chartHeight;
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.lineTo(padding.left + stepX * (data.length - 1), height - padding.bottom);
        ctx.lineTo(padding.left, height - padding.bottom);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();

        // Draw data points
        ctx.fillStyle = colors[this.currentTrendSeries] || '#60a5fa';
        data.forEach((value, i) => {
            const x = padding.left + stepX * i;
            const y = padding.top + chartHeight - ((value - min) / range) * chartHeight;
            
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fill();
            
            // Glow effect
            ctx.shadowColor = colors[this.currentTrendSeries] || '#60a5fa';
            ctx.shadowBlur = 10;
            ctx.fill();
            ctx.shadowBlur = 0;
        });

        // Draw axis labels
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = 'bold 14px Segoe UI';
        ctx.textAlign = 'center';

        // Y-axis label
        ctx.save();
        ctx.translate(20, height / 2);
        ctx.rotate(-Math.PI / 2);
        const units = {
            temperature: 'Temperature (°C)',
            humidity: 'Humidity (%)',
            ph: 'Soil pH'
        };
        ctx.fillText(units[this.currentTrendSeries] || 'Value', 0, 0);
        ctx.restore();

        // X-axis label
        ctx.fillText('Time', width / 2, height - 10);

        // Draw current value indicator
        if (data.length > 0) {
            const currentValue = data[data.length - 1];
            ctx.fillStyle = colors[this.currentTrendSeries] || '#60a5fa';
            ctx.font = 'bold 16px Segoe UI';
            ctx.textAlign = 'left';
            ctx.fillText(`Current: ${currentValue.toFixed(1)}`, width - padding.right - 100, 25);
        }
    }
    
    switchWeatherTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.weather-tab').forEach(tab => {
            tab.classList.remove('active');
            if (tab.dataset.tab === tabName) {
                tab.classList.add('active');
            }
        });

        // Update tab content
        document.querySelectorAll('.weather-tab-content').forEach(content => {
            content.classList.remove('active');
        });

        if (tabName === 'main') {
            document.getElementById('mainWeatherTab').classList.add('active');
        } else {
            document.getElementById('detailsWeatherTab').classList.add('active');
        }
    }

    // Switch main tabs (Terminal, Weather, Emergency, Analytics, Config)
    switchMainTab(tabName) {
        // Update tab buttons (both main-tab and sidebar-item)
        document.querySelectorAll('.main-tab, .sidebar-item').forEach(tab => {
            tab.classList.remove('active');
            tab.setAttribute('aria-pressed', 'false');
            if (tab.dataset.tab === tabName) {
                tab.classList.add('active');
                tab.setAttribute('aria-pressed', 'true');
            }
        });

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });

        // Map tab names to their content IDs
        const tabContentMap = {
            'terminal': 'terminalTab',
            'weather': 'weatherTab',
            'emergency': 'emergencyTab',
            'analytics': 'analyticsTab',
            'config': 'configTab'
        };

        const contentId = tabContentMap[tabName];
        if (contentId) {
            document.getElementById(contentId)?.classList.add('active');
        }

        // Save last active tab
        localStorage.setItem('lastActiveTab', tabName);
    }

    // Toggle config menu visibility with F5
    toggleConfigMenu() {
        const configTab = document.querySelector('.sidebar-item[data-tab="config"]');
        const configContent = document.getElementById('configTab');
        
        if (configTab && configContent) {
            const isHidden = configTab.style.display === 'none';
            
            if (isHidden) {
                // Show config
                configTab.style.display = 'flex';
                this.showNotification('Config menu unlocked 🔓');
            } else {
                // Hide config and switch to terminal if config is active
                if (configContent.classList.contains('active')) {
                    this.switchMainTab('terminal');
                }
                configTab.style.display = 'none';
                this.showNotification('Config menu locked 🔒');
            }
        }
    }

    // Switch theme (Normal, Light, Dark)
    switchTheme(theme) {
        // Remove all theme classes
        document.body.classList.remove('theme-light', 'theme-dark', 'theme-normal');
        
        // Add selected theme class
        if (theme !== 'normal') {
            document.body.classList.add(`theme-${theme}`);
        }
        
        // Update active button
        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.theme === theme) {
                btn.classList.add('active');
            }
        });
        
        // Save theme preference
        localStorage.setItem('sosTheme', theme);
        
        // Show notification
        const themeNames = {
            'normal': 'Normal (Purple/Pink)',
            'light': 'Light Mode',
            'dark': 'Dark Mode'
        };
        this.showToast('Theme Changed', `Switched to ${themeNames[theme]} theme`, 'info');
        
        // Redraw charts with new colors
        if (this.trendsCanvas) {
            this.drawTrendsChart();
        }
    }

    // Initialize config page listeners
    initConfigListeners() {
        // Font size slider
        const fontSizeSlider = document.getElementById('fontSize');
        const fontSizeValue = document.getElementById('fontSizeValue');
        if (fontSizeSlider && fontSizeValue) {
            fontSizeSlider.addEventListener('input', (e) => {
                const size = e.target.value;
                fontSizeValue.textContent = `${size}px`;
                if (this.terminal) {
                    this.terminal.style.fontSize = `${size}px`;
                }
            });
        }

        // Save config button
        const saveConfigBtn = document.getElementById('saveConfig');
        if (saveConfigBtn) {
            saveConfigBtn.addEventListener('click', () => {
                this.saveConfiguration();
            });
        }

        // Reset config button
        const resetConfigBtn = document.getElementById('resetConfig');
        if (resetConfigBtn) {
            resetConfigBtn.addEventListener('click', () => {
                this.resetConfiguration();
            });
        }

        // Export config button
        const exportConfigBtn = document.getElementById('exportConfig');
        if (exportConfigBtn) {
            exportConfigBtn.addEventListener('click', () => {
                this.exportConfiguration();
            });
        }

        // Import config button
        const importConfigBtn = document.getElementById('importConfig');
        if (importConfigBtn) {
            importConfigBtn.addEventListener('click', () => {
                this.importConfiguration();
            });
        }

        // Trend points input
        const trendPointsInput = document.getElementById('trendPoints');
        if (trendPointsInput) {
            trendPointsInput.addEventListener('change', (e) => {
                this.maxTrendPoints = parseInt(e.target.value) || 20;
            });
        }

        // Load saved configuration
        this.loadConfiguration();
    }

    // Save configuration
    saveConfiguration() {
        try {
            const config = {
                baudRate: document.getElementById('baudRate')?.value || '115200',
                dataBits: document.getElementById('dataBits')?.value || '8',
                stopBits: document.getElementById('stopBits')?.value || '1',
                parity: document.getElementById('parity')?.value || 'none',
                autoScroll: document.getElementById('autoScrollConfig')?.checked ?? true,
                timestamps: document.getElementById('timestampsConfig')?.checked ?? false,
                soundEffects: document.getElementById('soundEffectsConfig')?.checked ?? true,
                fontSize: document.getElementById('fontSize')?.value || '16',
                maxLogSize: document.getElementById('maxLogSize')?.value || '1000',
                trendPoints: document.getElementById('trendPoints')?.value || '20',
                updateInterval: document.getElementById('updateInterval')?.value || '5000',
                emergencyAlerts: document.getElementById('emergencyAlerts')?.checked ?? true,
                systemNotifications: document.getElementById('systemNotifications')?.checked ?? true,
                weatherAlerts: document.getElementById('weatherAlerts')?.checked ?? true,
                location: document.getElementById('locationInput')?.value || '',
                tempUnit: document.getElementById('tempUnit')?.value || 'celsius'
            };

            localStorage.setItem('sosConnectConfig', JSON.stringify(config));
            this.showToast('Success', 'Configuration saved successfully!', 'success');
        } catch (e) {
            console.error('Error saving configuration:', e);
            this.showToast('Error', 'Failed to save configuration', 'error');
        }
    }

    // Load configuration
    loadConfiguration() {
        try {
            const saved = localStorage.getItem('sosConnectConfig');
            if (saved) {
                const config = JSON.parse(saved);
                
                // Apply saved configuration
                const baudRate = document.getElementById('baudRate');
                if (baudRate) baudRate.value = config.baudRate || '115200';
                
                const dataBits = document.getElementById('dataBits');
                if (dataBits) dataBits.value = config.dataBits || '8';
                
                const stopBits = document.getElementById('stopBits');
                if (stopBits) stopBits.value = config.stopBits || '1';
                
                const parity = document.getElementById('parity');
                if (parity) parity.value = config.parity || 'none';
                
                const autoScrollConfig = document.getElementById('autoScrollConfig');
                if (autoScrollConfig) autoScrollConfig.checked = config.autoScroll ?? true;
                
                const timestampsConfig = document.getElementById('timestampsConfig');
                if (timestampsConfig) timestampsConfig.checked = config.timestamps ?? false;
                
                const soundEffectsConfig = document.getElementById('soundEffectsConfig');
                if (soundEffectsConfig) soundEffectsConfig.checked = config.soundEffects ?? true;
                
                const fontSize = document.getElementById('fontSize');
                const fontSizeValue = document.getElementById('fontSizeValue');
                if (fontSize && fontSizeValue) {
                    fontSize.value = config.fontSize || '16';
                    fontSizeValue.textContent = `${config.fontSize || '16'}px`;
                    if (this.terminal) {
                        this.terminal.style.fontSize = `${config.fontSize || '16'}px`;
                    }
                }
                
                const maxLogSize = document.getElementById('maxLogSize');
                if (maxLogSize) maxLogSize.value = config.maxLogSize || '1000';
                
                const trendPoints = document.getElementById('trendPoints');
                if (trendPoints) {
                    trendPoints.value = config.trendPoints || '20';
                    this.maxTrendPoints = parseInt(config.trendPoints) || 20;
                }
                
                const updateInterval = document.getElementById('updateInterval');
                if (updateInterval) updateInterval.value = config.updateInterval || '5000';
                
                const emergencyAlerts = document.getElementById('emergencyAlerts');
                if (emergencyAlerts) emergencyAlerts.checked = config.emergencyAlerts ?? true;
                
                const systemNotifications = document.getElementById('systemNotifications');
                if (systemNotifications) systemNotifications.checked = config.systemNotifications ?? true;
                
                const weatherAlerts = document.getElementById('weatherAlerts');
                if (weatherAlerts) weatherAlerts.checked = config.weatherAlerts ?? true;
                
                const locationInput = document.getElementById('locationInput');
                if (locationInput) locationInput.value = config.location || '';
                
                const tempUnit = document.getElementById('tempUnit');
                if (tempUnit) tempUnit.value = config.tempUnit || 'celsius';
            }

            // Load last active tab
            const lastTab = localStorage.getItem('lastActiveTab') || 'terminal';
            this.switchMainTab(lastTab);
        } catch (e) {
            console.error('Error loading configuration:', e);
        }
    }

    // Reset configuration to defaults
    resetConfiguration() {
        if (confirm('Are you sure you want to reset all settings to default values?')) {
            localStorage.removeItem('sosConnectConfig');
            location.reload();
        }
    }

    // Export configuration
    exportConfiguration() {
        try {
            const config = localStorage.getItem('sosConnectConfig');
            if (!config) {
                this.showToast('Info', 'No configuration to export', 'info');
                return;
            }

            const blob = new Blob([config], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `sos-connect-config-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            this.showToast('Success', 'Configuration exported successfully!', 'success');
        } catch (e) {
            console.error('Error exporting configuration:', e);
            this.showToast('Error', 'Failed to export configuration', 'error');
        }
    }

    // Import configuration
    importConfiguration() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const config = JSON.parse(event.target.result);
                    localStorage.setItem('sosConnectConfig', JSON.stringify(config));
                    this.showToast('Success', 'Configuration imported successfully! Reloading...', 'success');
                    setTimeout(() => location.reload(), 1500);
                } catch (e) {
                    console.error('Error importing configuration:', e);
                    this.showToast('Error', 'Invalid configuration file', 'error');
                }
            };
            reader.readAsText(file);
        };

        input.click();
    }

    openCropWiki(cropIndex) {
        if (!this.currentCrops || !this.currentCrops[cropIndex]) return;

        const crop = this.currentCrops[cropIndex];
        this.cropWikiIcon.textContent = crop.emoji;
        this.cropWikiTitle.textContent = crop.name;

        // Generate comprehensive crop information
        const wikiContent = this.generateCropWiki(crop);
        this.cropWikiContent.innerHTML = wikiContent;

        this.cropWikiOverlay.classList.add('show');
    }

    closeCropWiki() {
        this.cropWikiOverlay.classList.remove('show');
    }

    generateCropWiki(crop) {
        const cropData = {
            'Rice': {
                scientificName: 'Oryza sativa',
                family: 'Poaceae (Grass family)',
                origin: 'Asia, primarily India and China',
                description: 'Rice is a cereal grain and the staple food for over half of the world\'s population. It is the most important grain with regard to human nutrition and caloric intake.',
                cultivation: 'Rice requires warm temperatures (20-35°C), high humidity, and abundant water. It grows best in flooded paddy fields.',
                soilRequirements: 'Clay or clay loam soil with pH 5.5-7.0. Requires good water retention capacity.',
                waterRequirements: 'Very high - needs continuous flooding during growing season (1200-2000mm annually)',
                growingPeriod: '90-180 days depending on variety',
                varieties: 'Basmati, Jasmine, Arborio, Japonica, Indica',
                nutrients: 'Rich in carbohydrates, provides protein, B vitamins, and minerals',
                uses: 'Staple food, rice flour, rice bran oil, animal feed, alcoholic beverages',
                diseases: 'Blast, bacterial blight, sheath blight, brown spot'
            },
            'Wheat': {
                scientificName: 'Triticum aestivum',
                family: 'Poaceae (Grass family)',
                origin: 'Fertile Crescent region of the Middle East',
                description: 'Wheat is one of the oldest and most important cereal crops, serving as a staple food for billions. It is primarily used to make flour for bread, pasta, and other baked goods.',
                cultivation: 'Grows in temperate climates (10-25°C). Requires well-drained soil and moderate rainfall.',
                soilRequirements: 'Loamy soil with pH 6.0-7.5. Good drainage is essential.',
                waterRequirements: 'Moderate - 450-650mm during growing season',
                growingPeriod: '120-150 days',
                varieties: 'Hard Red Winter, Soft Red Winter, Hard Red Spring, Durum',
                nutrients: 'High in carbohydrates, protein, fiber, B vitamins, iron',
                uses: 'Flour production, bread, pasta, breakfast cereals, animal feed',
                diseases: 'Rust diseases, powdery mildew, fusarium head blight'
            },
            'Cotton': {
                scientificName: 'Gossypium',
                family: 'Malvaceae',
                origin: 'Tropical and subtropical regions',
                description: 'Cotton is the world\'s most important natural fiber crop. The soft, fluffy staple fiber grows in a protective case around the seeds of cotton plants.',
                cultivation: 'Requires warm climate (21-30°C), long frost-free period (180-200 days), and bright sunshine.',
                soilRequirements: 'Well-drained sandy loam to clay loam with pH 5.8-8.0',
                waterRequirements: 'High - 700-1300mm, especially during flowering and boll development',
                growingPeriod: '150-180 days',
                varieties: 'Upland cotton, Egyptian cotton, Sea Island cotton, Asiatic cotton',
                nutrients: 'Cotton seed oil is rich in vitamin E and unsaturated fatty acids',
                uses: 'Textile fiber, cottonseed oil, animal feed, paper production',
                diseases: 'Bollworm, cotton leaf curl virus, bacterial blight, fusarium wilt'
            },
            'Sugarcane': {
                scientificName: 'Saccharum officinarum',
                family: 'Poaceae (Grass family)',
                origin: 'New Guinea and Southeast Asia',
                description: 'Sugarcane is a tropical grass cultivated primarily for its sweet juice from which sugar is processed. It accounts for 80% of the world\'s sugar production.',
                cultivation: 'Requires tropical/subtropical climate (20-30°C), high rainfall, and bright sunshine.',
                soilRequirements: 'Deep, well-drained loamy soil with pH 6.0-7.5',
                waterRequirements: 'Very high - 1500-2500mm annually, needs consistent moisture',
                growingPeriod: '12-18 months',
                varieties: 'Co 0238, Co 86032, CoJ 64, Co 98014',
                nutrients: 'Source of sucrose, molasses contains minerals and vitamins',
                uses: 'Sugar production, jaggery, ethanol, bagasse for paper/fuel',
                diseases: 'Red rot, smut, rust, grassy shoot disease'
            },
            'Maize': {
                scientificName: 'Zea mays',
                family: 'Poaceae (Grass family)',
                origin: 'Southern Mexico',
                description: 'Maize or corn is one of the most widely grown crops in the world. It serves as a staple food in many regions and is used extensively in animal feed and industrial applications.',
                cultivation: 'Requires warm temperatures (18-32°C) and frost-free growing season.',
                soilRequirements: 'Well-drained loamy soil with pH 5.8-7.0',
                waterRequirements: 'Moderate to high - 500-800mm during growing season',
                growingPeriod: '80-120 days depending on variety',
                varieties: 'Dent corn, Flint corn, Sweet corn, Popcorn, Baby corn',
                nutrients: 'Rich in carbohydrates, vitamins A, B, E, minerals',
                uses: 'Food, animal feed, corn oil, corn starch, biofuel',
                diseases: 'Maize streak virus, corn smut, northern leaf blight'
            },
            'Groundnut': {
                scientificName: 'Arachis hypogaea',
                family: 'Fabaceae (Legume family)',
                origin: 'South America',
                description: 'Groundnut or peanut is a legume crop grown mainly for its edible seeds. It is a valuable source of oil and protein.',
                cultivation: 'Requires warm climate (20-30°C) and sandy loam soil.',
                soilRequirements: 'Well-drained sandy loam with pH 6.0-6.5',
                waterRequirements: 'Moderate - 500-700mm during growing season',
                growingPeriod: '90-140 days',
                varieties: 'Spanish, Virginia, Valencia, Runner types',
                nutrients: 'High in protein, healthy fats, vitamins E and B, minerals',
                uses: 'Edible oil, peanut butter, snacks, animal feed, biodiesel',
                diseases: 'Leaf spot, rust, collar rot, stem rot'
            }
        };

        const info = cropData[crop.name] || {};

        return `
            <div class="wiki-section">
                <h3>🔬 Scientific Classification</h3>
                <p><strong>Scientific Name:</strong> ${info.scientificName || 'N/A'}</p>
                <p><strong>Family:</strong> ${info.family || 'N/A'}</p>
                <p><strong>Origin:</strong> ${info.origin || 'N/A'}</p>
            </div>

            <div class="wiki-section">
                <h3>📖 Description</h3>
                <p>${info.description || crop.info}</p>
            </div>

            <div class="wiki-section">
                <h3>🌱 Cultivation Requirements</h3>
                <p>${info.cultivation || 'Information not available'}</p>
                <p><strong>Growing Period:</strong> ${info.growingPeriod || 'Varies'}</p>
            </div>

            <div class="wiki-section">
                <h3>🌾 Soil & Water Requirements</h3>
                <p><strong>Soil:</strong> ${info.soilRequirements || 'Well-drained fertile soil'}</p>
                <p><strong>Water:</strong> ${info.waterRequirements || 'Moderate watering required'}</p>
            </div>

            <div class="wiki-section">
                <h3>🌿 Popular Varieties</h3>
                <p>${info.varieties || 'Multiple varieties available'}</p>
            </div>

            <div class="wiki-section">
                <h3>💊 Nutritional Value</h3>
                <p>${info.nutrients || 'Good source of nutrients'}</p>
            </div>

            <div class="wiki-section">
                <h3>🏭 Uses & Applications</h3>
                <p>${info.uses || 'Food and industrial uses'}</p>
            </div>

            <div class="wiki-section">
                <h3>⚠️ Common Diseases & Pests</h3>
                <p>${info.diseases || 'Subject to various pests and diseases'}</p>
            </div>

            <div class="wiki-section wiki-tips">
                <h3>💡 Pro Farming Tips</h3>
                <ul>
                    <li>Prepare soil well before planting with organic matter</li>
                    <li>Follow recommended spacing for optimal yield</li>
                    <li>Monitor for pests and diseases regularly</li>
                    <li>Apply fertilizers based on soil test results</li>
                    <li>Ensure proper irrigation during critical growth stages</li>
                    <li>Practice crop rotation to maintain soil health</li>
                </ul>
            </div>
        `;
    }

    toggleModeMenu() {
        this.aiModeMenu.classList.toggle('show');
    }

    async switchAIMode(mode) {
        if (mode === 'gemini') {
            // Check if API key exists
            if (!this.geminiApiKey) {
                const apiKey = prompt('Enter your Google Gemini API Key:\n\nGet your free API key from:\nhttps://makersuite.google.com/app/apikey');
                if (!apiKey) {
                    this.addAIMessage('❌ Gemini API key is required to use Gemini AI mode. Staying in SOS AI mode.', 'assistant');
                    return;
                }
                this.geminiApiKey = apiKey;
                localStorage.setItem('geminiApiKey', apiKey);
            }

            // Test internet connectivity
            const isOnline = await this.checkInternetConnection();
            if (!isOnline) {
                this.addAIMessage('❌ No internet connection detected. Gemini AI requires internet. Staying in SOS AI mode.', 'assistant');
                return;
            }
        }

        this.currentAIMode = mode;
        localStorage.setItem('sosAIMode', mode);
        this.updateAIModeUI();
        this.aiModeMenu.classList.remove('show');

        // Add system message
        if (mode === 'gemini') {
            this.addAIMessage('🌟 <strong>Switched to Gemini AI</strong><br>You now have access to advanced AI capabilities powered by Google Gemini. Ask me anything!<br><br><small>Type <code>#sos</code> to switch back to SOS AI</small>', 'assistant');
        } else {
            this.addAIMessage('⚡ <strong>Switched to SOS AI</strong><br>Using fast offline responses. Perfect for quick queries about serial monitoring, weather, and crops.<br><br><small>Type <code>#gemini</code> to switch to Gemini AI</small>', 'assistant');
        }
    }

    updateAIModeUI() {
        const modeIcon = this.aiModeSelector.querySelector('.mode-icon');
        const modeText = this.aiModeSelector.querySelector('.mode-text');
        
        // Update selector button
        if (this.currentAIMode === 'gemini') {
            modeIcon.textContent = '🌟';
            modeText.textContent = 'Gemini AI';
            this.aiModeSelector.style.background = 'linear-gradient(135deg, rgba(66, 133, 244, 0.2), rgba(219, 68, 55, 0.2))';
            this.aiModeSelector.style.borderColor = 'rgba(66, 133, 244, 0.5)';
            this.aiStatus.textContent = 'Powered by Gemini';
        } else {
            modeIcon.textContent = '⚡';
            modeText.textContent = 'SOS AI';
            this.aiModeSelector.style.background = 'rgba(96, 165, 250, 0.1)';
            this.aiModeSelector.style.borderColor = 'rgba(96, 165, 250, 0.3)';
            this.aiStatus.textContent = '';
        }

        // Update checkmarks in menu
        document.querySelectorAll('.mode-option').forEach(option => {
            const check = option.querySelector('.mode-check');
            if (option.dataset.mode === this.currentAIMode) {
                option.classList.add('active');
                check.style.opacity = '1';
            } else {
                option.classList.remove('active');
                check.style.opacity = '0';
            }
        });
    }

    async checkInternetConnection() {
        try {
            const response = await fetch('https://www.google.com/favicon.ico', {
                mode: 'no-cors',
                cache: 'no-cache'
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    setGeminiApiKey() {
        const currentKey = this.geminiApiKey ? '(already set)' : '';
        const apiKey = prompt(`Enter your Google Gemini API Key ${currentKey}:\n\nGet your free API key from:\nhttps://makersuite.google.com/app/apikey\n\nNote: Your key will be stored locally in your browser.`);
        
        if (apiKey === null) return; // User cancelled
        
        if (!apiKey || apiKey.trim() === '') {
            alert('❌ API key cannot be empty.');
            return;
        }

        // Basic validation (Gemini API keys typically start with "AIza")
        if (!apiKey.startsWith('AIza')) {
            const proceed = confirm('⚠️ This doesn\'t look like a valid Gemini API key (should start with "AIza"). Do you want to save it anyway?');
            if (!proceed) return;
        }

        this.geminiApiKey = apiKey.trim();
        localStorage.setItem('geminiApiKey', this.geminiApiKey);
        this.updateApiKeyStatus();
        this.addAIMessage('✅ <strong>Gemini API Key Updated</strong><br>Your API key has been saved successfully. You can now use Gemini AI mode.', 'assistant');
        this.showNotification('API key saved successfully!');
    }

    viewGeminiApiKey() {
        if (!this.geminiApiKey) {
            alert('No API key is currently set.');
            return;
        }

        // Show masked version with option to reveal
        const maskedKey = this.geminiApiKey.substring(0, 10) + '•'.repeat(this.geminiApiKey.length - 14) + this.geminiApiKey.substring(this.geminiApiKey.length - 4);
        const reveal = confirm(`Current API Key:\n${maskedKey}\n\nClick OK to reveal the full key, or Cancel to close.`);
        
        if (reveal) {
            // Create a temporary textarea to allow copying
            const textarea = document.createElement('textarea');
            textarea.value = this.geminiApiKey;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            
            try {
                document.execCommand('copy');
                alert(`Full API Key:\n${this.geminiApiKey}\n\n✓ Copied to clipboard!`);
            } catch (err) {
                alert(`Full API Key:\n${this.geminiApiKey}\n\n(Could not copy to clipboard)`);
            }
            
            document.body.removeChild(textarea);
        }
    }

    removeGeminiApiKey() {
        if (!this.geminiApiKey) {
            alert('No API key to remove.');
            return;
        }

        const confirm = window.confirm('⚠️ Are you sure you want to remove your Gemini API key?\n\nYou will need to enter it again to use Gemini AI.');
        if (!confirm) return;

        this.geminiApiKey = '';
        localStorage.removeItem('geminiApiKey');
        this.updateApiKeyStatus();
        
        // Switch back to SOS AI if currently using Gemini
        if (this.currentAIMode === 'gemini') {
            this.switchAIMode('sos');
        }
        
        this.addAIMessage('🔓 <strong>API Key Removed</strong><br>Your Gemini API key has been removed from local storage.', 'assistant');
        this.showNotification('API key removed');
    }

    updateApiKeyStatus() {
        const statusText = this.apiKeyStatus.querySelector('.api-status-text');
        
        if (this.geminiApiKey) {
            const maskedKey = this.geminiApiKey.substring(0, 6) + '•'.repeat(8) + this.geminiApiKey.substring(this.geminiApiKey.length - 4);
            statusText.innerHTML = `<span style="color: #4ade80;">✓</span> Key: ${maskedKey}`;
            this.apiKeyStatus.style.background = 'rgba(74, 222, 128, 0.1)';
            this.apiKeyStatus.style.borderColor = 'rgba(74, 222, 128, 0.3)';
            
            // Show view and remove buttons, update set button text
            this.setApiKeyBtn.innerHTML = '<span>🔄</span> Change Key';
            this.viewApiKeyBtn.style.display = 'inline-flex';
            this.removeApiKeyBtn.style.display = 'inline-flex';
        } else {
            statusText.innerHTML = '<span style="color: #ef4444;">✗</span> No API key set';
            this.apiKeyStatus.style.background = 'rgba(239, 68, 68, 0.1)';
            this.apiKeyStatus.style.borderColor = 'rgba(239, 68, 68, 0.3)';
            
            // Hide view and remove buttons, reset set button text
            this.setApiKeyBtn.innerHTML = '<span>🔧</span> Set Key';
            this.viewApiKeyBtn.style.display = 'none';
            this.removeApiKeyBtn.style.display = 'none';
        }
    }

    async generateGeminiResponse(question) {
        try {
            this.aiStatus.textContent = 'Thinking with Gemini...';
            
            // Show AI thinking in Dynamic Island
            this.showAIThinking();

            // Build context from conversation history (limit to prevent token overflow)
            const recentHistory = this.conversationHistory.slice(-4).map(msg => ({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.message || msg.content }]
            }));

            // Add system instruction as first message with context
            const systemContext = `You are SOS AI powered by Google Gemini. Help users with:
- Serial communication and device monitoring
- Weather analysis and forecasting
- Agricultural crop recommendations
- Emergency response guidance
- IoT sensor data interpretation

Current Context:
- Location: ${this.weatherLocation ? this.weatherLocation.textContent : 'Unknown'}
- Weather: ${this.weatherTemp ? this.weatherTemp.textContent : 'Unknown'}
- Season: ${this.cropSeason ? this.cropSeason.textContent.replace('Current Season: ', '').split('<')[0] : 'Unknown'}

Provide helpful, accurate, and concise responses.`;

            // Use the updated model name (gemini-1.5-flash or gemini-1.5-pro)
            // CORRECT model name
const model = 'gemini-1.5-flash-latest';
const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.geminiApiKey}`;
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    system_instruction: {
                        parts: [{ text: systemContext }]
                    },
                    contents: [
                        ...recentHistory,
                        {
                            role: 'user',
                            parts: [{ text: question }]
                        }
                    ],
                    generationConfig: {
                        temperature: 0.7,
                        topK: 40,
                        topP: 0.95,
                        maxOutputTokens: 2048,
                        candidateCount: 1
                    },
                    safetySettings: [
                        {
                            category: 'HARM_CATEGORY_HARASSMENT',
                            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
                        },
                        {
                            category: 'HARM_CATEGORY_HATE_SPEECH',
                            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
                        },
                        {
                            category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
                            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
                        },
                        {
                            category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
                            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
                        }
                    ]
                })
            });

            this.aiStatus.textContent = 'Powered by Gemini';
            
            // Hide AI thinking in Dynamic Island
            this.hideAIThinking();

            if (!response.ok) {
                let errorMessage = 'Unknown error';
                try {
                    const errorData = await response.json();
                    console.error('Gemini API Error:', errorData);
                    errorMessage = errorData.error?.message || JSON.stringify(errorData);
                    
                    // Handle specific error cases
                    if (response.status === 400) {
                        if (errorMessage.includes('API_KEY_INVALID') || errorMessage.includes('API key not valid')) {
                            localStorage.removeItem('geminiApiKey');
                            this.geminiApiKey = '';
                            return '❌ Invalid API key. Please set a valid Gemini API key in the Configuration tab.';
                        }
                        if (errorMessage.includes('quota')) {
                            return '❌ API quota exceeded. Please check your Gemini API usage limits.';
                        }
                    }
                    if (response.status === 403) {
                        return '❌ Access denied. Please check your API key permissions.';
                    }
                    if (response.status === 429) {
                        return '❌ Rate limit exceeded. Please wait a moment and try again.';
                    }
                } catch (parseError) {
                    errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                }
                
                return `❌ Gemini API Error (${response.status}): ${errorMessage}\n\nFalling back to SOS AI:\n\n${this.generateAIResponse(question)}`;
            }

            const data = await response.json();
            console.log('Gemini Response:', data); // Debug logging
            
            // Check for blocked content
            if (data.promptFeedback?.blockReason) {
                return `⚠️ Content blocked by safety filters: ${data.promptFeedback.blockReason}\n\nFalling back to SOS AI:\n\n${this.generateAIResponse(question)}`;
            }
            
            // Extract response text
            if (data.candidates && data.candidates.length > 0) {
                const candidate = data.candidates[0];
                
                // Check finish reason
                if (candidate.finishReason === 'SAFETY') {
                    return '⚠️ Response blocked by safety filters. Falling back to SOS AI:\n\n' + this.generateAIResponse(question);
                }
                
                if (candidate.content?.parts?.[0]?.text) {
                    return candidate.content.parts[0].text;
                }
            }
            
            return '❌ No response generated from Gemini. Falling back to SOS AI:\n\n' + this.generateAIResponse(question);

        } catch (error) {
            console.error('Gemini API Error:', error);
            this.aiStatus.textContent = 'Powered by Gemini';
            
            // Hide AI thinking in Dynamic Island
            this.hideAIThinking();
            
            // Provide more specific error messages
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                return `❌ Network error: Unable to reach Gemini API. Check your internet connection.\n\nFalling back to SOS AI:\n\n${this.generateAIResponse(question)}`;
            }
            
            return `❌ Unexpected error: ${error.message}\n\nFalling back to SOS AI:\n\n${this.generateAIResponse(question)}`;
        }
    }

    updateMeter(type, value, min, max) {
        // Calculate percentage (0-100)
        const percentage = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
        
        // For NEW circular gauges (full circle)
        const circleCircumference = 2 * Math.PI * 80; // 502.65
        const circleOffset = circleCircumference - (percentage / 100) * circleCircumference;
        
        // Calculate angle for OLD semi-circle (180 degrees = π radians)
        const angle = (percentage / 100) * Math.PI;
        
        // Calculate position on arc
        const radius = 80;
        const centerX = 100;
        const centerY = 100;
        const x = centerX - radius * Math.cos(angle);
        const y = centerY - radius * Math.sin(angle);
        
        // Update based on meter type
        if (type === 'temperature') {
            this.tempValue.textContent = `${value.toFixed(1)}°C`;
            
            // Update NEW circular gauge
            const newGauge = document.getElementById('tempGaugeFill');
            if (newGauge) {
                newGauge.style.strokeDasharray = circleCircumference;
                newGauge.style.strokeDashoffset = circleOffset;
            }
            
            // Update OLD semi-circle gauge (compatibility)
            if (this.tempMeterDot) {
                this.tempMeterDot.setAttribute('cx', x);
                this.tempMeterDot.setAttribute('cy', y);
            }
            if (this.tempMeterFill) {
                const offset = 251.2 - (percentage / 100) * 251.2;
                this.tempMeterFill.style.strokeDashoffset = offset;
            }
        } else if (type === 'humidity') {
            this.humidityValue.textContent = `${value.toFixed(0)}%`;
            
            // Update NEW circular gauge
            const newGauge = document.getElementById('humidityGaugeFill');
            if (newGauge) {
                newGauge.style.strokeDasharray = circleCircumference;
                newGauge.style.strokeDashoffset = circleOffset;
            }
            
            // Update OLD semi-circle gauge (compatibility)
            if (this.humidityMeterDot) {
                this.humidityMeterDot.setAttribute('cx', x);
                this.humidityMeterDot.setAttribute('cy', y);
            }
            if (this.humidityMeterFill) {
                const offset = 251.2 - (percentage / 100) * 251.2;
                this.humidityMeterFill.style.strokeDashoffset = offset;
            }
        } else if (type === 'ph') {
            this.phValue.textContent = value.toFixed(1);
            
            // Update NEW circular gauge
            const newGauge = document.getElementById('phGaugeFill');
            if (newGauge) {
                newGauge.style.strokeDasharray = circleCircumference;
                newGauge.style.strokeDashoffset = circleOffset;
            }
            
            // Update OLD semi-circle gauge (compatibility)
            if (this.phMeterDot) {
                this.phMeterDot.setAttribute('cx', x);
                this.phMeterDot.setAttribute('cy', y);
            }
            if (this.phMeterFill) {
                const offset = 251.2 - (percentage / 100) * 251.2;
                this.phMeterFill.style.strokeDashoffset = offset;
            }
            
            // Update pH status
            if (this.phStatus) {
                if (value < 6.0) {
                    this.phStatus.textContent = 'Acidic';
                    this.phStatus.style.color = '#ef4444';
                    this.phStatus.style.background = 'rgba(239, 68, 68, 0.1)';
                } else if (value > 7.5) {
                    this.phStatus.textContent = 'Alkaline';
                    this.phStatus.style.color = '#3b82f6';
                    this.phStatus.style.background = 'rgba(59, 130, 246, 0.1)';
                } else {
                    this.phStatus.textContent = 'Neutral';
                    this.phStatus.style.color = '#10b981';
                    this.phStatus.style.background = 'rgba(16, 185, 129, 0.1)';
                }
            }
        }
    }

    // ============================================
    // DYNAMIC ISLAND METHODS
    // ============================================

    initDynamicIsland() {
        // Start in compact state
        this.showIslandState('compact');
        
        let pressTimer;
        let isLongPress = false;
        
        // Long press to expand, tap to interact
        this.dynamicIsland?.addEventListener('mousedown', (e) => {
            if (!e.target.closest('.island-close')) {
                isLongPress = false;
                this.simulateHaptic('light'); // Haptic on press start
                pressTimer = setTimeout(() => {
                    isLongPress = true;
                    this.showIslandState('expanded');
                    this.simulateHaptic('medium'); // Haptic on long press trigger
                }, 500); // Long press after 500ms
            }
        });
        
        this.dynamicIsland?.addEventListener('mouseup', (e) => {
            clearTimeout(pressTimer);
            if (!isLongPress && !e.target.closest('.island-close')) {
                // Quick tap - perform action based on current state
                this.handleIslandTap();
                this.simulateHaptic('light'); // Haptic on tap
            }
        });
        
        this.dynamicIsland?.addEventListener('mouseleave', () => {
            clearTimeout(pressTimer);
        });
        
        // Touch events for mobile
        this.dynamicIsland?.addEventListener('touchstart', (e) => {
            if (!e.target.closest('.island-close')) {
                isLongPress = false;
                this.simulateHaptic('light');
                pressTimer = setTimeout(() => {
                    isLongPress = true;
                    this.showIslandState('expanded');
                    this.simulateHaptic('medium');
                }, 500);
            }
        }, { passive: true });
        
        this.dynamicIsland?.addEventListener('touchend', (e) => {
            clearTimeout(pressTimer);
            if (!isLongPress && !e.target.closest('.island-close')) {
                this.handleIslandTap();
                this.simulateHaptic('light');
            }
        });
        
        // Close button handler
        this.islandClose?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showIslandState('compact');
            this.simulateHaptic('light');
        });
        
        // Start monitoring for smart notifications
        this.startIslandMonitoring();
    }
    
    handleIslandTap() {
        switch (this.currentIslandState) {
            case 'compact':
                // Quick tap on compact - show last activity
                this.showLastActivity();
                break;
            case 'connection':
                // Tap connection - go to terminal
                this.switchMainTab('terminal');
                this.showIslandState('compact', 1000);
                break;
            case 'sensor':
                // Tap sensor - go to weather tab
                this.switchMainTab('weather');
                this.showIslandState('compact', 1000);
                break;
            case 'emergency':
                // Tap emergency - acknowledge
                this.closeEmergencyAlert();
                this.showIslandState('compact');
                break;
            case 'weather':
                // Tap weather - go to weather tab
                this.switchMainTab('weather');
                this.showIslandState('compact', 1000);
                break;
            case 'ai':
                // Tap AI - open AI assistant
                this.openAI();
                this.showIslandState('compact', 1000);
                break;
            case 'download':
                // Tap download - show notification
                this.showNotification('Download in progress...');
                break;
            default:
                break;
        }
    }
    
    showLastActivity() {
        // Show the most recent non-compact activity
        if (this.notifications.length > 0) {
            const lastNotif = this.notifications[0];
            if (lastNotif.type === 'emergency') {
                this.showIslandState('emergency', 3000, { message: lastNotif.title });
            } else if (lastNotif.type === 'sensor') {
                this.showIslandState('sensor', 3000, { 
                    title: lastNotif.title, 
                    value: lastNotif.message 
                });
            } else {
                this.showIslandState('expanded');
            }
        } else {
            this.showIslandState('expanded');
        }
    }
    
    startIslandMonitoring() {
        // Monitor sensor values and show alerts
        setInterval(() => {
            if (this.currentIslandState !== 'compact') return;
            
            // Check for sensor threshold alerts
            if (this.tempValue && this.tempValue.textContent !== '--°C') {
                const temp = parseFloat(this.tempValue.textContent);
                if (temp > 35) {
                    this.showSensorAlert('temperature', `${temp.toFixed(1)}°C - High`);
                } else if (temp < 10) {
                    this.showSensorAlert('temperature', `${temp.toFixed(1)}°C - Low`);
                }
            }
            
            if (this.humidityValue && this.humidityValue.textContent !== '--%') {
                const humidity = parseFloat(this.humidityValue.textContent);
                if (humidity < 30) {
                    this.showSensorAlert('humidity', `${humidity.toFixed(0)}% - Low`);
                } else if (humidity > 80) {
                    this.showSensorAlert('humidity', `${humidity.toFixed(0)}% - High`);
                }
            }
            
            if (this.phValue && this.phValue.textContent !== '--') {
                const ph = parseFloat(this.phValue.textContent);
                if (ph < 5.5 || ph > 8.0) {
                    this.showSensorAlert('ph', `${ph.toFixed(1)} - ${ph < 5.5 ? 'Acidic' : 'Alkaline'}`);
                }
            }
        }, 30000); // Check every 30 seconds
    }

    showIslandState(state, duration = 3000, data = {}) {
        // Clear any existing timeout
        if (this.islandTimeout) {
            clearTimeout(this.islandTimeout);
            this.islandTimeout = null;
        }

        // Hide all states
        const allStates = [
            this.islandCompact,
            this.islandConnection,
            this.islandSensor,
            this.islandEmergency,
            this.islandWeather,
            this.islandData,
            this.islandExpanded,
            this.islandAI,
            this.islandDownload
        ];
        
        allStates.forEach(s => s?.classList.remove('active'));

        // Show the requested state
        let stateElement = null;
        switch (state) {
            case 'compact':
                stateElement = this.islandCompact;
                break;
            case 'connection':
                stateElement = this.islandConnection;
                if (data.baudRate) {
                    const subtitle = stateElement.querySelector('.island-subtitle');
                    if (subtitle) subtitle.textContent = `${data.baudRate} baud`;
                }
                break;
            case 'sensor':
                stateElement = this.islandSensor;
                if (data.title && data.value) {
                    const title = stateElement.querySelector('.island-title');
                    const subtitle = stateElement.querySelector('.island-subtitle');
                    if (title) title.textContent = data.title;
                    if (subtitle) subtitle.textContent = data.value;
                }
                break;
            case 'emergency':
                stateElement = this.islandEmergency;
                if (data.message) {
                    const title = stateElement.querySelector('.island-title');
                    if (title) title.textContent = data.message;
                }
                break;
            case 'weather':
                stateElement = this.islandWeather;
                if (data.temp && data.condition) {
                    const subtitle = stateElement.querySelector('.island-subtitle');
                    if (subtitle) subtitle.textContent = `${data.temp}°C, ${data.condition}`;
                }
                break;
            case 'data':
                stateElement = this.islandData;
                if (data.progress !== undefined) {
                    const progressBar = stateElement.querySelector('.island-progress-bar');
                    if (progressBar) progressBar.style.width = `${data.progress}%`;
                }
                break;
            case 'expanded':
                stateElement = this.islandExpanded;
                duration = 0; // Don't auto-hide expanded state
                break;
            case 'ai':
                stateElement = this.islandAI;
                break;
            case 'download':
                stateElement = this.islandDownload;
                if (data.progress !== undefined) {
                    const circle = stateElement.querySelector('.circle-progress');
                    const percent = stateElement.querySelector('.progress-percent');
                    if (circle) {
                        const offset = 100 - data.progress;
                        circle.setAttribute('stroke-dasharray', `${data.progress}, 100`);
                    }
                    if (percent) percent.textContent = `${Math.round(data.progress)}%`;
                }
                break;
        }

        if (stateElement) {
            stateElement.classList.add('active');
            this.currentIslandState = state;
        }

        // Auto-hide after duration (except for compact and expanded)
        if (duration > 0 && state !== 'expanded') {
            this.islandTimeout = setTimeout(() => {
                this.showIslandState('compact');
            }, duration);
        }
    }

    // Helper methods to trigger specific island states
    showConnectionIsland(connected, baudRate = 115200) {
        if (connected) {
            this.showIslandState('connection', 2000, { baudRate });
        }
    }

    showSensorAlert(sensorType, value) {
        const alerts = {
            temperature: { title: 'Temperature Alert', icon: '🌡️' },
            humidity: { title: 'Humidity Alert', icon: '💧' },
            ph: { title: 'pH Level Alert', icon: '🧪' }
        };
        
        const alert = alerts[sensorType];
        if (alert) {
            this.showIslandState('sensor', 3000, {
                title: alert.title,
                value: value
            });
        }
    }

    showEmergencyIsland(message) {
        this.showIslandState('emergency', 5000, { message });
    }

    showWeatherIsland(temp, icon, condition, location) {
        // Update weather state content
        const weatherIcon = this.islandWeather.querySelector('.weather-icon');
        const weatherTemp = this.islandWeather.querySelector('.weather-temp');
        const weatherTitle = this.islandWeather.querySelector('.island-title');
        const weatherSubtitle = this.islandWeather.querySelector('.island-subtitle');
        
        if (weatherIcon) weatherIcon.textContent = icon;
        if (weatherTemp) weatherTemp.textContent = `${temp}°`;
        if (weatherTitle) weatherTitle.textContent = location || 'Weather Update';
        if (weatherSubtitle) weatherSubtitle.textContent = condition;
        
        this.showIslandState('weather', 4000);
    }

    showDataTransfer(bytesReceived, totalBytes) {
        const progress = (bytesReceived / totalBytes) * 100;
        this.showIslandState('data', 0, { progress }); // Don't auto-hide during transfer
    }

    completeDataTransfer() {
        this.showIslandState('data', 1500, { progress: 100 });
    }

    showAIThinking() {
        this.showIslandState('ai', 0); // Show until response comes
    }

    hideAIThinking() {
        this.showIslandState('compact', 0);
    }

    showDownloadProgress(progress) {
        this.showIslandState('download', 0, { progress });
    }

    completeDownload() {
        this.showIslandState('download', 2000, { progress: 100 });
    }

    showWeatherIsland(temp, condition) {
        this.showIslandState('weather', 2500, { temp, condition });
    }

    showDataTransferIsland() {
        this.showIslandState('data', 2000);
    }

    showAIIsland() {
        this.showIslandState('ai', 2000);
    }

    showDownloadIsland(progress) {
        this.showIslandState('download', progress >= 100 ? 1500 : 0, { progress });
    }

    simulateHaptic(intensity = 'light') {
        const island = this.dynamicIsland;
        if (!island) return;
        
        // Visual haptic feedback animation
        island.classList.add('haptic');
        setTimeout(() => {
            island.classList.remove('haptic');
        }, 200);
        
        // Try to use Vibration API if available (mobile devices)
        if ('vibrate' in navigator) {
            switch (intensity) {
                case 'light':
                    navigator.vibrate(10);
                    break;
                case 'medium':
                    navigator.vibrate(20);
                    break;
                case 'heavy':
                    navigator.vibrate([20, 10, 20]);
                    break;
            }
        }
    }
}


// Initialize the serial monitor when the page loads
let serialMonitor;
document.addEventListener('DOMContentLoaded', () => {
    serialMonitor = new SerialMonitor();
});