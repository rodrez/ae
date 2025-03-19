export class Button {
  private element: HTMLButtonElement;
  private onClickCallback?: () => void;
  private mouseEnterHandler: () => void;
  private mouseLeaveHandler: () => void;

  constructor(
    text: string, 
    options: { 
      x?: number, 
      y?: number, 
      width?: string,
      className?: string,
      onClick?: () => void
    } = {}
  ) {
    // Create the button element
    this.element = document.createElement('button');
    this.element.textContent = text;
    this.element.className = 'game-button ' + (options.className || '');
    
    // Style the button
    this.element.style.position = 'absolute';
    if (options.x !== undefined && options.y !== undefined) {
      this.element.style.left = `${options.x}px`;
      this.element.style.top = `${options.y}px`;
      this.element.style.transform = 'translate(-50%, -50%)';
    }
    this.element.style.padding = '10px 20px';
    this.element.style.borderRadius = '5px';
    this.element.style.backgroundColor = '#4a6fa5';
    this.element.style.color = '#ffffff';
    this.element.style.border = 'none';
    this.element.style.fontSize = '18px';
    this.element.style.cursor = 'pointer';
    this.element.style.width = options.width || 'auto';
    
    // Add hover effect
    this.mouseEnterHandler = () => {
      this.element.style.backgroundColor = '#3a5a8a';
    };
    
    this.mouseLeaveHandler = () => {
      this.element.style.backgroundColor = '#4a6fa5';
    };
    
    this.element.addEventListener('mouseenter', this.mouseEnterHandler);
    this.element.addEventListener('mouseleave', this.mouseLeaveHandler);
    
    // Add click handler
    if (options.onClick) {
      this.onClickCallback = options.onClick;
      this.element.addEventListener('click', this.onClickCallback);
    }
    
    // Add to DOM
    document.body.appendChild(this.element);
  }
  
  setText(text: string): void {
    this.element.textContent = text;
  }
  
  setPosition(x: number, y: number): void {
    this.element.style.left = `${x}px`;
    this.element.style.top = `${y}px`;
  }
  
  disable(): void {
    this.element.disabled = true;
    this.element.style.backgroundColor = '#888888';
    this.element.style.cursor = 'not-allowed';
  }
  
  enable(): void {
    this.element.disabled = false;
    this.element.style.backgroundColor = '#4a6fa5';
    this.element.style.cursor = 'pointer';
  }
  
  destroy(): void {
    // Remove event listeners
    if (this.onClickCallback) {
      this.element.removeEventListener('click', this.onClickCallback);
    }
    
    this.element.removeEventListener('mouseenter', this.mouseEnterHandler);
    this.element.removeEventListener('mouseleave', this.mouseLeaveHandler);
    
    // Remove from DOM
    if (this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
} 