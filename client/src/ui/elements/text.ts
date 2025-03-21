/**
 * Text component for displaying styled text
 */
export class Text {
  private element: HTMLElement;
  
  constructor(
    text: string,
    options: {
      type?: 'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'span';
      x?: number;
      y?: number;
      color?: string;
      fontSize?: string;
      fontWeight?: string;
      width?: string;
      align?: 'left' | 'center' | 'right';
      className?: string;
      monospace?: boolean;
    } = {}
  ) {
    // Create text element based on type
    const elementType = options.type || 'p';
    this.element = document.createElement(elementType);
    this.element.textContent = text;
    this.element.className = `game-text ${options.className || ''}`;
    
    // Style the text
    if (options.x !== undefined && options.y !== undefined) {
      this.element.style.position = 'absolute';
      this.element.style.left = `${options.x}px`;
      this.element.style.top = `${options.y}px`;
    }
    
    this.element.style.color = options.color || '#f0f0f0';
    this.element.style.fontSize = options.fontSize || (elementType === 'p' ? '14px' : '');
    this.element.style.lineHeight = '1.4';
    this.element.style.margin = '0';
    
    if (options.fontWeight) {
      this.element.style.fontWeight = options.fontWeight;
    }
    
    if (options.width) {
      this.element.style.width = options.width;
    }
    
    if (options.align) {
      this.element.style.textAlign = options.align;
    }
    
    if (options.monospace) {
      this.element.style.fontFamily = 'monospace, Consolas, "Courier New", monospace';
    }
    
    // Add to DOM
    document.body.appendChild(this.element);
  }
  
  /**
   * Set the text content
   */
  setText(text: string): void {
    this.element.textContent = text;
  }
  
  /**
   * Set HTML content
   * Use with caution due to security implications
   */
  setHTML(html: string): void {
    this.element.innerHTML = html;
  }
  
  /**
   * Set text color
   */
  setColor(color: string): void {
    this.element.style.color = color;
  }
  
  /**
   * Set position of the text
   */
  setPosition(x: number, y: number): void {
    this.element.style.position = 'absolute';
    this.element.style.left = `${x}px`;
    this.element.style.top = `${y}px`;
  }
  
  /**
   * Add a CSS class to the text element
   */
  addClass(className: string): void {
    this.element.classList.add(className);
  }
  
  /**
   * Remove a CSS class from the text element
   */
  removeClass(className: string): void {
    this.element.classList.remove(className);
  }
  
  /**
   * Get the DOM element
   */
  getElement(): HTMLElement {
    return this.element;
  }
  
  /**
   * Destroy the text element
   */
  destroy(): void {
    if (this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
} 
