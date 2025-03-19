export class Link {
  private element: HTMLAnchorElement;
  private clickHandler: (e: MouseEvent) => void;
  private mouseEnterHandler: () => void;
  private mouseLeaveHandler: () => void;
  private onClickCallback?: (e: MouseEvent) => void;

  constructor(
    text: string,
    options: {
      x?: number,
      y?: number,
      color?: string,
      fontSize?: string,
      className?: string,
      onClick?: (e: MouseEvent) => void
    } = {}
  ) {
    // Create the text link element
    this.element = document.createElement('a');
    this.element.textContent = text;
    this.element.href = '#';
    this.element.className = 'game-text-link ' + (options.className || '');
    
    // Style the link
    this.element.style.position = 'absolute';
    if (options.x !== undefined && options.y !== undefined) {
      this.element.style.left = `${options.x}px`;
      this.element.style.top = `${options.y}px`;
      this.element.style.transform = 'translate(-50%, -50%)';
    }
    this.element.style.color = options.color || '#ffffff';
    this.element.style.fontSize = options.fontSize || '18px';
    this.element.style.textDecoration = 'none';
    this.element.style.cursor = 'pointer';
    
    // Add hover effect
    this.mouseEnterHandler = () => {
      this.element.style.textDecoration = 'underline';
    };
    
    this.mouseLeaveHandler = () => {
      this.element.style.textDecoration = 'none';
    };
    
    this.element.addEventListener('mouseenter', this.mouseEnterHandler);
    this.element.addEventListener('mouseleave', this.mouseLeaveHandler);
    
    // Add click handler
    this.onClickCallback = options.onClick;
    this.clickHandler = (e: MouseEvent) => {
      e.preventDefault();
      if (this.onClickCallback) {
        this.onClickCallback(e);
      }
    };
    
    if (options.onClick) {
      this.element.addEventListener('click', this.clickHandler);
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
  
  setOnClick(callback: (e: MouseEvent) => void): void {
    this.element.removeEventListener('click', this.clickHandler);
    this.onClickCallback = callback;
    this.element.addEventListener('click', this.clickHandler);
  }
  
  destroy(): void {
    this.element.removeEventListener('click', this.clickHandler);
    this.element.removeEventListener('mouseenter', this.mouseEnterHandler);
    this.element.removeEventListener('mouseleave', this.mouseLeaveHandler);
    
    if (this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
} 