/**
 * SOS Connect Pro - Activity Log System
 * Comprehensive logging for all system activities
 */

class ActivityLogManager {
    constructor() {
        this.logs = [];
        this.maxLogs = 1000;
        this.categories = ['connection', 'sensor', 'user', 'system', 'error', 'warning', 'emergency'];
        this.retentionDays = 30;
        
        this.loadLogs();
    }

    /**
     * Log an activity
     */
    log(category, action, details = {}, level = 'info') {
        if (!this.categories.includes(category)) {
            category = 'system';
        }

        const entry = {
            id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            category,
            action,
            details,
            level, // info, warning, error, critical
            timestamp: new Date().toISOString(),
            sessionId: this.getSessionId()
        };

        this.logs.unshift(entry);

        // Enforce max logs limit
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(0, this.maxLogs);
        }

        this.saveLogs();

        // Dispatch event for UI updates
        window.dispatchEvent(new CustomEvent('activity-logged', { detail: entry }));

        // Also log to console in development
        const logMethod = level === 'error' ? console.error : 
                         level === 'warning' ? console.warn : console.log;
        logMethod(`[${category.toUpperCase()}] ${action}`, details);

        return entry;
    }

    /**
     * Log connection events
     */
    logConnection(action, details = {}) {
        return this.log('connection', action, details);
    }

    /**
     * Log sensor events
     */
    logSensor(action, details = {}) {
        return this.log('sensor', action, details);
    }

    /**
     * Log user actions
     */
    logUser(action, details = {}) {
        return this.log('user', action, details);
    }

    /**
     * Log system events
     */
    logSystem(action, details = {}) {
        return this.log('system', action, details);
    }

    /**
     * Log errors
     */
    logError(action, details = {}) {
        return this.log('error', action, details, 'error');
    }

    /**
     * Log warnings
     */
    logWarning(action, details = {}) {
        return this.log('warning', action, details, 'warning');
    }

    /**
     * Log emergency events
     */
    logEmergency(action, details = {}) {
        return this.log('emergency', action, details, 'critical');
    }

    /**
     * Get logs with filters
     */
    getLogs(options = {}) {
        let filteredLogs = [...this.logs];

        // Filter by category
        if (options.category) {
            filteredLogs = filteredLogs.filter(l => l.category === options.category);
        }

        // Filter by level
        if (options.level) {
            filteredLogs = filteredLogs.filter(l => l.level === options.level);
        }

        // Filter by date range
        if (options.startDate) {
            const start = new Date(options.startDate);
            filteredLogs = filteredLogs.filter(l => new Date(l.timestamp) >= start);
        }

        if (options.endDate) {
            const end = new Date(options.endDate);
            filteredLogs = filteredLogs.filter(l => new Date(l.timestamp) <= end);
        }

        // Search in action or details
        if (options.search) {
            const searchLower = options.search.toLowerCase();
            filteredLogs = filteredLogs.filter(l => 
                l.action.toLowerCase().includes(searchLower) ||
                JSON.stringify(l.details).toLowerCase().includes(searchLower)
            );
        }

        // Apply limit
        const limit = options.limit || 100;
        return filteredLogs.slice(0, limit);
    }

    /**
     * Get logs by category
     */
    getLogsByCategory(category, limit = 100) {
        return this.getLogs({ category, limit });
    }

    /**
     * Get recent errors
     */
    getRecentErrors(limit = 20) {
        return this.getLogs({ level: 'error', limit });
    }

    /**
     * Get logs for today
     */
    getTodaysLogs() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return this.getLogs({ startDate: today });
    }

    /**
     * Get session ID (create if doesn't exist)
     */
    getSessionId() {
        let sessionId = sessionStorage.getItem('sosSessionId');
        if (!sessionId) {
            sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            sessionStorage.setItem('sosSessionId', sessionId);
        }
        return sessionId;
    }

    /**
     * Export logs to CSV
     */
    exportToCSV(options = {}) {
        const logs = this.getLogs({ ...options, limit: options.limit || this.maxLogs });
        
        if (logs.length === 0) {
            console.warn('[ActivityLog] No logs to export');
            return null;
        }

        const headers = ['Timestamp', 'Category', 'Level', 'Action', 'Details', 'Session ID'];
        const rows = logs.map(log => [
            log.timestamp,
            log.category,
            log.level,
            log.action,
            JSON.stringify(log.details).replace(/"/g, '""'),
            log.sessionId
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        this.downloadFile(csvContent, `activity-log-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
        return csvContent;
    }

    /**
     * Export logs to JSON
     */
    exportToJSON(options = {}) {
        const logs = this.getLogs({ ...options, limit: options.limit || this.maxLogs });
        const jsonContent = JSON.stringify(logs, null, 2);
        this.downloadFile(jsonContent, `activity-log-${new Date().toISOString().split('T')[0]}.json`, 'application/json');
        return jsonContent;
    }

    /**
     * Download file helper
     */
    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Clear all logs
     */
    clearLogs() {
        this.logs = [];
        this.saveLogs();
        this.logSystem('Logs cleared', { clearedAt: new Date().toISOString() });
    }

    /**
     * Clear logs older than retention period
     */
    cleanOldLogs() {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);
        
        const originalCount = this.logs.length;
        this.logs = this.logs.filter(l => new Date(l.timestamp) >= cutoffDate);
        
        const deletedCount = originalCount - this.logs.length;
        if (deletedCount > 0) {
            this.saveLogs();
            console.log(`[ActivityLog] Cleaned ${deletedCount} old logs`);
        }
    }

    /**
     * Get log statistics
     */
    getStats() {
        const stats = {
            total: this.logs.length,
            byCategory: {},
            byLevel: {},
            today: 0,
            lastHour: 0
        };

        const now = new Date();
        const hourAgo = new Date(now - 60 * 60 * 1000);
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);

        this.categories.forEach(cat => stats.byCategory[cat] = 0);
        ['info', 'warning', 'error', 'critical'].forEach(lvl => stats.byLevel[lvl] = 0);

        this.logs.forEach(log => {
            stats.byCategory[log.category] = (stats.byCategory[log.category] || 0) + 1;
            stats.byLevel[log.level] = (stats.byLevel[log.level] || 0) + 1;

            const logDate = new Date(log.timestamp);
            if (logDate >= todayStart) stats.today++;
            if (logDate >= hourAgo) stats.lastHour++;
        });

        return stats;
    }

    /**
     * Save logs to localStorage
     */
    saveLogs() {
        try {
            // Only save recent logs to localStorage (limit to 500 for performance)
            const logsToSave = this.logs.slice(0, 500);
            localStorage.setItem('sosActivityLogs', JSON.stringify(logsToSave));
        } catch (e) {
            console.error('[ActivityLog] Save error:', e);
            // If storage is full, clear older logs
            if (e.name === 'QuotaExceededError') {
                this.logs = this.logs.slice(0, 250);
                localStorage.setItem('sosActivityLogs', JSON.stringify(this.logs));
            }
        }
    }

    /**
     * Load logs from localStorage
     */
    loadLogs() {
        try {
            const saved = localStorage.getItem('sosActivityLogs');
            if (saved) {
                this.logs = JSON.parse(saved);
            }
        } catch (e) {
            console.error('[ActivityLog] Load error:', e);
        }

        // Clean old logs on load
        this.cleanOldLogs();
    }

    /**
     * Set retention period
     */
    setRetentionDays(days) {
        this.retentionDays = days;
        localStorage.setItem('sosLogRetentionDays', days.toString());
        this.cleanOldLogs();
    }
}

// Export for use in main script
window.ActivityLogManager = ActivityLogManager;
