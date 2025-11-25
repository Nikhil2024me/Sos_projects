/**
 * SOS Connect Pro - Enhanced Emergency System
 * Contact management, alert integration, and emergency features
 */

class EmergencySystemManager {
    constructor() {
        this.contacts = [];
        this.emergencyEvents = [];
        this.panicMode = false;
        this.countdownTimer = null;
        this.countdownSeconds = 10;
        this.soundEnabled = true;
        this.vibrationEnabled = true;
        
        this.loadContacts();
        this.loadEmergencyEvents();
    }

    /**
     * Add emergency contact
     */
    addContact(contact) {
        const newContact = {
            id: `contact-${Date.now()}`,
            name: contact.name,
            phone: contact.phone,
            email: contact.email || '',
            relationship: contact.relationship || '',
            isPrimary: contact.isPrimary || false,
            notifyBySMS: contact.notifyBySMS !== false,
            notifyByEmail: contact.notifyByEmail !== false,
            createdAt: new Date().toISOString()
        };
        
        // If this is primary, unset others
        if (newContact.isPrimary) {
            this.contacts.forEach(c => c.isPrimary = false);
        }
        
        this.contacts.push(newContact);
        this.saveContacts();
        
        return newContact;
    }

    /**
     * Update emergency contact
     */
    updateContact(id, updates) {
        const contact = this.contacts.find(c => c.id === id);
        if (contact) {
            Object.assign(contact, updates);
            
            if (updates.isPrimary) {
                this.contacts.forEach(c => {
                    if (c.id !== id) c.isPrimary = false;
                });
            }
            
            this.saveContacts();
            return contact;
        }
        return null;
    }

    /**
     * Delete emergency contact
     */
    deleteContact(id) {
        const index = this.contacts.findIndex(c => c.id === id);
        if (index > -1) {
            this.contacts.splice(index, 1);
            this.saveContacts();
            return true;
        }
        return false;
    }

    /**
     * Get all contacts
     */
    getContacts() {
        return this.contacts;
    }

    /**
     * Get primary contact
     */
    getPrimaryContact() {
        return this.contacts.find(c => c.isPrimary) || this.contacts[0];
    }

    /**
     * Activate panic button with countdown
     */
    activatePanic(immediate = false) {
        if (this.panicMode) return;
        
        if (immediate) {
            this.triggerEmergency('PANIC', 'Manual panic button activated');
            return;
        }
        
        this.panicMode = true;
        let countdown = this.countdownSeconds;
        
        // Dispatch countdown start event
        window.dispatchEvent(new CustomEvent('panic-countdown-start', {
            detail: { seconds: countdown }
        }));
        
        // Play warning sound
        this.playWarningSound();
        
        // Vibrate if supported
        if (this.vibrationEnabled && navigator.vibrate) {
            navigator.vibrate([200, 100, 200, 100, 200]);
        }
        
        this.countdownTimer = setInterval(() => {
            countdown--;
            
            window.dispatchEvent(new CustomEvent('panic-countdown', {
                detail: { seconds: countdown }
            }));
            
            if (countdown <= 0) {
                this.triggerEmergency('PANIC', 'Manual panic button activated');
                this.cancelPanic();
            }
        }, 1000);
    }

    /**
     * Cancel panic countdown
     */
    cancelPanic() {
        if (this.countdownTimer) {
            clearInterval(this.countdownTimer);
            this.countdownTimer = null;
        }
        this.panicMode = false;
        
        window.dispatchEvent(new CustomEvent('panic-cancelled'));
    }

    /**
     * Trigger emergency alert
     */
    async triggerEmergency(type, message, data = {}) {
        const event = {
            id: `emergency-${Date.now()}`,
            type,
            message,
            data,
            timestamp: new Date().toISOString(),
            location: await this.getCurrentLocation(),
            acknowledged: false,
            contactsNotified: []
        };
        
        this.emergencyEvents.unshift(event);
        this.saveEmergencyEvents();
        
        // Notify contacts
        await this.notifyContacts(event);
        
        // Dispatch event
        window.dispatchEvent(new CustomEvent('emergency-triggered', {
            detail: event
        }));
        
        // Play emergency sound
        this.playEmergencySound();
        
        // Vibrate continuously
        if (this.vibrationEnabled && navigator.vibrate) {
            navigator.vibrate([500, 200, 500, 200, 500]);
        }
        
        return event;
    }

    /**
     * Get current location for emergency
     */
    async getCurrentLocation() {
        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                resolve(null);
                return;
            }
            
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolve({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        mapsUrl: `https://maps.google.com/maps?q=${position.coords.latitude},${position.coords.longitude}`
                    });
                },
                () => resolve(null),
                { enableHighAccuracy: true, timeout: 5000 }
            );
        });
    }

    /**
     * Notify emergency contacts
     */
    async notifyContacts(event) {
        const notificationPromises = [];
        
        for (const contact of this.contacts) {
            // Prepare notification data for external service (Twilio/SendGrid ready)
            const notificationData = {
                contactId: contact.id,
                contactName: contact.name,
                phone: contact.phone,
                email: contact.email,
                emergencyType: event.type,
                message: event.message,
                location: event.location,
                timestamp: event.timestamp
            };
            
            // SMS notification (Twilio-ready)
            if (contact.notifyBySMS && contact.phone) {
                notificationPromises.push(
                    this.sendSMSNotification(notificationData)
                        .then(() => {
                            event.contactsNotified.push({
                                id: contact.id,
                                type: 'sms',
                                status: 'sent'
                            });
                        })
                        .catch(err => {
                            event.contactsNotified.push({
                                id: contact.id,
                                type: 'sms',
                                status: 'failed',
                                error: err.message
                            });
                        })
                );
            }
            
            // Email notification (SendGrid-ready)
            if (contact.notifyByEmail && contact.email) {
                notificationPromises.push(
                    this.sendEmailNotification(notificationData)
                        .then(() => {
                            event.contactsNotified.push({
                                id: contact.id,
                                type: 'email',
                                status: 'sent'
                            });
                        })
                        .catch(err => {
                            event.contactsNotified.push({
                                id: contact.id,
                                type: 'email',
                                status: 'failed',
                                error: err.message
                            });
                        })
                );
            }
        }
        
        await Promise.allSettled(notificationPromises);
        this.saveEmergencyEvents();
    }

    /**
     * Send SMS notification (Twilio-ready stub)
     */
    async sendSMSNotification(data) {
        // This would integrate with Twilio or similar service
        // For now, log the attempt
        console.log('[Emergency] SMS notification would be sent to:', data.phone);
        console.log('[Emergency] Message:', this.formatEmergencyMessage(data));
        
        // Simulate API call
        return new Promise((resolve) => {
            setTimeout(resolve, 100);
        });
    }

    /**
     * Send email notification (SendGrid-ready stub)
     */
    async sendEmailNotification(data) {
        // This would integrate with SendGrid or similar service
        console.log('[Emergency] Email notification would be sent to:', data.email);
        console.log('[Emergency] Subject: EMERGENCY ALERT from SOS Connect Pro');
        
        // Simulate API call
        return new Promise((resolve) => {
            setTimeout(resolve, 100);
        });
    }

    /**
     * Format emergency message
     */
    formatEmergencyMessage(data) {
        let message = `EMERGENCY ALERT!\n`;
        message += `Type: ${data.emergencyType}\n`;
        message += `Message: ${data.message}\n`;
        message += `Time: ${new Date(data.timestamp).toLocaleString()}\n`;
        
        if (data.location) {
            message += `Location: ${data.location.mapsUrl}\n`;
        }
        
        message += `\n- Sent from SOS Connect Pro`;
        
        return message;
    }

    /**
     * Quick dial emergency services
     */
    dialEmergencyService(service) {
        const numbers = {
            police: 'tel:100',
            ambulance: 'tel:102',
            fire: 'tel:101',
            women: 'tel:1091',
            child: 'tel:1098',
            disaster: 'tel:108',
            universal: 'tel:112'
        };
        
        const number = numbers[service];
        if (number) {
            window.location.href = number;
            
            // Log the call
            this.logEmergencyEvent('CALL', `Dialed ${service}: ${number.replace('tel:', '')}`);
        }
    }

    /**
     * Acknowledge emergency
     */
    acknowledgeEmergency(id) {
        const event = this.emergencyEvents.find(e => e.id === id);
        if (event) {
            event.acknowledged = true;
            event.acknowledgedAt = new Date().toISOString();
            this.saveEmergencyEvents();
            
            window.dispatchEvent(new CustomEvent('emergency-acknowledged', {
                detail: event
            }));
        }
    }

    /**
     * Log emergency event
     */
    logEmergencyEvent(type, message, data = {}) {
        const event = {
            id: `event-${Date.now()}`,
            type,
            message,
            data,
            timestamp: new Date().toISOString()
        };
        
        this.emergencyEvents.unshift(event);
        
        // Keep only last 100 events
        if (this.emergencyEvents.length > 100) {
            this.emergencyEvents = this.emergencyEvents.slice(0, 100);
        }
        
        this.saveEmergencyEvents();
        return event;
    }

    /**
     * Get emergency events
     */
    getEmergencyEvents(limit = 50) {
        return this.emergencyEvents.slice(0, limit);
    }

    /**
     * Clear emergency events
     */
    clearEmergencyEvents() {
        this.emergencyEvents = [];
        this.saveEmergencyEvents();
    }

    /**
     * Play warning sound
     */
    playWarningSound() {
        if (!this.soundEnabled) return;
        
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            
            for (let i = 0; i < 3; i++) {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                
                osc.connect(gain);
                gain.connect(ctx.destination);
                
                osc.frequency.value = 800;
                osc.type = 'triangle';
                
                const startTime = ctx.currentTime + i * 0.3;
                gain.gain.setValueAtTime(0.3, startTime);
                gain.gain.linearRampToValueAtTime(0, startTime + 0.2);
                
                osc.start(startTime);
                osc.stop(startTime + 0.2);
            }
        } catch (error) {
            console.error('[Emergency] Sound error:', error);
        }
    }

    /**
     * Play emergency sound
     */
    playEmergencySound() {
        if (!this.soundEnabled) return;
        
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            
            const playBeep = (freq, start, duration) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                
                osc.connect(gain);
                gain.connect(ctx.destination);
                
                osc.frequency.value = freq;
                osc.type = 'square';
                
                gain.gain.setValueAtTime(0.4, start);
                gain.gain.linearRampToValueAtTime(0, start + duration);
                
                osc.start(start);
                osc.stop(start + duration);
            };
            
            // Emergency siren pattern
            const now = ctx.currentTime;
            playBeep(880, now, 0.15);
            playBeep(700, now + 0.2, 0.15);
            playBeep(880, now + 0.4, 0.15);
            playBeep(700, now + 0.6, 0.15);
            playBeep(880, now + 0.8, 0.15);
        } catch (error) {
            console.error('[Emergency] Sound error:', error);
        }
    }

    // Storage methods
    saveContacts() {
        try {
            localStorage.setItem('sosEmergencyContacts', JSON.stringify(this.contacts));
        } catch (e) {
            console.error('[Emergency] Save contacts error:', e);
        }
    }

    loadContacts() {
        try {
            const saved = localStorage.getItem('sosEmergencyContacts');
            if (saved) {
                this.contacts = JSON.parse(saved);
            }
        } catch (e) {
            console.error('[Emergency] Load contacts error:', e);
        }
    }

    saveEmergencyEvents() {
        try {
            localStorage.setItem('sosEmergencyEvents', JSON.stringify(this.emergencyEvents));
        } catch (e) {
            console.error('[Emergency] Save events error:', e);
        }
    }

    loadEmergencyEvents() {
        try {
            const saved = localStorage.getItem('sosEmergencyEvents');
            if (saved) {
                this.emergencyEvents = JSON.parse(saved);
            }
        } catch (e) {
            console.error('[Emergency] Load events error:', e);
        }
    }
}

// Export for use in main script
window.EmergencySystemManager = EmergencySystemManager;
