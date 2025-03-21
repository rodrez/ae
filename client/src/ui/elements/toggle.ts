/**
 * Toggle component for on/off switches
 */
export class Toggle {
  private element: HTMLDivElement;
  private track: HTMLDivElement;
  private thumb: HTMLDivElement;
  private label?: HTMLLabelElement;
  private input: HTMLInputElement;
  private onChangeCallback?: (isChecked: boolean) => void;
  private color: string;
  
  constructor(
    options: {
      label?: string;
      initialState?: boolean;
      x?: number;
      y?: number;
      color?: string; 
      onChange?: (isChecked: boolean) => void;
      className?: string;
    } = {}
  ) {
    // Store custom color
    this.color = options.color || '#4a6fa5';
    
    // Create main container
    this.element = document.createElement('div');
    this.element.className = `game-toggle-container ${options.className || ''}`;
    this.element.style.display = 'flex';
    this.element.style.alignItems = 'center';
    this.element.style.gap = '10px';
    
    if (options.x !== undefined && options.y !== undefined) {
      this.element.style.position = 'absolute';
      this.element.style.left = `${options.x}px`;
      this.element.style.top = `${options.y}px`;
    }
    
    // Create hidden checkbox input (for accessibility)
    this.input = document.createElement('input');
    this.input.type = 'checkbox';
    this.input.checked = options.initialState || false;
    this.input.style.position = 'absolute';
    this.input.style.opacity = '0';
    this.input.style.height = '0';
    this.input.style.width = '0';
    this.element.appendChild(this.input);
    
    // Create toggle track
    this.track = document.createElement('div');
    this.track.className = 'game-toggle-track';
    this.track.style.position = 'relative';
    this.track.style.width = '44px';
    this.track.style.height = '24px';
    this.track.style.backgroundColor = options.initialState ? this.color : '#555';
    this.track.style.borderRadius = '12px';
    this.track.style.transition = 'background-color 0.2s';
    this.track.style.cursor = 'pointer';
    this.element.appendChild(this.track);
    
    // Create toggle thumb
    this.thumb = document.createElement('div');
    this.thumb.className = 'game-toggle-thumb';
    this.thumb.style.position = 'absolute';
    this.thumb.style.width = '20px';
    this.thumb.style.height = '20px';
    this.thumb.style.backgroundColor = '#fff';
    this.thumb.style.borderRadius = '50%';
    this.thumb.style.top = '2px';
    this.thumb.style.left = options.initialState ? '22px' : '2px';
    this.thumb.style.transition = 'left 0.2s';
    this.thumb.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.3)';
    this.track.appendChild(this.thumb);
    
    // Create label if provided
    if (options.label) {
      this.label = document.createElement('label');
      this.label.textContent = options.label;
      this.label.style.fontSize = '14px';
      this.label.style.cursor = 'pointer';
      this.label.style.color = '#f0f0f0';
      this.element.appendChild(this.label);
    }
    
    // Store change callback
    this.onChangeCallback = options.onChange;
    
    // Add event listeners
    const toggleSwitch = () => {
      const newState = !this.input.checked;
      this.setChecked(newState);
      
      if (this.onChangeCallback) {
        this.onChangeCallback(newState);
      }
    };
    
    this.track.addEventListener('click', toggleSwitch);
    if (this.label) {
      this.label.addEventListener('click', toggleSwitch);
    }
    
    // Add to DOM
    document.body.appendChild(this.element);
  }
  
  /**
   * Get the checked state of the toggle
   */
  isChecked(): boolean {
    return this.input.checked;
  }
  
  /**
   * Set the checked state of the toggle
   */
  setChecked(checked: boolean, triggerCallback = false): void {
    this.input.checked = checked;
    
    // Update visual state
    this.thumb.style.left = checked ? '22px' : '2px';
    this.track.style.backgroundColor = checked ? this.color : '#555';
    
    // Trigger callback if requested
    if (triggerCallback && this.onChangeCallback) {
      this.onChangeCallback(checked);
    }
  }
  
  /**
   * Set position of the toggle
   */
  setPosition(x: number, y: number): void {
    this.element.style.position = 'absolute';
    this.element.style.left = `${x}px`;
    this.element.style.top = `${y}px`;
  }
  
  /**
   * Set the on change callback
   */
  setOnChange(callback: (isChecked: boolean) => void): void {
    this.onChangeCallback = callback;
  }
  
  /**
   * Disable the toggle
   */
  disable(): void {
    this.input.disabled = true;
    this.track.style.opacity = '0.5';
    this.track.style.cursor = 'not-allowed';
    if (this.label) {
      this.label.style.opacity = '0.5';
      this.label.style.cursor = 'not-allowed';
    }
  }
  
  /**
   * Enable the toggle
   */
  enable(): void {
    this.input.disabled = false;
    this.track.style.opacity = '1';
    this.track.style.cursor = 'pointer';
    if (this.label) {
      this.label.style.opacity = '1';
      this.label.style.cursor = 'pointer';
    }
  }
  
  /**
   * Get the DOM element
   */
  getElement(): HTMLDivElement {
    return this.element;
  }
  
  /**
   * Destroy the toggle and clean up event listeners
   */
  destroy(): void {
    // Remove from DOM
    if (this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
} 