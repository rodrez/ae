import Phaser from 'phaser';
import L from 'leaflet';
import { GameConfig } from '../config';

export class WorldMap {
    private scene: Phaser.Scene;
    private mapContainer: HTMLDivElement;
    private leafletMap: L.Map;
    private isLoaded: boolean = false;
    private mapLayer: L.TileLayer;
    private markers: Map<string, L.Marker> = new Map();
    
    // Keep track of the current map region
    private currentRegion: {
        lat: number;
        lng: number;
        zoom: number;
    };
    
    constructor(scene: Phaser.Scene) {
        this.scene = scene;
        
        // Default starting region from config
        this.currentRegion = {
            lat: GameConfig.map.defaultCenter.lat,
            lng: GameConfig.map.defaultCenter.lng,
            zoom: GameConfig.map.defaultZoom
        };
        
        // Create a map container element and position it under the Phaser canvas
        this.createMapContainer();
        
        // Initialize Leaflet map
        this.initLeafletMap();
        
        // Listen for game resize events
        window.addEventListener('resize', this.handleResize.bind(this));
    }
    
    /**
     * Create a container for the Leaflet map
     */
    private createMapContainer(): void {
        // Get the canvas element
        const canvas = document.querySelector('canvas');
        
        if (!canvas) {
            console.error('Canvas element not found');
            return;
        }
        
        // Create a div for Leaflet that will be positioned behind the canvas
        this.mapContainer = document.createElement('div');
        this.mapContainer.id = 'leaflet-map-container';
        this.mapContainer.style.width = `${GameConfig.worldWidth}px`;
        this.mapContainer.style.height = `${GameConfig.worldHeight}px`;
        this.mapContainer.style.position = 'absolute';
        this.mapContainer.style.top = canvas.offsetTop + 'px';
        this.mapContainer.style.left = canvas.offsetLeft + 'px';
        this.mapContainer.style.zIndex = '-1'; // Place behind canvas
        
        // Add the container before the canvas in the DOM
        canvas.parentNode?.insertBefore(this.mapContainer, canvas);
    }
    
    /**
     * Initialize Leaflet map
     */
    private initLeafletMap(): void {
        // Initialize Leaflet map
        this.leafletMap = L.map(this.mapContainer, {
            center: [this.currentRegion.lat, this.currentRegion.lng],
            zoom: this.currentRegion.zoom,
            zoomControl: false, // We'll use our own zoom controls in Phaser
            attributionControl: false, // Hide attribution for cleaner look
            scrollWheelZoom: false // We'll handle zoom through game controls
        });
        
        // Add OpenStreetMap tiles with a custom style
        this.mapLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            minZoom: 2,
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.leafletMap);
        
        // Set initial view
        this.leafletMap.setView(
            [this.currentRegion.lat, this.currentRegion.lng], 
            this.currentRegion.zoom
        );
        
        // Mark map as loaded once tiles are loaded
        this.leafletMap.whenReady(() => {
            this.isLoaded = true;
            console.log('Map loaded');
        });
    }
    
    /**
     * Handle window resize
     */
    private handleResize(): void {
        // Get the canvas element
        const canvas = document.querySelector('canvas');
        
        if (!canvas || !this.mapContainer) return;
        
        // Update the map container size and position
        this.mapContainer.style.width = canvas.clientWidth + 'px';
        this.mapContainer.style.height = canvas.clientHeight + 'px';
        this.mapContainer.style.top = canvas.offsetTop + 'px';
        this.mapContainer.style.left = canvas.offsetLeft + 'px';
        
        // Notify Leaflet that the container size has changed
        this.leafletMap.invalidateSize();
    }
    
    /**
     * Load map data for a specific region
     */
    public loadRegion(lat: number, lng: number, zoom: number = 1): void {
        this.currentRegion = { lat, lng, zoom };
        
        // Update Leaflet map view
        this.leafletMap.setView([lat, lng], zoom);
        
        console.log(`Loading map region: lat=${lat}, lng=${lng}, zoom=${zoom}`);
    }
    
    /**
     * Add a marker to the map at the given coordinates
     */
    public addMarker(lat: number, lng: number, id: string, iconUrl?: string): L.Marker {
        // Check if marker already exists
        if (this.markers.has(id)) {
            const marker = this.markers.get(id)!;
            marker.setLatLng([lat, lng]);
            return marker;
        }
        
        // Create a custom icon if iconUrl is provided
        const icon = iconUrl ? L.icon({
            iconUrl,
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        }) : undefined;
        
        // Create a new marker
        const marker = L.marker([lat, lng], { icon }).addTo(this.leafletMap);
        
        // Store marker for later reference
        this.markers.set(id, marker);
        
        return marker;
    }
    
    /**
     * Remove a marker from the map
     */
    public removeMarker(id: string): void {
        const marker = this.markers.get(id);
        
        if (marker) {
            this.leafletMap.removeLayer(marker);
            this.markers.delete(id);
        }
    }
    
    /**
     * Convert latitude and longitude to pixel coordinates
     */
    public latLngToPixel(lat: number, lng: number): Phaser.Math.Vector2 {
        const point = this.leafletMap.latLngToContainerPoint([lat, lng]);
        return new Phaser.Math.Vector2(point.x, point.y);
    }
    
    /**
     * Convert pixel coordinates to latitude and longitude
     */
    public pixelToLatLng(x: number, y: number): { lat: number, lng: number } {
        const containerPoint = L.point(x, y);
        const latLng = this.leafletMap.containerPointToLatLng(containerPoint);
        return { lat: latLng.lat, lng: latLng.lng };
    }
    
    /**
     * Check if map is loaded
     */
    public isMapLoaded(): boolean {
        return this.isLoaded;
    }
    
    /**
     * Get the current region
     */
    public getCurrentRegion(): { lat: number; lng: number; zoom: number } {
        return this.currentRegion;
    }
    
    /**
     * Get the Leaflet map instance
     */
    public getLeafletMap(): L.Map {
        return this.leafletMap;
    }
    
    /**
     * Make the Phaser canvas transparent so the map can be seen through it
     */
    public makeCanvasTransparent(): void {
        const canvas = document.querySelector('canvas');
        if (canvas) {
            canvas.style.background = 'transparent';
        }
    }
    
    /**
     * Clean up resources when destroying the map
     */
    public destroy(): void {
        // Remove event listeners
        window.removeEventListener('resize', this.handleResize.bind(this));
        
        // Remove all markers
        this.markers.forEach(marker => {
            this.leafletMap.removeLayer(marker);
        });
        this.markers.clear();
        
        // Remove Leaflet map
        if (this.leafletMap) {
            this.leafletMap.remove();
        }
        
        // Remove container
        if (this.mapContainer && this.mapContainer.parentNode) {
            this.mapContainer.parentNode.removeChild(this.mapContainer);
        }
    }
} 