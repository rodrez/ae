/**
 * UI component for displaying room information
 */
export interface RoomData {
  type: string;
  name: string;
  displayName: string;
}

export interface RoomInfo {
  currentCell: string;
  rooms: RoomData[];
  timestamp: number;
}

export class RoomInfoDisplay {
  private container: HTMLDivElement;
  private isVisible = false;
  private rooms: RoomData[] = [];
  private currentCell = '';
  private isExpanded = false;
  private toggleButton: HTMLButtonElement;
  private refreshButton: HTMLButtonElement;
  private onRefreshCallback?: () => void;

  constructor() {
    // Create container
    this.container = document.createElement('div');
    this.container.className = 'room-info-display';
    
    // Style container
    this.container.style.position = 'absolute';
    this.container.style.right = '10px';
    this.container.style.top = '60px';
    this.container.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    this.container.style.color = '#fff';
    this.container.style.padding = '10px';
    this.container.style.borderRadius = '5px';
    this.container.style.fontFamily = 'monospace';
    this.container.style.fontSize = '12px';
    this.container.style.width = '250px';
    this.container.style.maxHeight = '300px';
    this.container.style.overflowY = 'auto';
    this.container.style.zIndex = '1000';
    this.container.style.display = 'none';
    
    // Create toggle button
    this.toggleButton = document.createElement('button');
    this.toggleButton.textContent = 'Show Rooms';
    this.toggleButton.style.position = 'absolute';
    this.toggleButton.style.right = '10px';
    this.toggleButton.style.top = '20px';
    this.toggleButton.style.padding = '5px 10px';
    this.toggleButton.style.backgroundColor = '#333';
    this.toggleButton.style.color = '#fff';
    this.toggleButton.style.border = 'none';
    this.toggleButton.style.borderRadius = '3px';
    this.toggleButton.style.cursor = 'pointer';
    this.toggleButton.style.zIndex = '1000';
    
    // Create refresh button
    this.refreshButton = document.createElement('button');
    this.refreshButton.textContent = '↻';
    this.refreshButton.style.position = 'absolute';
    this.refreshButton.style.right = '115px';
    this.refreshButton.style.top = '20px';
    this.refreshButton.style.padding = '5px 10px';
    this.refreshButton.style.backgroundColor = '#333';
    this.refreshButton.style.color = '#fff';
    this.refreshButton.style.border = 'none';
    this.refreshButton.style.borderRadius = '3px';
    this.refreshButton.style.cursor = 'pointer';
    this.refreshButton.style.zIndex = '1000';
    this.refreshButton.style.display = 'none'; // Initially hidden
    
    // Add event listeners
    this.toggleButton.addEventListener('click', () => this.toggle());
    this.refreshButton.addEventListener('click', () => {
      if (this.onRefreshCallback) {
        this.onRefreshCallback();
      }
    });
    
    // Add elements to DOM
    document.body.appendChild(this.container);
    document.body.appendChild(this.toggleButton);
    document.body.appendChild(this.refreshButton);
  }
  
  /**
   * Set callback for refresh button
   */
  setRefreshCallback(callback: () => void): void {
    this.onRefreshCallback = callback;
  }

  /**
   * Update room information
   */
  update(info: RoomInfo): void {
    this.rooms = info.rooms;
    this.currentCell = info.currentCell;
    
    if (this.isVisible) {
      this.render();
    }
  }
  
  /**
   * Toggle display visibility
   */
  toggle(): void {
    this.isVisible = !this.isVisible;
    this.container.style.display = this.isVisible ? 'block' : 'none';
    this.refreshButton.style.display = this.isVisible ? 'block' : 'none';
    this.toggleButton.textContent = this.isVisible ? 'Hide Rooms' : 'Show Rooms';
    
    if (this.isVisible) {
      this.render();
    }
  }
  
  /**
   * Render room information
   */
  private render(): void {
    // Clear container
    this.container.innerHTML = '';
    
    // Current cell heading
    const cellHeading = document.createElement('div');
    cellHeading.textContent = `Current Cell: ${this.currentCell || 'None'}`;
    cellHeading.style.fontWeight = 'bold';
    cellHeading.style.marginBottom = '10px';
    cellHeading.style.borderBottom = '1px solid #444';
    cellHeading.style.paddingBottom = '5px';
    this.container.appendChild(cellHeading);
    
    // Create section for grid cells
    const gridCells = this.rooms.filter(room => room.type === 'grid');
    if (gridCells.length > 0) {
      const gridSection = this.createSection('Grid Cells', gridCells);
      this.container.appendChild(gridSection);
    }
    
    // Create section for global rooms
    const globalRooms = this.rooms.filter(room => room.type === 'global');
    if (globalRooms.length > 0) {
      const globalSection = this.createSection('Global Channels', globalRooms);
      this.container.appendChild(globalSection);
    }
    
    // Create section for character rooms
    const characterRooms = this.rooms.filter(room => room.type === 'character');
    if (characterRooms.length > 0) {
      const characterSection = this.createSection('Character Channels', characterRooms);
      this.container.appendChild(characterSection);
    }
    
    // Create section for other rooms
    const otherRooms = this.rooms.filter(room => room.type === 'other');
    if (otherRooms.length > 0) {
      const otherSection = this.createSection('Other Channels', otherRooms);
      this.container.appendChild(otherSection);
    }
  }
  
  /**
   * Create a collapsible section for room types
   */
  private createSection(title: string, rooms: RoomData[]): HTMLDivElement {
    const section = document.createElement('div');
    section.className = 'room-section';
    section.style.marginBottom = '10px';
    
    // Create section header
    const header = document.createElement('div');
    header.textContent = `${title} (${rooms.length})`;
    header.style.fontWeight = 'bold';
    header.style.cursor = 'pointer';
    header.style.paddingTop = '5px';
    header.style.paddingBottom = '5px';
    
    // Create content container
    const content = document.createElement('div');
    content.style.paddingLeft = '10px';
    content.style.display = 'none';
    
    // Add rooms to content
    rooms.forEach(room => {
      const roomElement = document.createElement('div');
      roomElement.textContent = room.displayName;
      roomElement.style.padding = '3px 0';
      content.appendChild(roomElement);
    });
    
    // Toggle content visibility on header click
    header.addEventListener('click', () => {
      const isVisible = content.style.display === 'block';
      content.style.display = isVisible ? 'none' : 'block';
    });
    
    // Add elements to section
    section.appendChild(header);
    section.appendChild(content);
    
    return section;
  }
  
  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    
    if (this.toggleButton && this.toggleButton.parentNode) {
      this.toggleButton.parentNode.removeChild(this.toggleButton);
    }
    
    if (this.refreshButton && this.refreshButton.parentNode) {
      this.refreshButton.parentNode.removeChild(this.refreshButton);
    }
  }
} 