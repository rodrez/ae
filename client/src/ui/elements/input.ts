export class Input{
  private element: HTMLInputElement;
  private focusHandler: () => void;
  private blurHandler: () => void;
  
  constructor(
    options: {
      type?: string,
      placeholder?: string,
      x?: number,
      y?: number,
      width?: string,
      marginBottom?: string,
      className?: string,
      value?: string
    } = {}
  ) {
    // Create the input element
    this.element = document.createElement('input');
    this.element.type = options.type || 'text';
    this.element.placeholder = options.placeholder || '';
    this.element.className = 'game-input ' + (options.className || '');
    this.element.value = options.value || '';
    
    // Style the input
    this.element.style.position = 'absolute';
    if (options.x !== undefined && options.y !== undefined) {
      this.element.style.left = `${options.x}px`;
      this.element.style.top = `${options.y}px`;
      this.element.style.transform = 'translate(-50%, -50%)';
    }
    this.element.style.padding = '10px';
    this.element.style.borderRadius = '5px';
    this.element.style.border = '1px solid #ccc';
    this.element.style.fontSize = '16px';
    this.element.style.width = options.width || '250px';
    this.element.style.marginBottom = options.marginBottom || '0';
    this.element.style.boxSizing = 'border-box';
    
    // Add focus styling
    this.focusHandler = () => {
      this.element.style.borderColor = '#4a6fa5';
      this.element.style.outline = 'none';
    };
    
    this.blurHandler = () => {
      this.element.style.borderColor = '#ccc';
    };
    
    this.element.addEventListener('focus', this.focusHandler);
    this.element.addEventListener('blur', this.blurHandler);
    
    // Add to DOM
    document.body.appendChild(this.element);
  }
  
  getValue(): string {
    return this.element.value;
  }
  
  setValue(value: string): void {
    this.element.value = value;
  }
  
  setPosition(x: number, y: number): void {
    this.element.style.left = `${x}px`;
    this.element.style.top = `${y}px`;
  }
  
  focus(): void {
    this.element.focus();
  }
  
  destroy(): void {
    this.element.removeEventListener('focus', this.focusHandler);
    this.element.removeEventListener('blur', this.blurHandler);
    
    if (this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
} 