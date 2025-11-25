/**
 * SOS Connect Pro - Data Analytics & Export
 * Handles historical data storage, analytics, and export functionality
 */

class DataAnalyticsManager {
    constructor() {
        this.dbName = 'SOSConnectPro';
        this.dbVersion = 1;
        this.db = null;
        this.maxDataPoints = 10000;
        
        this.initDatabase();
    }

    /**
     * Initialize IndexedDB
     */
    async initDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onerror = () => {
                console.error('[Analytics] Database error:', request.error);
                reject(request.error);
            };
            
            request.onsuccess = () => {
                this.db = request.result;
                console.log('[Analytics] Database initialized');
                resolve(this.db);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Sensor data store
                if (!db.objectStoreNames.contains('sensorData')) {
                    const sensorStore = db.createObjectStore('sensorData', { keyPath: 'id', autoIncrement: true });
                    sensorStore.createIndex('timestamp', 'timestamp', { unique: false });
                    sensorStore.createIndex('type', 'type', { unique: false });
                }
                
                // Activity log store
                if (!db.objectStoreNames.contains('activityLog')) {
                    const activityStore = db.createObjectStore('activityLog', { keyPath: 'id', autoIncrement: true });
                    activityStore.createIndex('timestamp', 'timestamp', { unique: false });
                    activityStore.createIndex('category', 'category', { unique: false });
                }
                
                // Settings store
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }
            };
        });
    }

    /**
     * Store sensor reading
     */
    async storeSensorReading(type, value, unit = '') {
        if (!this.db) await this.initDatabase();
        
        const reading = {
            type,
            value: parseFloat(value),
            unit,
            timestamp: new Date().toISOString()
        };
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['sensorData'], 'readwrite');
            const store = transaction.objectStore('sensorData');
            const request = store.add(reading);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get sensor data for a time range
     */
    async getSensorData(type, startDate, endDate) {
        if (!this.db) await this.initDatabase();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['sensorData'], 'readonly');
            const store = transaction.objectStore('sensorData');
            const index = store.index('timestamp');
            
            const range = IDBKeyRange.bound(startDate.toISOString(), endDate.toISOString());
            const request = index.openCursor(range);
            const results = [];
            
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    if (!type || cursor.value.type === type) {
                        results.push(cursor.value);
                    }
                    cursor.continue();
                } else {
                    resolve(results);
                }
            };
            
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Calculate statistics for sensor data
     */
    calculateStats(data) {
        if (!data || data.length === 0) {
            return { min: 0, max: 0, avg: 0, count: 0 };
        }
        
        const values = data.map(d => d.value);
        const sum = values.reduce((a, b) => a + b, 0);
        
        return {
            min: Math.min(...values),
            max: Math.max(...values),
            avg: sum / values.length,
            count: values.length,
            latest: values[values.length - 1],
            trend: this.calculateTrend(values)
        };
    }

    /**
     * Calculate trend (simple linear regression)
     */
    calculateTrend(values) {
        if (values.length < 2) return 'stable';
        
        const n = values.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
        
        for (let i = 0; i < n; i++) {
            sumX += i;
            sumY += values[i];
            sumXY += i * values[i];
            sumXX += i * i;
        }
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        
        if (slope > 0.1) return 'increasing';
        if (slope < -0.1) return 'decreasing';
        return 'stable';
    }

    /**
     * Export data to CSV
     */
    exportToCSV(data, filename = 'sensor-data.csv') {
        if (!data || data.length === 0) {
            console.warn('[Analytics] No data to export');
            return null;
        }
        
        const headers = Object.keys(data[0]);
        const csvContent = [
            headers.join(','),
            ...data.map(row => 
                headers.map(h => {
                    let value = row[h];
                    if (typeof value === 'string' && value.includes(',')) {
                        value = `"${value}"`;
                    }
                    return value;
                }).join(',')
            )
        ].join('\n');
        
        this.downloadFile(csvContent, filename, 'text/csv');
        return csvContent;
    }

    /**
     * Export data to JSON
     */
    exportToJSON(data, filename = 'sensor-data.json') {
        if (!data || data.length === 0) {
            console.warn('[Analytics] No data to export');
            return null;
        }
        
        const jsonContent = JSON.stringify(data, null, 2);
        this.downloadFile(jsonContent, filename, 'application/json');
        return jsonContent;
    }

    /**
     * Export data to Excel-compatible format (TSV)
     */
    exportToExcel(data, filename = 'sensor-data.xlsx') {
        if (!data || data.length === 0) {
            console.warn('[Analytics] No data to export');
            return null;
        }
        
        // Create a simple HTML table that Excel can open
        const headers = Object.keys(data[0]);
        const htmlContent = `
            <html>
            <head><meta charset="UTF-8"></head>
            <body>
                <table border="1">
                    <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
                    ${data.map(row => 
                        `<tr>${headers.map(h => `<td>${row[h]}</td>`).join('')}</tr>`
                    ).join('')}
                </table>
            </body>
            </html>
        `;
        
        this.downloadFile(htmlContent, filename.replace('.xlsx', '.xls'), 'application/vnd.ms-excel');
        return htmlContent;
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
     * Generate analytics report
     */
    async generateReport(timeRange = 'day') {
        const now = new Date();
        let startDate;
        
        switch (timeRange) {
            case 'hour':
                startDate = new Date(now - 60 * 60 * 1000);
                break;
            case 'day':
                startDate = new Date(now - 24 * 60 * 60 * 1000);
                break;
            case 'week':
                startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
                break;
            case 'month':
                startDate = new Date(now - 30 * 24 * 60 * 60 * 1000);
                break;
            default:
                startDate = new Date(now - 24 * 60 * 60 * 1000);
        }
        
        const temperatureData = await this.getSensorData('temperature', startDate, now);
        const humidityData = await this.getSensorData('humidity', startDate, now);
        const phData = await this.getSensorData('ph', startDate, now);
        
        return {
            timeRange,
            startDate: startDate.toISOString(),
            endDate: now.toISOString(),
            temperature: this.calculateStats(temperatureData),
            humidity: this.calculateStats(humidityData),
            ph: this.calculateStats(phData),
            totalReadings: temperatureData.length + humidityData.length + phData.length
        };
    }

    /**
     * Get hourly averages for chart
     */
    async getHourlyAverages(type, hours = 24) {
        const now = new Date();
        const startDate = new Date(now - hours * 60 * 60 * 1000);
        const data = await this.getSensorData(type, startDate, now);
        
        // Group by hour
        const hourlyData = {};
        data.forEach(reading => {
            const hour = new Date(reading.timestamp).getHours();
            if (!hourlyData[hour]) {
                hourlyData[hour] = [];
            }
            hourlyData[hour].push(reading.value);
        });
        
        // Calculate averages
        const averages = [];
        for (let i = 0; i < 24; i++) {
            if (hourlyData[i] && hourlyData[i].length > 0) {
                const avg = hourlyData[i].reduce((a, b) => a + b, 0) / hourlyData[i].length;
                averages.push({ hour: i, value: avg });
            } else {
                averages.push({ hour: i, value: null });
            }
        }
        
        return averages;
    }

    /**
     * Store activity log entry
     */
    async logActivity(category, action, details = {}) {
        if (!this.db) await this.initDatabase();
        
        const entry = {
            category,
            action,
            details,
            timestamp: new Date().toISOString()
        };
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['activityLog'], 'readwrite');
            const store = transaction.objectStore('activityLog');
            const request = store.add(entry);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get activity log
     */
    async getActivityLog(limit = 100) {
        if (!this.db) await this.initDatabase();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['activityLog'], 'readonly');
            const store = transaction.objectStore('activityLog');
            const index = store.index('timestamp');
            const request = index.openCursor(null, 'prev');
            const results = [];
            
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor && results.length < limit) {
                    results.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(results);
                }
            };
            
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Clear old data (data retention management)
     */
    async clearOldData(daysToKeep = 30) {
        if (!this.db) await this.initDatabase();
        
        const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['sensorData', 'activityLog'], 'readwrite');
            
            ['sensorData', 'activityLog'].forEach(storeName => {
                const store = transaction.objectStore(storeName);
                const index = store.index('timestamp');
                const range = IDBKeyRange.upperBound(cutoffDate.toISOString());
                const request = index.openCursor(range);
                
                request.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        cursor.delete();
                        cursor.continue();
                    }
                };
            });
            
            transaction.oncomplete = () => resolve(true);
            transaction.onerror = () => reject(transaction.error);
        });
    }
}

// Export for use in main script
window.DataAnalyticsManager = DataAnalyticsManager;
