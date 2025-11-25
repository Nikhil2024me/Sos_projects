/**
 * SOS Connect Pro - Device Control Panel
 * Handles two-way communication, command sending, and automation
 */

class DeviceControlManager {
    constructor() {
        this.commandHistory = [];
        this.scheduledTasks = [];
        this.automationRules = [];
        this.serialPort = null;
        this.writer = null;
        this.encoder = new TextEncoder();
        this.maxHistorySize = 100;
        
        this.loadCommandHistory();
        this.loadScheduledTasks();
        this.loadAutomationRules();
        
        // Start scheduled task checker
        this.startScheduler();
    }

    /**
     * Set the serial port for sending commands
     */
    setSerialPort(port) {
        this.serialPort = port;
        if (port && port.writable) {
            this.writer = port.writable.getWriter();
        }
    }

    /**
     * Release the writer
     */
    async releaseWriter() {
        if (this.writer) {
            await this.writer.releaseLock();
            this.writer = null;
        }
    }

    /**
     * Send a command to the device
     */
    async sendCommand(command, addNewline = true) {
        if (!this.serialPort || !this.serialPort.writable) {
            throw new Error('Serial port not connected');
        }

        try {
            // Get a new writer for each command
            const writer = this.serialPort.writable.getWriter();
            const commandString = addNewline ? command + '\n' : command;
            const data = this.encoder.encode(commandString);
            
            await writer.write(data);
            await writer.releaseLock();
            
            // Log the command
            this.addToHistory({
                command,
                timestamp: new Date().toISOString(),
                status: 'sent'
            });
            
            // Dispatch event
            window.dispatchEvent(new CustomEvent('command-sent', {
                detail: { command }
            }));
            
            console.log('[DeviceControl] Command sent:', command);
            return true;
        } catch (error) {
            console.error('[DeviceControl] Send error:', error);
            
            this.addToHistory({
                command,
                timestamp: new Date().toISOString(),
                status: 'error',
                error: error.message
            });
            
            throw error;
        }
    }

    /**
     * Send multiple commands with delay
     */
    async sendCommands(commands, delayMs = 100) {
        for (const command of commands) {
            await this.sendCommand(command);
            await this.delay(delayMs);
        }
    }

    /**
     * Predefined commands for common operations
     */
    getPresetCommands() {
        return {
            relay: {
                on: (pin) => `RELAY_ON:${pin}`,
                off: (pin) => `RELAY_OFF:${pin}`,
                toggle: (pin) => `RELAY_TOGGLE:${pin}`
            },
            led: {
                on: () => 'LED_ON',
                off: () => 'LED_OFF',
                blink: (interval) => `LED_BLINK:${interval}`
            },
            servo: {
                setAngle: (angle) => `SERVO:${angle}`,
                sweep: () => 'SERVO_SWEEP'
            },
            sensor: {
                read: (type) => `READ:${type}`,
                calibrate: (type) => `CALIBRATE:${type}`
            },
            pump: {
                on: () => 'PUMP_ON',
                off: () => 'PUMP_OFF',
                duration: (seconds) => `PUMP_DURATION:${seconds}`
            },
            system: {
                reset: () => 'RESET',
                status: () => 'STATUS',
                info: () => 'INFO',
                sleep: () => 'SLEEP',
                wake: () => 'WAKE'
            }
        };
    }

    /**
     * Add command to history
     */
    addToHistory(entry) {
        this.commandHistory.unshift(entry);
        
        if (this.commandHistory.length > this.maxHistorySize) {
            this.commandHistory = this.commandHistory.slice(0, this.maxHistorySize);
        }
        
        this.saveCommandHistory();
    }

    /**
     * Get command history
     */
    getHistory() {
        return this.commandHistory;
    }

    /**
     * Clear command history
     */
    clearHistory() {
        this.commandHistory = [];
        this.saveCommandHistory();
    }

    /**
     * Schedule a task
     */
    scheduleTask(options) {
        const {
            name,
            command,
            schedule, // { type: 'once'|'interval'|'daily', time: Date|number|string }
            enabled = true
        } = options;

        const task = {
            id: `task-${Date.now()}`,
            name,
            command,
            schedule,
            enabled,
            lastRun: null,
            nextRun: this.calculateNextRun(schedule),
            createdAt: new Date().toISOString()
        };

        this.scheduledTasks.push(task);
        this.saveScheduledTasks();
        
        return task;
    }

    /**
     * Calculate next run time for a schedule
     */
    calculateNextRun(schedule) {
        const now = new Date();
        
        switch (schedule.type) {
            case 'once':
                return new Date(schedule.time);
            
            case 'interval':
                return new Date(now.getTime() + schedule.interval);
            
            case 'daily':
                const [hours, minutes] = schedule.time.split(':').map(Number);
                const next = new Date();
                next.setHours(hours, minutes, 0, 0);
                if (next <= now) {
                    next.setDate(next.getDate() + 1);
                }
                return next;
            
            case 'hourly':
                const nextHour = new Date(now);
                nextHour.setMinutes(schedule.minute || 0, 0, 0);
                if (nextHour <= now) {
                    nextHour.setHours(nextHour.getHours() + 1);
                }
                return nextHour;
            
            default:
                return null;
        }
    }

    /**
     * Start the scheduler
     */
    startScheduler() {
        // Check every minute
        setInterval(() => {
            this.checkScheduledTasks();
        }, 60000);
        
        // Also check immediately
        this.checkScheduledTasks();
    }

    /**
     * Check and execute due scheduled tasks
     */
    async checkScheduledTasks() {
        const now = new Date();
        
        for (const task of this.scheduledTasks) {
            if (!task.enabled || !task.nextRun) continue;
            
            const nextRun = new Date(task.nextRun);
            
            if (nextRun <= now) {
                try {
                    await this.sendCommand(task.command);
                    task.lastRun = now.toISOString();
                    
                    // Calculate next run
                    if (task.schedule.type !== 'once') {
                        task.nextRun = this.calculateNextRun(task.schedule);
                    } else {
                        task.enabled = false;
                    }
                    
                    this.saveScheduledTasks();
                    
                    window.dispatchEvent(new CustomEvent('scheduled-task-executed', {
                        detail: { task }
                    }));
                } catch (error) {
                    console.error('[DeviceControl] Scheduled task error:', error);
                }
            }
        }
    }

    /**
     * Remove scheduled task
     */
    removeScheduledTask(id) {
        const index = this.scheduledTasks.findIndex(t => t.id === id);
        if (index > -1) {
            this.scheduledTasks.splice(index, 1);
            this.saveScheduledTasks();
        }
    }

    /**
     * Toggle scheduled task
     */
    toggleScheduledTask(id) {
        const task = this.scheduledTasks.find(t => t.id === id);
        if (task) {
            task.enabled = !task.enabled;
            if (task.enabled) {
                task.nextRun = this.calculateNextRun(task.schedule);
            }
            this.saveScheduledTasks();
        }
    }

    /**
     * Add automation rule (condition-based trigger)
     */
    addAutomationRule(options) {
        const {
            name,
            condition, // { sensor, operator, value }
            action,    // command to execute
            cooldown = 60000, // minimum time between triggers (ms)
            enabled = true
        } = options;

        const rule = {
            id: `rule-${Date.now()}`,
            name,
            condition,
            action,
            cooldown,
            enabled,
            lastTriggered: null,
            triggerCount: 0,
            createdAt: new Date().toISOString()
        };

        this.automationRules.push(rule);
        this.saveAutomationRules();
        
        return rule;
    }

    /**
     * Check automation rules against sensor data
     */
    async checkAutomationRules(sensorData) {
        const now = Date.now();
        
        for (const rule of this.automationRules) {
            if (!rule.enabled) continue;
            
            // Check cooldown
            if (rule.lastTriggered && (now - new Date(rule.lastTriggered).getTime()) < rule.cooldown) {
                continue;
            }
            
            // Check condition
            const sensorValue = sensorData[rule.condition.sensor];
            if (sensorValue === undefined) continue;
            
            const triggered = this.evaluateCondition(sensorValue, rule.condition.operator, rule.condition.value);
            
            if (triggered) {
                try {
                    await this.sendCommand(rule.action);
                    rule.lastTriggered = new Date().toISOString();
                    rule.triggerCount++;
                    this.saveAutomationRules();
                    
                    window.dispatchEvent(new CustomEvent('automation-triggered', {
                        detail: { rule, sensorData }
                    }));
                } catch (error) {
                    console.error('[DeviceControl] Automation error:', error);
                }
            }
        }
    }

    /**
     * Evaluate a condition
     */
    evaluateCondition(value, operator, threshold) {
        switch (operator) {
            case '>': return value > threshold;
            case '<': return value < threshold;
            case '>=': return value >= threshold;
            case '<=': return value <= threshold;
            case '==': return value === threshold;
            case '!=': return value !== threshold;
            default: return false;
        }
    }

    /**
     * Remove automation rule
     */
    removeAutomationRule(id) {
        const index = this.automationRules.findIndex(r => r.id === id);
        if (index > -1) {
            this.automationRules.splice(index, 1);
            this.saveAutomationRules();
        }
    }

    /**
     * Toggle automation rule
     */
    toggleAutomationRule(id) {
        const rule = this.automationRules.find(r => r.id === id);
        if (rule) {
            rule.enabled = !rule.enabled;
            this.saveAutomationRules();
        }
    }

    // Storage methods
    saveCommandHistory() {
        try {
            localStorage.setItem('sosCommandHistory', JSON.stringify(this.commandHistory));
        } catch (e) {
            console.error('[DeviceControl] Save history error:', e);
        }
    }

    loadCommandHistory() {
        try {
            const saved = localStorage.getItem('sosCommandHistory');
            if (saved) {
                this.commandHistory = JSON.parse(saved);
            }
        } catch (e) {
            console.error('[DeviceControl] Load history error:', e);
        }
    }

    saveScheduledTasks() {
        try {
            localStorage.setItem('sosScheduledTasks', JSON.stringify(this.scheduledTasks));
        } catch (e) {
            console.error('[DeviceControl] Save tasks error:', e);
        }
    }

    loadScheduledTasks() {
        try {
            const saved = localStorage.getItem('sosScheduledTasks');
            if (saved) {
                this.scheduledTasks = JSON.parse(saved);
            }
        } catch (e) {
            console.error('[DeviceControl] Load tasks error:', e);
        }
    }

    saveAutomationRules() {
        try {
            localStorage.setItem('sosAutomationRules', JSON.stringify(this.automationRules));
        } catch (e) {
            console.error('[DeviceControl] Save rules error:', e);
        }
    }

    loadAutomationRules() {
        try {
            const saved = localStorage.getItem('sosAutomationRules');
            if (saved) {
                this.automationRules = JSON.parse(saved);
            }
        } catch (e) {
            console.error('[DeviceControl] Load rules error:', e);
        }
    }

    /**
     * Utility delay function
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Export for use in main script
window.DeviceControlManager = DeviceControlManager;
