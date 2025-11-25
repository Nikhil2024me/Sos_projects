/**
 * SOS Connect Pro - Voice Commands Integration
 * Implements Web Speech API for voice recognition and text-to-speech
 */

class VoiceCommandsManager {
    constructor() {
        this.recognition = null;
        this.synthesis = window.speechSynthesis;
        this.isListening = false;
        this.isSupported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
        this.commands = new Map();
        this.feedbackEnabled = true;
        this.language = 'en-US';
        this.confidenceThreshold = 0.7;
        
        if (this.isSupported) {
            this.initRecognition();
        }
        
        this.registerDefaultCommands();
    }

    /**
     * Initialize speech recognition
     */
    initRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        
        this.recognition.continuous = false;
        this.recognition.interimResults = true;
        this.recognition.lang = this.language;
        this.recognition.maxAlternatives = 3;

        this.recognition.onstart = () => {
            this.isListening = true;
            this.dispatchEvent('listening-start');
            console.log('[Voice] Listening started');
        };

        this.recognition.onend = () => {
            this.isListening = false;
            this.dispatchEvent('listening-end');
            console.log('[Voice] Listening ended');
        };

        this.recognition.onresult = (event) => {
            this.handleResult(event);
        };

        this.recognition.onerror = (event) => {
            console.error('[Voice] Error:', event.error);
            this.dispatchEvent('error', { error: event.error });
            
            if (event.error !== 'no-speech') {
                this.speak('Sorry, I had trouble hearing that. Please try again.');
            }
        };
    }

    /**
     * Register default voice commands
     */
    registerDefaultCommands() {
        // Temperature commands
        this.registerCommand(['what is the temperature', 'what\'s the temperature', 'temperature', 'how hot is it'], 
            () => this.getTemperature());
        
        // Humidity commands
        this.registerCommand(['what is the humidity', 'what\'s the humidity', 'humidity'], 
            () => this.getHumidity());
        
        // Weather commands
        this.registerCommand(['show weather', 'weather', 'what\'s the weather', 'weather report'], 
            () => this.showWeather());
        
        // Connection commands
        this.registerCommand(['connect device', 'connect', 'connect serial'], 
            () => this.connectDevice());
        
        this.registerCommand(['disconnect device', 'disconnect'], 
            () => this.disconnectDevice());
        
        // Log commands
        this.registerCommand(['save log', 'download log', 'export log', 'save data'], 
            () => this.saveLog());
        
        // Clear commands
        this.registerCommand(['clear terminal', 'clear screen', 'clear'], 
            () => this.clearTerminal());
        
        // Emergency commands
        this.registerCommand(['emergency status', 'show emergencies', 'emergency'], 
            () => this.showEmergencyStatus());
        
        // Navigation commands
        this.registerCommand(['go to terminal', 'show terminal', 'open terminal'], 
            () => this.navigateTo('terminal'));
        
        this.registerCommand(['go to sensors', 'show sensors', 'open weather'], 
            () => this.navigateTo('weather'));
        
        this.registerCommand(['go to settings', 'show settings', 'open config'], 
            () => this.navigateTo('config'));
        
        // AI commands
        this.registerCommand(['open ai', 'show ai assistant', 'ai help'], 
            () => this.openAI());
        
        // Help command
        this.registerCommand(['help', 'what can you do', 'voice commands'], 
            () => this.showHelp());
    }

    /**
     * Register a voice command
     */
    registerCommand(triggers, callback, description = '') {
        triggers.forEach(trigger => {
            this.commands.set(trigger.toLowerCase(), { callback, description });
        });
    }

    /**
     * Start listening for voice commands
     */
    startListening() {
        if (!this.isSupported) {
            this.speak('Voice commands are not supported in this browser');
            return false;
        }

        if (this.isListening) {
            return true;
        }

        try {
            this.recognition.start();
            return true;
        } catch (error) {
            console.error('[Voice] Start error:', error);
            return false;
        }
    }

    /**
     * Stop listening
     */
    stopListening() {
        if (this.recognition && this.isListening) {
            this.recognition.stop();
        }
    }

    /**
     * Handle speech recognition result
     */
    handleResult(event) {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            const confidence = event.results[i][0].confidence;

            if (event.results[i].isFinal) {
                finalTranscript += transcript;
                console.log('[Voice] Final:', transcript, 'Confidence:', confidence);
                
                if (confidence >= this.confidenceThreshold) {
                    this.processCommand(transcript.toLowerCase().trim());
                }
            } else {
                interimTranscript += transcript;
            }
        }

        this.dispatchEvent('transcript', { 
            final: finalTranscript, 
            interim: interimTranscript 
        });
    }

    /**
     * Process the voice command
     */
    processCommand(text) {
        console.log('[Voice] Processing:', text);
        
        // Find matching command
        let matched = false;
        for (const [trigger, handler] of this.commands) {
            if (text.includes(trigger)) {
                matched = true;
                handler.callback();
                break;
            }
        }

        if (!matched) {
            // Try to pass to AI assistant if available
            if (window.serialMonitor && window.serialMonitor.sendAIMessage) {
                this.speak('Let me check with the AI assistant');
                // Simulate AI query
                window.dispatchEvent(new CustomEvent('voice-ai-query', { detail: { text } }));
            } else {
                this.speak('Sorry, I didn\'t understand that command. Say "help" for available commands.');
            }
        }
    }

    /**
     * Speak text using text-to-speech
     */
    speak(text, options = {}) {
        if (!this.feedbackEnabled) return;
        if (!this.synthesis) return;

        // Cancel any ongoing speech
        this.synthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = options.lang || this.language;
        utterance.rate = options.rate || 1;
        utterance.pitch = options.pitch || 1;
        utterance.volume = options.volume || 1;

        // Get available voices and prefer a natural one
        const voices = this.synthesis.getVoices();
        const preferredVoice = voices.find(v => 
            v.lang.startsWith('en') && v.name.includes('Natural')
        ) || voices.find(v => v.lang.startsWith('en'));
        
        if (preferredVoice) {
            utterance.voice = preferredVoice;
        }

        this.synthesis.speak(utterance);
        
        return new Promise((resolve) => {
            utterance.onend = resolve;
        });
    }

    /**
     * Read sensor alerts aloud
     */
    readAlert(alert) {
        const message = `${alert.type} alert: ${alert.message}`;
        this.speak(message);
    }

    // Command implementations
    getTemperature() {
        const tempElement = document.getElementById('tempValue');
        const temp = tempElement?.textContent || 'not available';
        this.speak(`The current temperature is ${temp}`);
    }

    getHumidity() {
        const humidityElement = document.getElementById('humidityValue');
        const humidity = humidityElement?.textContent || 'not available';
        this.speak(`The current humidity is ${humidity}`);
    }

    showWeather() {
        this.navigateTo('weather');
        const weatherTemp = document.getElementById('weatherTemp')?.textContent || 'unknown';
        const weatherDesc = document.getElementById('weatherDescription')?.textContent || 'unknown';
        this.speak(`Showing weather. Current conditions: ${weatherTemp}, ${weatherDesc}`);
    }

    connectDevice() {
        if (window.serialMonitor) {
            if (!window.serialMonitor.isConnected) {
                this.speak('Connecting to device...');
                document.getElementById('connectBtn')?.click();
            } else {
                this.speak('Device is already connected');
            }
        }
    }

    disconnectDevice() {
        if (window.serialMonitor && window.serialMonitor.isConnected) {
            this.speak('Disconnecting device...');
            document.getElementById('connectBtn')?.click();
        } else {
            this.speak('No device is connected');
        }
    }

    saveLog() {
        this.speak('Saving log file...');
        document.getElementById('downloadBtn')?.click();
    }

    clearTerminal() {
        this.speak('Clearing terminal...');
        document.getElementById('clearBtn')?.click();
    }

    showEmergencyStatus() {
        const emergencyOverlay = document.getElementById('emergencyOverlay');
        if (emergencyOverlay?.classList.contains('show')) {
            this.speak('There is an active emergency alert');
        } else {
            this.speak('No active emergencies');
        }
    }

    navigateTo(tab) {
        this.speak(`Opening ${tab}`);
        if (window.serialMonitor) {
            window.serialMonitor.switchMainTab(tab);
        }
    }

    openAI() {
        if (window.serialMonitor) {
            window.serialMonitor.openAI();
            this.speak('Opening AI assistant');
        }
    }

    showHelp() {
        const helpText = `Available voice commands: 
            Say "temperature" or "humidity" for sensor readings.
            Say "show weather" for weather information.
            Say "connect" or "disconnect" for device control.
            Say "save log" to download data.
            Say "clear terminal" to clear the screen.
            Say "go to terminal", "go to sensors", or "go to settings" for navigation.
            Say "open AI" to access the AI assistant.`;
        
        this.speak(helpText);
    }

    /**
     * Dispatch custom event
     */
    dispatchEvent(eventName, detail = {}) {
        window.dispatchEvent(new CustomEvent(`voice-${eventName}`, { detail }));
    }

    /**
     * Toggle voice feedback
     */
    toggleFeedback(enabled) {
        this.feedbackEnabled = enabled;
    }

    /**
     * Set language
     */
    setLanguage(lang) {
        this.language = lang;
        if (this.recognition) {
            this.recognition.lang = lang;
        }
    }
}

// Export for use in main script
window.VoiceCommandsManager = VoiceCommandsManager;
