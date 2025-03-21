import { GeoPosition } from "../utils/geo-mapping";

// Define the types of POIs our system supports
export type PoiType = 'city' | 'landmark' | 'quest' | 'shop' | 'resource' | 'danger' | 'player';

// Define the data structure for a POI
export interface PointOfInterest {
  id: string;
  name: string;
  description: string;
  type: PoiType;
  latitude: number;
  longitude: number;
  // Optional properties for game mechanics
  discovered?: boolean;
  visited?: boolean;
  interactable?: boolean;
  // Properties that are calculated
  distanceToPlayer?: number;
  x?: number;
  y?: number;
}

/**
 * Service to manage Points of Interest in the game
 */
export class PoiService {
  private pois: Map<string, PointOfInterest> = new Map();
  private _onPoiUpdatedListeners: ((poi: PointOfInterest) => void)[] = [];
  private _onPoisLoadedListeners: ((pois: PointOfInterest[]) => void)[] = [];

  /**
   * Initialize the POI service
   */
  public async initialize(): Promise<void> {
    // Load initial POIs - this could come from a local JSON file or an API
    try {
      await this.loadPois();
    } catch (error) {
      console.error('Failed to load POIs:', error);
      // Fallback to sample data if loading fails
      this.loadSamplePois();
    }
  }

  /**
   * Load POIs from a source (API or local file)
   */
  private async loadPois(): Promise<void> {
    try {
      // In a real implementation, this would fetch from an API endpoint
      // For now, we'll use a local fetch to a JSON file
      const response = await fetch('/assets/data/pois.json');
      
      if (!response.ok) {
        throw new Error(`Failed to load POIs: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (Array.isArray(data)) {
        // Clear existing POIs
        this.pois.clear();
        
        // Add new POIs
        data.forEach(poi => {
          if (this.isValidPoi(poi)) {
            this.pois.set(poi.id, poi);
          } else {
            console.warn('Invalid POI data:', poi);
          }
        });
        
        console.log(`Loaded ${this.pois.size} points of interest`);
        
        // Notify listeners
        this.notifyPoisLoaded();
      } else {
        throw new Error('Invalid POI data format');
      }
    } catch (error) {
      console.error('Error loading POIs:', error);
      throw error;
    }
  }
  
  /**
   * Basic validation for POI data
   */
  private isValidPoi(poi: any): boolean {
    return (
      poi &&
      typeof poi.id === 'string' &&
      typeof poi.name === 'string' &&
      typeof poi.latitude === 'number' &&
      typeof poi.longitude === 'number' &&
      typeof poi.type === 'string'
    );
  }

  /**
   * Load sample POIs as a fallback
   */
  private loadSamplePois(): void {
    const samplePois: PointOfInterest[] = [
      {
        id: 'city1',
        name: 'Central Hub',
        description: 'The main city in the game world',
        type: 'city',
        latitude: 37.7749,
        longitude: -122.4194,
        discovered: true,
        visited: true,
        interactable: true
      },
      {
        id: 'landmark1',
        name: 'Ancient Monument',
        description: 'A mysterious ancient structure',
        type: 'landmark',
        latitude: 37.7850,
        longitude: -122.4300,
        discovered: true,
        visited: false,
        interactable: true
      },
      {
        id: 'resource1',
        name: 'Crystal Deposit',
        description: 'A valuable resource node',
        type: 'resource',
        latitude: 37.7700,
        longitude: -122.4100,
        discovered: false,
        interactable: true
      },
      {
        id: 'shop1',
        name: 'Merchant Outpost',
        description: 'A place to trade goods',
        type: 'shop',
        latitude: 37.7800,
        longitude: -122.4000,
        discovered: true,
        visited: true,
        interactable: true
      },
      {
        id: 'danger1',
        name: 'Monster Den',
        description: 'A dangerous area with powerful enemies',
        type: 'danger',
        latitude: 37.7600,
        longitude: -122.4200,
        discovered: true,
        interactable: true
      }
    ];
    
    // Clear and add sample POIs
    this.pois.clear();
    samplePois.forEach(poi => {
      this.pois.set(poi.id, poi);
    });
    
    console.log(`Loaded ${this.pois.size} sample points of interest`);
    
    // Notify listeners
    this.notifyPoisLoaded();
  }
  
  /**
   * Get all available POIs
   */
  public getAllPois(): PointOfInterest[] {
    return Array.from(this.pois.values());
  }
  
  /**
   * Get POIs of a specific type
   */
  public getPoisByType(type: PoiType): PointOfInterest[] {
    return this.getAllPois().filter(poi => poi.type === type);
  }
  
  /**
   * Get POIs within a specific radius of a location
   */
  public getPoisNearLocation(latitude: number, longitude: number, radiusKm: number): PointOfInterest[] {
    return this.getAllPois().filter(poi => {
      const distance = this.calculateDistance(
        latitude, 
        longitude,
        poi.latitude,
        poi.longitude
      );
      
      // Update the distance property
      poi.distanceToPlayer = distance;
      
      return distance <= radiusKm;
    });
  }
  
  /**
   * Calculate distance between two coordinates in kilometers (using Haversine formula)
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    return distance;
  }
  
  private toRadians(degrees: number): number {
    return degrees * Math.PI / 180;
  }
  
  /**
   * Discover a POI (mark as discovered)
   */
  public discoverPoi(id: string): PointOfInterest | undefined {
    const poi = this.pois.get(id);
    
    if (poi && !poi.discovered) {
      poi.discovered = true;
      this.pois.set(id, poi);
      this.notifyPoiUpdated(poi);
      return poi;
    }
    
    return poi;
  }
  
  /**
   * Visit a POI (mark as visited)
   */
  public visitPoi(id: string): PointOfInterest | undefined {
    const poi = this.pois.get(id);
    
    if (poi && !poi.visited) {
      poi.visited = true;
      poi.discovered = true; // Also mark as discovered
      this.pois.set(id, poi);
      this.notifyPoiUpdated(poi);
      return poi;
    }
    
    return poi;
  }
  
  /**
   * Add a new custom POI
   */
  public addCustomPoi(poi: Omit<PointOfInterest, 'id'>): PointOfInterest {
    // Generate a unique ID
    const id = `custom_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const newPoi: PointOfInterest = {
      id,
      ...poi
    };
    
    this.pois.set(id, newPoi);
    this.notifyPoiUpdated(newPoi);
    return newPoi;
  }
  
  /**
   * Remove a POI
   */
  public removePoi(id: string): boolean {
    return this.pois.delete(id);
  }
  
  /**
   * Update a POI with new data
   */
  public updatePoi(id: string, data: Partial<PointOfInterest>): PointOfInterest | undefined {
    const poi = this.pois.get(id);
    
    if (poi) {
      const updatedPoi = { ...poi, ...data };
      this.pois.set(id, updatedPoi);
      this.notifyPoiUpdated(updatedPoi);
      return updatedPoi;
    }
    
    return undefined;
  }
  
  /**
   * Update the game world coordinates for a POI
   */
  public updatePoiGameCoordinates(id: string, x: number, y: number): void {
    const poi = this.pois.get(id);
    
    if (poi) {
      poi.x = x;
      poi.y = y;
      this.pois.set(id, poi);
    }
  }
  
  /**
   * Register a callback for when a POI is updated
   */
  public onPoiUpdated(callback: (poi: PointOfInterest) => void): void {
    this._onPoiUpdatedListeners.push(callback);
  }
  
  /**
   * Remove a callback for POI updates
   */
  public offPoiUpdated(callback: (poi: PointOfInterest) => void): void {
    this._onPoiUpdatedListeners = this._onPoiUpdatedListeners.filter(
      listener => listener !== callback
    );
  }
  
  /**
   * Register a callback for when POIs are loaded
   */
  public onPoisLoaded(callback: (pois: PointOfInterest[]) => void): void {
    this._onPoisLoadedListeners.push(callback);
    
    // If POIs are already loaded, trigger the callback immediately
    if (this.pois.size > 0) {
      callback(this.getAllPois());
    }
  }
  
  /**
   * Remove a callback for POIs loaded
   */
  public offPoisLoaded(callback: (pois: PointOfInterest[]) => void): void {
    this._onPoisLoadedListeners = this._onPoisLoadedListeners.filter(
      listener => listener !== callback
    );
  }
  
  /**
   * Notify all listeners that a POI has been updated
   */
  private notifyPoiUpdated(poi: PointOfInterest): void {
    this._onPoiUpdatedListeners.forEach(listener => {
      listener(poi);
    });
  }
  
  /**
   * Notify all listeners that POIs have been loaded
   */
  private notifyPoisLoaded(): void {
    const pois = this.getAllPois();
    this._onPoisLoadedListeners.forEach(listener => {
      listener(pois);
    });
  }
} 