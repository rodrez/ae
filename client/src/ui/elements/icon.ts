
/**
 * Icon component for displaying SVG icons 
 */
export class Icon {
  private element: HTMLDivElement;
  private iconElement: HTMLElement;
  private onClickCallback?: () => void;
  
  constructor(
    icon: string,
    options: {
      x?: number;
      y?: number;
      size?: string;
      color?: string;
      backgroundColor?: string;
      padding?: string;
      className?: string;
      tooltip?: string;
      onClick?: () => void;
    } = {}
  ) {
    // Create icon container
    this.element = document.createElement('div');
    this.element.className = `game-icon ${options.className || ''}`;
    
    if (options.x !== undefined && options.y !== undefined) {
      this.element.style.position = 'absolute';
      this.element.style.left = `${options.x}px`;
      this.element.style.top = `${options.y}px`;
    }
    
    // Style the container
    this.element.style.display = 'flex';
    this.element.style.alignItems = 'center';
    this.element.style.justifyContent = 'center';
    this.element.style.width = options.size || '24px';
    this.element.style.height = options.size || '24px';
    
    if (options.backgroundColor) {
      this.element.style.backgroundColor = options.backgroundColor;
      this.element.style.borderRadius = '50%'; // Circular background
    }
    
    if (options.padding) {
      this.element.style.padding = options.padding;
    }
    
    if (options.onClick) {
      this.element.style.cursor = 'pointer';
      this.onClickCallback = options.onClick;
      this.element.addEventListener('click', () => {
        if (this.onClickCallback) {
          this.onClickCallback();
        }
      });
    }
    
    // Create icon element
    this.iconElement = document.createElement('div');
    this.iconElement.innerHTML = icon;
    this.iconElement.style.display = 'flex';
    this.iconElement.style.alignItems = 'center';
    this.iconElement.style.justifyContent = 'center';
    this.iconElement.style.width = '100%';
    this.iconElement.style.height = '100%';
    
    // Apply color to SVG paths if specified
    if (options.color) {
      this.setColor(options.color);
    }
    
    // Add icon element to container
    this.element.appendChild(this.iconElement);
    
    // Add tooltip if specified
    if (options.tooltip) {
      this.element.title = options.tooltip;
    }
    
    // Add to DOM
    document.body.appendChild(this.element);
  }
  
  /**
   * Set icon color
   */
  setColor(color: string): void {
    const svgElement = this.iconElement.querySelector('svg');
    if (svgElement) {
      svgElement.style.fill = color;
      // For some icon libraries that use stroke instead of fill
      svgElement.style.stroke = color;
    }
  }
  
  /**
   * Set tooltip text
   */
  setTooltip(text: string): void {
    this.element.title = text;
  }
  
  /**
   * Set position of the icon
   */
  setPosition(x: number, y: number): void {
    this.element.style.position = 'absolute';
    this.element.style.left = `${x}px`;
    this.element.style.top = `${y}px`;
  }
  
  /**
   * Set icon content (SVG string)
   */
  setIcon(icon: string): void {
    this.iconElement.innerHTML = icon;
  }
  
  /**
   * Set click handler
   */
  setOnClick(callback: () => void): void {
    this.onClickCallback = callback;
  }
  
  /**
   * Get the DOM element
   */
  getElement(): HTMLDivElement {
    return this.element;
  }
  
  /**
   * Destroy the icon element
   */
  destroy(): void {
    if (this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
  
  /**
   * Common SVG icons that can be used
   */
  static Icons = {
    CLOSE: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',
    SETTINGS: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>',
    INFO: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>',
    WARNING: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>',
    ERROR: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>',
    RELOAD: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>',
    ARROW_UP: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%"><path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/></svg>',
    ARROW_DOWN: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>',
    DELETE: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>',
    EDIT: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>',
    MENU: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>',
    SEARCH: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>',
    CHECKED: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>',
    LOG: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 9h-2V5h2v6zm0 4h-2v-2h2v2z"/></svg>',
  };
} 