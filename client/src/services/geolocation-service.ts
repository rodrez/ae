/**
 * Service for handling geolocation functionality
 */
export class GeolocationService {
  private watchId: number | null = null;
  private locationListeners: ((position: GeolocationPosition) => void)[] = [];
  private errorListeners: ((error: GeolocationPositionError) => void)[] = [];
  private lastKnownPosition: GeolocationPosition | null = null;
  private isTracking = false;

  /**
   * Start tracking the user's location
   */
  startTracking(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser'));
        return;
      }

      // First get the current position
      navigator.geolocation.getCurrentPosition(
        (position) => {
          this.lastKnownPosition = position;
          
          // Then start watching for changes
          this.watchId = navigator.geolocation.watchPosition(
            (updatedPosition) => {
              this.lastKnownPosition = updatedPosition;
              this.notifyLocationListeners(updatedPosition);
            },
            (error) => {
              this.notifyErrorListeners(error);
            },
            {
              enableHighAccuracy: true,
              maximumAge: 30000,
              timeout: 27000
            }
          );
          
          this.isTracking = true;
          resolve(position);
        },
        (error) => {
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    });
  }

  /**
   * Stop tracking the user's location
   */
  stopTracking(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
      this.isTracking = false;
    }
  }

  /**
   * Get the last known position
   */
  getLastKnownPosition(): GeolocationPosition | null {
    return this.lastKnownPosition;
  }

  /**
   * Check if location tracking is active
   */
  isLocationTracking(): boolean {
    return this.isTracking;
  }

  /**
   * Request a one-time position update
   */
  getCurrentPosition(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          this.lastKnownPosition = position;
          resolve(position);
        },
        (error) => {
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    });
  }

  /**
   * Register a callback for location updates
   */
  onLocationUpdate(callback: (position: GeolocationPosition) => void): void {
    this.locationListeners.push(callback);
    
    // Immediately provide the last known position if available
    if (this.lastKnownPosition) {
      callback(this.lastKnownPosition);
    }
  }

  /**
   * Remove a location update callback
   */
  offLocationUpdate(callback: (position: GeolocationPosition) => void): void {
    const index = this.locationListeners.indexOf(callback);
    if (index !== -1) {
      this.locationListeners.splice(index, 1);
    }
  }

  /**
   * Register a callback for location errors
   */
  onLocationError(callback: (error: GeolocationPositionError) => void): void {
    this.errorListeners.push(callback);
  }

  /**
   * Remove a location error callback
   */
  offLocationError(callback: (error: GeolocationPositionError) => void): void {
    const index = this.errorListeners.indexOf(callback);
    if (index !== -1) {
      this.errorListeners.splice(index, 1);
    }
  }

  /**
   * Calculate distance between two points in meters
   */
  calculateDistance(
    lat1: number, 
    lon1: number, 
    lat2: number, 
    lon2: number
  ): number {
    // Haversine formula to calculate distance between two points on Earth
    const R = 6371e3; // Earth radius in meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // distance in meters
  }

  /**
   * Check if a position is within a certain radius of another position
   */
  isWithinRadius(
    centerLat: number, 
    centerLon: number, 
    pointLat: number, 
    pointLon: number, 
    radiusMeters: number
  ): boolean {
    const distance = this.calculateDistance(centerLat, centerLon, pointLat, pointLon);
    return distance <= radiusMeters;
  }

  /**
   * Notify all location listeners
   */
  private notifyLocationListeners(position: GeolocationPosition): void {
    for (const listener of this.locationListeners) {
      try {
        listener(position);
      } catch (error) {
        console.error('Error in location update listener:', error);
      }
    }
  }

  /**
   * Notify all error listeners
   */
  private notifyErrorListeners(error: GeolocationPositionError): void {
    for (const listener of this.errorListeners) {
      try {
        listener(error);
      } catch (err) {
        console.error('Error in location error listener:', err);
      }
    }
  }
} 