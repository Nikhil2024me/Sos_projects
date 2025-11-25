/**
 * SOS Connect Pro - Push Notifications System
 * Handles browser notifications, permissions, and notification history
 */

class NotificationsManager {
    constructor() {
        this.permission = Notification.permission;
        this.history = [];
        this.soundEnabled = true;
        this.maxHistory = 100;
        this.notificationSounds = {
            default: null,
            emergency: null,
            warning: null,
            success: null
        };
        
        this.loadHistory();
        this.initSounds();
    }

    /**
     * Initialize notification system
     */
    async init() {
        // Request permission if not yet granted
        if (this.permission === 'default') {
            await this.requestPermission();
        }
        
        // Register service worker for push notifications
        if ('serviceWorker' in navigator && 'PushManager' in window) {
            try {
                const registration = await navigator.serviceWorker.ready;
                console.log('[Notifications] Service worker ready for push');
            } catch (error) {
                console.error('[Notifications] Service worker error:', error);
            }
        }
        
        return this.permission === 'granted';
    }

    /**
     * Request notification permission
     */
    async requestPermission() {
        try {
            this.permission = await Notification.requestPermission();
            console.log('[Notifications] Permission:', this.permission);
            return this.permission === 'granted';
        } catch (error) {
            console.error('[Notifications] Permission error:', error);
            return false;
        }
    }

    /**
     * Initialize notification sounds using Web Audio API
     */
    initSounds() {
        // Sounds will be generated using Web Audio API when needed
        this.audioContext = null;
    }

    /**
     * Get or create audio context
     */
    getAudioContext() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        return this.audioContext;
    }

    /**
     * Play notification sound
     */
    playSound(type = 'default') {
        if (!this.soundEnabled) return;

        try {
            const ctx = this.getAudioContext();
            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);

            const soundConfigs = {
                default: { freq: 440, duration: 0.2, type: 'sine' },
                emergency: { freq: 880, duration: 0.5, type: 'square' },
                warning: { freq: 660, duration: 0.3, type: 'triangle' },
                success: { freq: 523.25, duration: 0.2, type: 'sine' }
            };

            const config = soundConfigs[type] || soundConfigs.default;
            oscillator.frequency.value = config.freq;
            oscillator.type = config.type;

            gainNode.gain.setValueAtTime(0, ctx.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.01);
            gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + config.duration);

            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + config.duration);
        } catch (error) {
            console.error('[Notifications] Sound error:', error);
        }
    }

    /**
     * Show a browser notification
     */
    async show(options) {
        const {
            title = 'SOS Connect Pro',
            body = '',
            icon = '🔔',
            tag = `notification-${Date.now()}`,
            type = 'info', // info, success, warning, emergency
            data = {},
            actions = [],
            silent = false,
            requireInteraction = false
        } = options;

        // Add to history
        const notification = {
            id: tag,
            title,
            body,
            icon,
            type,
            timestamp: new Date().toISOString(),
            read: false,
            data
        };
        
        this.addToHistory(notification);

        // Play sound
        if (!silent) {
            const soundType = type === 'emergency' ? 'emergency' : 
                             type === 'warning' ? 'warning' : 
                             type === 'success' ? 'success' : 'default';
            this.playSound(soundType);
        }

        // Show browser notification if permitted
        if (this.permission === 'granted') {
            try {
                const browserNotification = new Notification(title, {
                    body,
                    icon: this.getIconDataUri(icon),
                    tag,
                    data,
                    silent,
                    requireInteraction: type === 'emergency' || requireInteraction
                });

                browserNotification.onclick = () => {
                    window.focus();
                    this.markAsRead(tag);
                    browserNotification.close();
                    
                    // Dispatch event for app to handle
                    window.dispatchEvent(new CustomEvent('notification-click', {
                        detail: notification
                    }));
                };

                return browserNotification;
            } catch (error) {
                console.error('[Notifications] Show error:', error);
            }
        }

        return null;
    }

    /**
     * Generate icon data URI from emoji
     */
    getIconDataUri(emoji) {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.font = '48px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(emoji, 32, 32);
        return canvas.toDataURL();
    }

    /**
     * Show emergency alert notification
     */
    showEmergency(title, message, data = {}) {
        return this.show({
            title,
            body: message,
            icon: '🚨',
            type: 'emergency',
            requireInteraction: true,
            data
        });
    }

    /**
     * Show sensor threshold warning
     */
    showSensorWarning(sensor, value, threshold) {
        return this.show({
            title: `${sensor} Alert`,
            body: `${sensor} is ${value}. Threshold: ${threshold}`,
            icon: '⚠️',
            type: 'warning',
            data: { sensor, value, threshold }
        });
    }

    /**
     * Show connection status notification
     */
    showConnectionStatus(connected, details = '') {
        return this.show({
            title: connected ? 'Device Connected' : 'Device Disconnected',
            body: details || (connected ? 'Serial device is now connected' : 'Connection lost'),
            icon: connected ? '✅' : '❌',
            type: connected ? 'success' : 'warning'
        });
    }

    /**
     * Show weather alert
     */
    showWeatherAlert(condition, description) {
        return this.show({
            title: 'Weather Alert',
            body: `${condition}: ${description}`,
            icon: '🌤️',
            type: 'info',
            data: { condition, description }
        });
    }

    /**
     * Add notification to history
     */
    addToHistory(notification) {
        this.history.unshift(notification);
        
        // Keep only max history items
        if (this.history.length > this.maxHistory) {
            this.history = this.history.slice(0, this.maxHistory);
        }
        
        this.saveHistory();
        
        // Dispatch event for UI update
        window.dispatchEvent(new CustomEvent('notification-added', {
            detail: notification
        }));
    }

    /**
     * Mark notification as read
     */
    markAsRead(id) {
        const notification = this.history.find(n => n.id === id);
        if (notification) {
            notification.read = true;
            this.saveHistory();
        }
    }

    /**
     * Mark all notifications as read
     */
    markAllAsRead() {
        this.history.forEach(n => n.read = true);
        this.saveHistory();
    }

    /**
     * Get unread count
     */
    getUnreadCount() {
        return this.history.filter(n => !n.read).length;
    }

    /**
     * Clear notification history
     */
    clearHistory() {
        this.history = [];
        this.saveHistory();
    }

    /**
     * Save history to localStorage
     */
    saveHistory() {
        try {
            localStorage.setItem('sosNotificationHistory', JSON.stringify(this.history));
        } catch (error) {
            console.error('[Notifications] Save error:', error);
        }
    }

    /**
     * Load history from localStorage
     */
    loadHistory() {
        try {
            const saved = localStorage.getItem('sosNotificationHistory');
            if (saved) {
                this.history = JSON.parse(saved);
            }
        } catch (error) {
            console.error('[Notifications] Load error:', error);
        }
    }

    /**
     * Toggle sound
     */
    toggleSound(enabled) {
        this.soundEnabled = enabled;
        localStorage.setItem('sosNotificationSound', enabled ? 'true' : 'false');
    }
}

// Export for use in main script
window.NotificationsManager = NotificationsManager;
