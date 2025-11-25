/**
 * SOS Connect Pro - GPS Location & Mapping
 * Integrates Leaflet.js for interactive maps and location tracking
 */

class LocationMapManager {
    constructor() {
        this.map = null;
        this.marker = null;
        this.locationHistory = [];
        this.geofences = [];
        this.watchId = null;
        this.currentLocation = null;
        this.mapContainerId = 'locationMap';
        this.isTracking = false;
        
        this.loadLocationHistory();
        this.loadGeofences();
    }

    /**
     * Initialize the map
     */
    initMap(containerId = 'locationMap', options = {}) {
        this.mapContainerId = containerId;
        const container = document.getElementById(containerId);
        
        if (!container) {
            console.error('[Location] Map container not found');
            return null;
        }

        // Check if Leaflet is loaded
        if (typeof L === 'undefined') {
            console.error('[Location] Leaflet.js not loaded');
            return null;
        }

        const defaultOptions = {
            center: [20.5937, 78.9629], // Default to India
            zoom: 5,
            zoomControl: true
        };

        const mapOptions = { ...defaultOptions, ...options };
        
        this.map = L.map(containerId, mapOptions);
        
        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(this.map);

        // Try to get current location
        this.getCurrentLocation();
        
        // Draw existing geofences
        this.drawGeofences();
        
        console.log('[Location] Map initialized');
        return this.map;
    }

    /**
     * Get current location
     */
    async getCurrentLocation() {
        if (!navigator.geolocation) {
            console.error('[Location] Geolocation not supported');
            return null;
        }

        return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    this.currentLocation = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        timestamp: new Date().toISOString()
                    };
                    
                    this.updateMarker();
                    this.addToHistory(this.currentLocation);
                    this.checkGeofences();
                    
                    resolve(this.currentLocation);
                },
                (error) => {
                    console.error('[Location] Error:', error);
                    reject(error);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 60000
                }
            );
        });
    }

    /**
     * Start location tracking
     */
    startTracking(interval = 30000) {
        if (this.isTracking) return;
        
        if (!navigator.geolocation) {
            console.error('[Location] Geolocation not supported');
            return false;
        }

        this.isTracking = true;
        
        this.watchId = navigator.geolocation.watchPosition(
            (position) => {
                this.currentLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    speed: position.coords.speed,
                    heading: position.coords.heading,
                    timestamp: new Date().toISOString()
                };
                
                this.updateMarker();
                this.addToHistory(this.currentLocation);
                this.checkGeofences();
                
                window.dispatchEvent(new CustomEvent('location-update', {
                    detail: this.currentLocation
                }));
            },
            (error) => {
                console.error('[Location] Watch error:', error);
            },
            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 0
            }
        );

        console.log('[Location] Tracking started');
        return true;
    }

    /**
     * Stop location tracking
     */
    stopTracking() {
        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
        this.isTracking = false;
        console.log('[Location] Tracking stopped');
    }

    /**
     * Update marker on map
     */
    updateMarker() {
        if (!this.map || !this.currentLocation) return;

        const { lat, lng, accuracy } = this.currentLocation;
        const latlng = [lat, lng];

        if (this.marker) {
            this.marker.setLatLng(latlng);
        } else {
            // Create custom icon
            const icon = L.divIcon({
                className: 'location-marker',
                html: '<div class="marker-pulse"></div><div class="marker-dot">📍</div>',
                iconSize: [40, 40],
                iconAnchor: [20, 40]
            });

            this.marker = L.marker(latlng, { icon }).addTo(this.map);
            this.marker.bindPopup(`
                <strong>Your Location</strong><br>
                Lat: ${lat.toFixed(6)}<br>
                Lng: ${lng.toFixed(6)}<br>
                Accuracy: ±${Math.round(accuracy)}m
            `);
        }

        // Update accuracy circle if it exists
        if (this.accuracyCircle) {
            this.accuracyCircle.setLatLng(latlng);
            this.accuracyCircle.setRadius(accuracy);
        } else {
            this.accuracyCircle = L.circle(latlng, {
                radius: accuracy,
                color: '#3b82f6',
                fillColor: '#3b82f6',
                fillOpacity: 0.15,
                weight: 2
            }).addTo(this.map);
        }

        // Center map on location
        this.map.setView(latlng, Math.max(this.map.getZoom(), 15));
    }

    /**
     * Add location to history
     */
    addToHistory(location) {
        this.locationHistory.push(location);
        
        // Keep only last 1000 points
        if (this.locationHistory.length > 1000) {
            this.locationHistory = this.locationHistory.slice(-1000);
        }
        
        this.saveLocationHistory();
    }

    /**
     * Draw location history trail
     */
    drawTrail() {
        if (!this.map || this.locationHistory.length < 2) return;

        const points = this.locationHistory.map(loc => [loc.lat, loc.lng]);
        
        if (this.trailLine) {
            this.trailLine.setLatLngs(points);
        } else {
            this.trailLine = L.polyline(points, {
                color: '#e94560',
                weight: 3,
                opacity: 0.7,
                smoothFactor: 1
            }).addTo(this.map);
        }
    }

    /**
     * Clear trail
     */
    clearTrail() {
        if (this.trailLine) {
            this.map.removeLayer(this.trailLine);
            this.trailLine = null;
        }
        this.locationHistory = [];
        this.saveLocationHistory();
    }

    /**
     * Add geofence
     */
    addGeofence(name, lat, lng, radius, type = 'circle') {
        const geofence = {
            id: `geofence-${Date.now()}`,
            name,
            lat,
            lng,
            radius,
            type,
            active: true,
            createdAt: new Date().toISOString()
        };
        
        this.geofences.push(geofence);
        this.saveGeofences();
        this.drawGeofence(geofence);
        
        return geofence;
    }

    /**
     * Draw geofence on map
     */
    drawGeofence(geofence) {
        if (!this.map) return;

        const circle = L.circle([geofence.lat, geofence.lng], {
            radius: geofence.radius,
            color: '#10b981',
            fillColor: '#10b981',
            fillOpacity: 0.2,
            weight: 2,
            dashArray: '5, 5'
        }).addTo(this.map);

        circle.bindPopup(`
            <strong>${geofence.name}</strong><br>
            Radius: ${geofence.radius}m<br>
            <button onclick="window.locationManager?.removeGeofence('${geofence.id}')">Remove</button>
        `);

        geofence.layer = circle;
    }

    /**
     * Draw all geofences
     */
    drawGeofences() {
        this.geofences.forEach(gf => this.drawGeofence(gf));
    }

    /**
     * Remove geofence
     */
    removeGeofence(id) {
        const index = this.geofences.findIndex(gf => gf.id === id);
        if (index > -1) {
            const geofence = this.geofences[index];
            if (geofence.layer) {
                this.map.removeLayer(geofence.layer);
            }
            this.geofences.splice(index, 1);
            this.saveGeofences();
        }
    }

    /**
     * Check if current location is inside any geofence
     */
    checkGeofences() {
        if (!this.currentLocation) return;

        this.geofences.forEach(geofence => {
            if (!geofence.active) return;

            const distance = this.calculateDistance(
                this.currentLocation.lat,
                this.currentLocation.lng,
                geofence.lat,
                geofence.lng
            );

            const isInside = distance <= geofence.radius;
            const wasInside = geofence.wasInside || false;

            if (isInside && !wasInside) {
                // Entered geofence
                window.dispatchEvent(new CustomEvent('geofence-enter', {
                    detail: { geofence, location: this.currentLocation }
                }));
                console.log(`[Location] Entered geofence: ${geofence.name}`);
            } else if (!isInside && wasInside) {
                // Exited geofence
                window.dispatchEvent(new CustomEvent('geofence-exit', {
                    detail: { geofence, location: this.currentLocation }
                }));
                console.log(`[Location] Exited geofence: ${geofence.name}`);
            }

            geofence.wasInside = isInside;
        });
    }

    /**
     * Calculate distance between two points (Haversine formula)
     */
    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371000; // Earth's radius in meters
        const dLat = this.toRad(lat2 - lat1);
        const dLng = this.toRad(lng2 - lng1);
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
                  Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    toRad(deg) {
        return deg * (Math.PI / 180);
    }

    /**
     * Share location (for emergency)
     */
    async shareLocation(message = '') {
        if (!this.currentLocation) {
            await this.getCurrentLocation();
        }

        if (!this.currentLocation) {
            throw new Error('Could not get location');
        }

        const { lat, lng } = this.currentLocation;
        const mapsUrl = `https://maps.google.com/maps?q=${lat},${lng}`;
        const shareText = `${message}\nMy location: ${mapsUrl}`;

        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'SOS - My Location',
                    text: shareText,
                    url: mapsUrl
                });
                return true;
            } catch (error) {
                console.error('[Location] Share error:', error);
            }
        }

        // Fallback: copy to clipboard
        try {
            await navigator.clipboard.writeText(shareText);
            return true;
        } catch (error) {
            console.error('[Location] Clipboard error:', error);
            return false;
        }
    }

    /**
     * Get formatted address (reverse geocoding)
     */
    async getAddress(lat, lng) {
        try {
            const response = await fetch(
                `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
            );
            const data = await response.json();
            return {
                city: data.city || data.locality,
                state: data.principalSubdivision,
                country: data.countryName,
                full: `${data.locality || data.city}, ${data.principalSubdivision}, ${data.countryName}`
            };
        } catch (error) {
            console.error('[Location] Geocode error:', error);
            return null;
        }
    }

    /**
     * Save location history to localStorage
     */
    saveLocationHistory() {
        try {
            localStorage.setItem('sosLocationHistory', JSON.stringify(this.locationHistory.slice(-100)));
        } catch (error) {
            console.error('[Location] Save history error:', error);
        }
    }

    /**
     * Load location history from localStorage
     */
    loadLocationHistory() {
        try {
            const saved = localStorage.getItem('sosLocationHistory');
            if (saved) {
                this.locationHistory = JSON.parse(saved);
            }
        } catch (error) {
            console.error('[Location] Load history error:', error);
        }
    }

    /**
     * Save geofences to localStorage
     */
    saveGeofences() {
        try {
            const geofencesToSave = this.geofences.map(gf => ({
                ...gf,
                layer: undefined,
                wasInside: undefined
            }));
            localStorage.setItem('sosGeofences', JSON.stringify(geofencesToSave));
        } catch (error) {
            console.error('[Location] Save geofences error:', error);
        }
    }

    /**
     * Load geofences from localStorage
     */
    loadGeofences() {
        try {
            const saved = localStorage.getItem('sosGeofences');
            if (saved) {
                this.geofences = JSON.parse(saved);
            }
        } catch (error) {
            console.error('[Location] Load geofences error:', error);
        }
    }

    /**
     * Destroy map
     */
    destroy() {
        this.stopTracking();
        if (this.map) {
            this.map.remove();
            this.map = null;
        }
    }
}

// Export for use in main script
window.LocationMapManager = LocationMapManager;
