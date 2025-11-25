/**
 * SOS Connect Pro - Internationalization (i18n)
 * Multi-language support with locale-aware formatting
 */

class I18nManager {
    constructor() {
        this.currentLanguage = 'en';
        this.supportedLanguages = ['en', 'hi', 'es'];
        this.translations = {};
        this.dateTimeFormats = {};
        
        this.loadTranslations();
        this.loadSavedLanguage();
    }

    /**
     * Load all translations
     */
    loadTranslations() {
        // English translations
        this.translations.en = {
            // Navigation
            nav_terminal: 'Terminal',
            nav_weather: 'Weather & Sensors',
            nav_config: 'Configuration',
            nav_emergency: 'Emergency',
            nav_analytics: 'Analytics',
            
            // Status
            status_connected: 'Connected',
            status_disconnected: 'Disconnected',
            status_connecting: 'Connecting...',
            
            // Buttons
            btn_connect: 'Connect',
            btn_disconnect: 'Disconnect',
            btn_clear: 'Clear',
            btn_save_log: 'Save Log',
            btn_auto_scroll: 'Auto-Scroll',
            btn_save: 'Save',
            btn_cancel: 'Cancel',
            btn_export: 'Export',
            btn_import: 'Import',
            btn_reset: 'Reset to Defaults',
            
            // Weather
            weather_temperature: 'Temperature',
            weather_humidity: 'Humidity',
            weather_wind: 'Wind',
            weather_feels_like: 'Feels like',
            weather_visibility: 'Visibility',
            weather_pressure: 'Pressure',
            weather_uv_index: 'UV Index',
            weather_cloud_cover: 'Cloud Cover',
            weather_forecast: '7-Day Forecast',
            
            // Sensors
            sensor_ph: 'Soil pH',
            sensor_temperature: 'Temperature',
            sensor_humidity: 'Humidity',
            sensor_moisture: 'Soil Moisture',
            sensor_light: 'Light Intensity',
            sensor_co2: 'CO2 Level',
            sensor_rain: 'Rain Detection',
            sensor_battery: 'Battery Level',
            
            // Emergency
            emergency_alert: 'Emergency Alert',
            emergency_acknowledge: 'Acknowledge',
            emergency_panic_button: 'Panic Button',
            emergency_contacts: 'Emergency Contacts',
            emergency_call_police: 'Call Police',
            emergency_call_ambulance: 'Call Ambulance',
            emergency_call_fire: 'Call Fire Department',
            emergency_share_location: 'Share Location',
            
            // Configuration
            config_theme: 'Theme',
            config_theme_normal: 'Normal',
            config_theme_light: 'Light',
            config_theme_dark: 'Dark',
            config_language: 'Language',
            config_serial: 'Serial Port Settings',
            config_baud_rate: 'Baud Rate',
            config_data_bits: 'Data Bits',
            config_stop_bits: 'Stop Bits',
            config_parity: 'Parity',
            config_display: 'Display Settings',
            config_font_size: 'Font Size',
            config_notifications: 'Notifications',
            config_sound: 'Sound Effects',
            config_alerts: 'Alert Thresholds',
            
            // AI Assistant
            ai_name: 'SOS AI',
            ai_placeholder: 'Ask me anything...',
            ai_thinking: 'Thinking...',
            ai_learning: 'Learning...',
            ai_clear_chat: 'Clear Chat',
            
            // Notifications
            notif_no_notifications: 'No notifications yet',
            notif_clear_all: 'Clear All',
            
            // Messages
            msg_waiting_data: 'Waiting for data...',
            msg_connection_success: 'Connected successfully!',
            msg_connection_error: 'Connection error',
            msg_no_data: 'No data to save',
            msg_saved_success: 'Saved successfully!',
            msg_settings_saved: 'Settings saved',
            
            // Time
            time_now: 'Now',
            time_seconds_ago: 'seconds ago',
            time_minutes_ago: 'minutes ago',
            time_hours_ago: 'hours ago',
            time_days_ago: 'days ago',
            
            // Crops
            crop_season_kharif: 'Kharif Season (Monsoon)',
            crop_season_rabi: 'Rabi Season (Winter)',
            crop_season_zaid: 'Summer/Zaid Season',
            crop_recommendations: 'Crop Recommendations',
            crop_tips: 'Farming Tips'
        };

        // Hindi translations
        this.translations.hi = {
            // Navigation
            nav_terminal: 'टर्मिनल',
            nav_weather: 'मौसम और सेंसर',
            nav_config: 'सेटिंग्स',
            nav_emergency: 'आपातकाल',
            nav_analytics: 'विश्लेषण',
            
            // Status
            status_connected: 'जुड़ा हुआ',
            status_disconnected: 'डिस्कनेक्ट',
            status_connecting: 'जोड़ रहा है...',
            
            // Buttons
            btn_connect: 'जोड़ें',
            btn_disconnect: 'डिस्कनेक्ट',
            btn_clear: 'साफ़ करें',
            btn_save_log: 'लॉग सहेजें',
            btn_auto_scroll: 'ऑटो-स्क्रॉल',
            btn_save: 'सहेजें',
            btn_cancel: 'रद्द करें',
            btn_export: 'निर्यात',
            btn_import: 'आयात',
            btn_reset: 'डिफ़ॉल्ट रीसेट',
            
            // Weather
            weather_temperature: 'तापमान',
            weather_humidity: 'आर्द्रता',
            weather_wind: 'हवा',
            weather_feels_like: 'महसूस होता है',
            weather_visibility: 'दृश्यता',
            weather_pressure: 'दबाव',
            weather_uv_index: 'यूवी इंडेक्स',
            weather_cloud_cover: 'बादल',
            weather_forecast: '7-दिन का पूर्वानुमान',
            
            // Sensors
            sensor_ph: 'मिट्टी का pH',
            sensor_temperature: 'तापमान',
            sensor_humidity: 'आर्द्रता',
            sensor_moisture: 'मिट्टी की नमी',
            sensor_light: 'प्रकाश तीव्रता',
            sensor_co2: 'CO2 स्तर',
            sensor_rain: 'बारिश पहचान',
            sensor_battery: 'बैटरी स्तर',
            
            // Emergency
            emergency_alert: 'आपातकालीन चेतावनी',
            emergency_acknowledge: 'स्वीकार करें',
            emergency_panic_button: 'पैनिक बटन',
            emergency_contacts: 'आपातकालीन संपर्क',
            emergency_call_police: 'पुलिस को कॉल करें',
            emergency_call_ambulance: 'एम्बुलेंस बुलाएं',
            emergency_call_fire: 'फायर ब्रिगेड',
            emergency_share_location: 'स्थान साझा करें',
            
            // Configuration
            config_theme: 'थीम',
            config_theme_normal: 'सामान्य',
            config_theme_light: 'लाइट',
            config_theme_dark: 'डार्क',
            config_language: 'भाषा',
            config_serial: 'सीरियल पोर्ट सेटिंग्स',
            config_baud_rate: 'बॉड रेट',
            config_data_bits: 'डेटा बिट्स',
            config_stop_bits: 'स्टॉप बिट्स',
            config_parity: 'पैरिटी',
            config_display: 'डिस्प्ले सेटिंग्स',
            config_font_size: 'फ़ॉन्ट आकार',
            config_notifications: 'सूचनाएं',
            config_sound: 'ध्वनि प्रभाव',
            config_alerts: 'चेतावनी सीमाएं',
            
            // AI Assistant
            ai_name: 'SOS AI',
            ai_placeholder: 'कुछ भी पूछें...',
            ai_thinking: 'सोच रहा हूँ...',
            ai_learning: 'सीख रहा हूँ...',
            ai_clear_chat: 'चैट साफ़ करें',
            
            // Notifications
            notif_no_notifications: 'अभी कोई सूचना नहीं',
            notif_clear_all: 'सभी साफ़ करें',
            
            // Messages
            msg_waiting_data: 'डेटा का इंतज़ार...',
            msg_connection_success: 'सफलतापूर्वक जुड़ गया!',
            msg_connection_error: 'कनेक्शन त्रुटि',
            msg_no_data: 'सहेजने के लिए कोई डेटा नहीं',
            msg_saved_success: 'सफलतापूर्वक सहेजा गया!',
            msg_settings_saved: 'सेटिंग्स सहेजी गईं',
            
            // Time
            time_now: 'अभी',
            time_seconds_ago: 'सेकंड पहले',
            time_minutes_ago: 'मिनट पहले',
            time_hours_ago: 'घंटे पहले',
            time_days_ago: 'दिन पहले',
            
            // Crops
            crop_season_kharif: 'खरीफ सीज़न (मानसून)',
            crop_season_rabi: 'रबी सीज़न (सर्दी)',
            crop_season_zaid: 'ज़ायद सीज़न (गर्मी)',
            crop_recommendations: 'फसल सिफारिशें',
            crop_tips: 'खेती युक्तियाँ'
        };

        // Spanish translations
        this.translations.es = {
            // Navigation
            nav_terminal: 'Terminal',
            nav_weather: 'Clima y Sensores',
            nav_config: 'Configuración',
            nav_emergency: 'Emergencia',
            nav_analytics: 'Analítica',
            
            // Status
            status_connected: 'Conectado',
            status_disconnected: 'Desconectado',
            status_connecting: 'Conectando...',
            
            // Buttons
            btn_connect: 'Conectar',
            btn_disconnect: 'Desconectar',
            btn_clear: 'Limpiar',
            btn_save_log: 'Guardar Registro',
            btn_auto_scroll: 'Auto-desplazar',
            btn_save: 'Guardar',
            btn_cancel: 'Cancelar',
            btn_export: 'Exportar',
            btn_import: 'Importar',
            btn_reset: 'Restablecer',
            
            // Weather
            weather_temperature: 'Temperatura',
            weather_humidity: 'Humedad',
            weather_wind: 'Viento',
            weather_feels_like: 'Sensación',
            weather_visibility: 'Visibilidad',
            weather_pressure: 'Presión',
            weather_uv_index: 'Índice UV',
            weather_cloud_cover: 'Nubosidad',
            weather_forecast: 'Pronóstico 7 días',
            
            // Sensors
            sensor_ph: 'pH del Suelo',
            sensor_temperature: 'Temperatura',
            sensor_humidity: 'Humedad',
            sensor_moisture: 'Humedad del Suelo',
            sensor_light: 'Intensidad Lumínica',
            sensor_co2: 'Nivel de CO2',
            sensor_rain: 'Detección de Lluvia',
            sensor_battery: 'Nivel de Batería',
            
            // Emergency
            emergency_alert: 'Alerta de Emergencia',
            emergency_acknowledge: 'Reconocer',
            emergency_panic_button: 'Botón de Pánico',
            emergency_contacts: 'Contactos de Emergencia',
            emergency_call_police: 'Llamar Policía',
            emergency_call_ambulance: 'Llamar Ambulancia',
            emergency_call_fire: 'Llamar Bomberos',
            emergency_share_location: 'Compartir Ubicación',
            
            // Configuration
            config_theme: 'Tema',
            config_theme_normal: 'Normal',
            config_theme_light: 'Claro',
            config_theme_dark: 'Oscuro',
            config_language: 'Idioma',
            config_serial: 'Configuración Puerto Serie',
            config_baud_rate: 'Velocidad en Baudios',
            config_data_bits: 'Bits de Datos',
            config_stop_bits: 'Bits de Parada',
            config_parity: 'Paridad',
            config_display: 'Configuración de Pantalla',
            config_font_size: 'Tamaño de Fuente',
            config_notifications: 'Notificaciones',
            config_sound: 'Efectos de Sonido',
            config_alerts: 'Umbrales de Alerta',
            
            // AI Assistant
            ai_name: 'SOS AI',
            ai_placeholder: 'Pregúntame algo...',
            ai_thinking: 'Pensando...',
            ai_learning: 'Aprendiendo...',
            ai_clear_chat: 'Limpiar Chat',
            
            // Notifications
            notif_no_notifications: 'Sin notificaciones',
            notif_clear_all: 'Limpiar Todo',
            
            // Messages
            msg_waiting_data: 'Esperando datos...',
            msg_connection_success: '¡Conectado exitosamente!',
            msg_connection_error: 'Error de conexión',
            msg_no_data: 'Sin datos para guardar',
            msg_saved_success: '¡Guardado exitosamente!',
            msg_settings_saved: 'Configuración guardada',
            
            // Time
            time_now: 'Ahora',
            time_seconds_ago: 'segundos',
            time_minutes_ago: 'minutos',
            time_hours_ago: 'horas',
            time_days_ago: 'días',
            
            // Crops
            crop_season_kharif: 'Temporada Monzón',
            crop_season_rabi: 'Temporada Invierno',
            crop_season_zaid: 'Temporada Verano',
            crop_recommendations: 'Recomendaciones de Cultivo',
            crop_tips: 'Consejos de Cultivo'
        };

        // Date/time formats per locale
        this.dateTimeFormats = {
            en: { dateStyle: 'medium', timeStyle: 'short' },
            hi: { dateStyle: 'medium', timeStyle: 'short' },
            es: { dateStyle: 'medium', timeStyle: 'short' }
        };
    }

    /**
     * Load saved language preference
     */
    loadSavedLanguage() {
        const saved = localStorage.getItem('sosLanguage');
        if (saved && this.supportedLanguages.includes(saved)) {
            this.currentLanguage = saved;
        } else {
            // Try to detect browser language
            const browserLang = navigator.language?.substring(0, 2);
            if (this.supportedLanguages.includes(browserLang)) {
                this.currentLanguage = browserLang;
            }
        }
    }

    /**
     * Get translation for a key
     */
    t(key, params = {}) {
        const translation = this.translations[this.currentLanguage]?.[key] || 
                           this.translations.en?.[key] || 
                           key;
        
        // Replace placeholders like {name} with params
        return translation.replace(/\{(\w+)\}/g, (match, param) => {
            return params[param] !== undefined ? params[param] : match;
        });
    }

    /**
     * Set language
     */
    setLanguage(lang) {
        if (!this.supportedLanguages.includes(lang)) {
            console.warn(`[I18n] Unsupported language: ${lang}`);
            return false;
        }

        this.currentLanguage = lang;
        localStorage.setItem('sosLanguage', lang);

        // Update HTML lang attribute
        document.documentElement.lang = lang;

        // Dispatch event for UI to update
        window.dispatchEvent(new CustomEvent('language-changed', {
            detail: { language: lang }
        }));

        return true;
    }

    /**
     * Get current language
     */
    getLanguage() {
        return this.currentLanguage;
    }

    /**
     * Get all supported languages with their names
     */
    getLanguages() {
        return [
            { code: 'en', name: 'English', nativeName: 'English' },
            { code: 'hi', name: 'Hindi', nativeName: 'हिंदी' },
            { code: 'es', name: 'Spanish', nativeName: 'Español' }
        ];
    }

    /**
     * Format date according to current locale
     */
    formatDate(date, options = {}) {
        const d = date instanceof Date ? date : new Date(date);
        const format = { ...this.dateTimeFormats[this.currentLanguage], ...options };
        
        try {
            return new Intl.DateTimeFormat(this.currentLanguage, format).format(d);
        } catch (e) {
            return d.toLocaleString();
        }
    }

    /**
     * Format relative time (e.g., "2 hours ago")
     */
    formatRelativeTime(date) {
        const now = new Date();
        const d = date instanceof Date ? date : new Date(date);
        const diffMs = now - d;
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHour = Math.floor(diffMin / 60);
        const diffDay = Math.floor(diffHour / 24);

        if (diffSec < 60) {
            return diffSec === 0 ? this.t('time_now') : `${diffSec} ${this.t('time_seconds_ago')}`;
        } else if (diffMin < 60) {
            return `${diffMin} ${this.t('time_minutes_ago')}`;
        } else if (diffHour < 24) {
            return `${diffHour} ${this.t('time_hours_ago')}`;
        } else {
            return `${diffDay} ${this.t('time_days_ago')}`;
        }
    }

    /**
     * Format number according to current locale
     */
    formatNumber(number, options = {}) {
        try {
            return new Intl.NumberFormat(this.currentLanguage, options).format(number);
        } catch (e) {
            return number.toString();
        }
    }

    /**
     * Format currency
     */
    formatCurrency(amount, currency = 'USD') {
        return this.formatNumber(amount, { style: 'currency', currency });
    }

    /**
     * Update all elements with data-i18n attribute
     */
    updatePageTranslations() {
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            element.textContent = this.t(key);
        });

        document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');
            element.placeholder = this.t(key);
        });

        document.querySelectorAll('[data-i18n-title]').forEach(element => {
            const key = element.getAttribute('data-i18n-title');
            element.title = this.t(key);
        });
    }
}

// Export for use in main script
window.I18nManager = I18nManager;
