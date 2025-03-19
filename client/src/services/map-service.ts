import { GameConfig } from '../config';

export interface MapRegion {
    lat: number;
    lng: number;
    zoom: number;
}

export interface MapEntity {
    id: number;
    type: 'flag' | 'dungeon' | 'monster' | 'marketplace' | 'player-house';
    position: {
        lat: number;
        lng: number;
    };
    properties: Record<string, any>;
}

export interface RegionalData {
    entities: MapEntity[];
    terrain: string; // Type of terrain ('mountain', 'forest', 'desert', etc.)
    biome: string;   // Specific biome type
    landmarks: Array<{
        name: string;
        type: string;
        position: { lat: number; lng: number };
    }>;
}

export class MapService {
    private apiUrl: string;
    private cache: Map<string, RegionalData> = new Map();
    
    constructor() {
        this.apiUrl = GameConfig.apiUrl;
    }
    
    /**
     * Get map data for a specific region
     */
    public async getRegionData(region: MapRegion): Promise<RegionalData> {
        const cacheKey = `${region.lat},${region.lng},${region.zoom}`;
        
        // Check cache first
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey)!;
        }
        
        try {
            // In a real implementation, this would fetch from an API
            // For now, we'll generate some mock data
            const data = await this.getMockRegionData(region);
            
            // Cache the result
            this.cache.set(cacheKey, data);
            
            return data;
        } catch (error) {
            console.error('Failed to fetch region data:', error);
            throw error;
        }
    }
    
    /**
     * Get entities near a specific location
     */
    public async getNearbyEntities(lat: number, lng: number, radius: number): Promise<MapEntity[]> {
        try {
            // In a real implementation, this would fetch from an API
            // For now, we'll generate some mock data
            return this.getMockNearbyEntities(lat, lng, radius);
        } catch (error) {
            console.error('Failed to fetch nearby entities:', error);
            throw error;
        }
    }
    
    /**
     * Get real-world data for a location (used for special events, monsters, etc.)
     */
    public async getLocationFeatures(lat: number, lng: number): Promise<Record<string, any>> {
        try {
            // In a real implementation, this would fetch from a geospatial API
            // For now, we'll return mock data
            return {
                elevation: Math.random() * 2000, // meters
                isVolcanic: Math.random() > 0.9,
                isMountainous: Math.random() > 0.7,
                isCoastal: Math.random() > 0.8,
                landmarks: Math.random() > 0.8 ? ['Ancient ruins', 'Sacred grove'] : []
            };
        } catch (error) {
            console.error('Failed to fetch location features:', error);
            throw error;
        }
    }
    
    /**
     * Generate mock region data for testing
     * In a real implementation, this would fetch from an API
     */
    private async getMockRegionData(region: MapRegion): Promise<RegionalData> {
        // Simulate a network request
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Generate random data based on coordinates
        const seed = Math.sin(region.lat * 10) + Math.cos(region.lng * 10);
        const random = () => Math.abs((Math.sin(seed + Math.random()) + 1) / 2);
        
        const terrainTypes = ['mountain', 'forest', 'desert', 'grassland', 'wetland', 'tundra'];
        const biomeTypes = ['temperate', 'tropical', 'arid', 'polar', 'volcanic', 'coastal'];
        
        const terrain = terrainTypes[Math.floor(random() * terrainTypes.length)];
        const biome = biomeTypes[Math.floor(random() * biomeTypes.length)];
        
        // Generate some entities
        const entities: MapEntity[] = [];
        const entityCount = Math.floor(random() * 10) + 5;
        
        for (let i = 0; i < entityCount; i++) {
            const entityType = ['flag', 'dungeon', 'monster', 'marketplace', 'player-house'][Math.floor(random() * 5)] as MapEntity['type'];
            
            entities.push({
                id: Math.floor(random() * 1000000),
                type: entityType,
                position: {
                    lat: region.lat + (random() - 0.5) * 0.1,
                    lng: region.lng + (random() - 0.5) * 0.1
                },
                properties: {
                    name: `${entityType}-${Math.floor(random() * 100)}`,
                    level: Math.floor(random() * 10) + 1
                }
            });
        }
        
        // Generate landmarks
        const landmarks = [];
        const landmarkCount = Math.floor(random() * 3) + 1;
        
        for (let i = 0; i < landmarkCount; i++) {
            landmarks.push({
                name: `Landmark-${Math.floor(random() * 100)}`,
                type: ['mountain', 'lake', 'volcano', 'forest', 'ruins'][Math.floor(random() * 5)],
                position: {
                    lat: region.lat + (random() - 0.5) * 0.05,
                    lng: region.lng + (random() - 0.5) * 0.05
                }
            });
        }
        
        return {
            entities,
            terrain,
            biome,
            landmarks
        };
    }
    
    /**
     * Generate mock nearby entities for testing
     */
    private async getMockNearbyEntities(lat: number, lng: number, radius: number): Promise<MapEntity[]> {
        // Simulate a network request
        await new Promise(resolve => setTimeout(resolve, 200));
        
        const entities: MapEntity[] = [];
        const entityCount = Math.floor(Math.random() * 8) + 3;
        
        for (let i = 0; i < entityCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * radius;
            
            // Convert polar to cartesian offsets (simplified for small distances)
            const latOffset = (distance / 111111) * Math.cos(angle); // 111111 meters per degree latitude
            const lngOffset = (distance / (111111 * Math.cos(lat * Math.PI / 180))) * Math.sin(angle);
            
            const entityType = ['flag', 'dungeon', 'monster', 'marketplace', 'player-house'][Math.floor(Math.random() * 5)] as MapEntity['type'];
            
            entities.push({
                id: Math.floor(Math.random() * 1000000),
                type: entityType,
                position: {
                    lat: lat + latOffset,
                    lng: lng + lngOffset
                },
                properties: {
                    name: `${entityType}-${Math.floor(Math.random() * 100)}`,
                    level: Math.floor(Math.random() * 10) + 1
                }
            });
        }
        
        return entities;
    }
} 