import { Button, Toggle } from '../elements';
import { logger, LogLevel, LogCategory } from '../../utils/logger';
import type { LogMessage } from '../../../../shared/types';

// Temporary icon implementation until we integrate with UI elements properly
class Icon {
  private element: HTMLDivElement;
  
  constructor(icon: string, options: { size?: string; color?: string; } = {}) {
    this.element = document.createElement('div');
    this.element.innerHTML = icon;
    this.element.style.width = options.size || '24px';
    this.element.style.height = options.size || '24px';
    
    if (options.color) {
      const svg = this.element.querySelector('svg');
      if (svg) {
        svg.style.fill = options.color;
      }
    }
  }
  
  getElement(): HTMLDivElement {
    return this.element;
  }
  
  static Icons = {
    SEARCH: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>'
  };
}

// Temporary panel implementation until we integrate with UI elements properly
class Panel {
  private element: HTMLDivElement;
  private contentElement: HTMLDivElement;
  private headerElement: HTMLDivElement;
  private footerElement?: HTMLDivElement;
  
  constructor(options: { 
    title?: string;
    width?: string;
    height?: string;
    draggable?: boolean;
    closable?: boolean;
    zIndex?: number;
    onClose?: () => void;
  } = {}) {
    // Create panel container
    this.element = document.createElement('div');
    this.element.className = 'game-panel';
    
    this.element.style.position = 'absolute';
    this.element.style.left = '50%';
    this.element.style.top = '50%';
    this.element.style.transform = 'translate(-50%, -50%)';
    this.element.style.width = options.width || '300px';
    this.element.style.height = options.height || 'auto';
    this.element.style.backgroundColor = '#1a1a1a';
    this.element.style.border = '1px solid #333';
    this.element.style.borderRadius = '6px';
    this.element.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.5)';
    this.element.style.overflow = 'hidden';
    this.element.style.display = 'none';
    this.element.style.overflow = 'auto'
    
    if (options.zIndex) {
      this.element.style.zIndex = options.zIndex.toString();
    }
    
    // Create header
    this.headerElement = document.createElement('div');
    this.headerElement.style.padding = '12px 16px';
    this.headerElement.style.borderBottom = '1px solid #333';
    this.headerElement.style.backgroundColor = '#292929';
    this.headerElement.style.display = 'flex';
    this.headerElement.style.justifyContent = 'space-between';
    
    if (options.title) {
      const titleElement = document.createElement('h2');
      titleElement.textContent = options.title;
      titleElement.style.margin = '0';
      titleElement.style.fontSize = '16px';
      titleElement.style.fontWeight = 'bold';
      titleElement.style.color = '#f0f0f0';
      this.headerElement.appendChild(titleElement);
    }
    
    if (options.closable) {
      const closeButton = document.createElement('button');
      closeButton.innerHTML = '&times;';
      closeButton.style.background = 'none';
      closeButton.style.border = 'none';
      closeButton.style.color = '#aaa';
      closeButton.style.fontSize = '20px';
      closeButton.style.cursor = 'pointer';
      closeButton.style.padding = '0 5px';
      
      closeButton.addEventListener('click', () => {
        if (options.onClose) {
          options.onClose();
        }
        this.hide();
      });
      
      this.headerElement.appendChild(closeButton);
    }
    
    // Create content container
    this.contentElement = document.createElement('div');
    this.contentElement.style.padding = '16px';
    this.contentElement.style.color = '#f0f0f0';
    
    // Add elements to panel
    this.element.appendChild(this.headerElement);
    this.element.appendChild(this.contentElement);
    
    // Add to DOM
    document.body.appendChild(this.element);
  }
  
  addContent(element: HTMLElement): void {
    this.contentElement.appendChild(element);
  }
  
  addFooter(): HTMLDivElement {
    if (!this.footerElement) {
      this.footerElement = document.createElement('div');
      this.footerElement.style.padding = '12px 16px';
      this.footerElement.style.borderTop = '1px solid #333';
      this.footerElement.style.backgroundColor = '#292929';
      this.footerElement.style.display = 'flex';
      this.footerElement.style.justifyContent = 'flex-end';
      this.footerElement.style.gap = '8px';
      this.element.appendChild(this.footerElement);
    }
    return this.footerElement;
  }
  
  show(): void {
    this.element.style.display = 'block';
  }
  
  hide(): void {
    this.element.style.display = 'none';
  }
  
  destroy(): void {
    if (this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}

/**
 * HTML-based logger panel using DOM elements instead of Phaser rendering
 */
export class HtmlLoggerPanel {
  private panel: Panel;
  private logContainer: HTMLDivElement;
  private logEntries: Map<string, HTMLDivElement> = new Map();
  private toggles: Map<string, Toggle> = new Map();
  private levelToggles: Map<LogLevel, Toggle> = new Map();
  private clearButton?: Button;
  private autoscrollToggle?: Toggle;
  private filterInput?: HTMLInputElement;
  private unsubscribe: (() => void) | null = null;
  private autoScroll = true;
  private filterText = '';
  private logCount = 0;
  private visible = false;
  private levelColors = {
    [LogLevel.DEBUG]: '#4CAF50', // Green
    [LogLevel.INFO]: '#2196F3',  // Blue
    [LogLevel.WARN]: '#FF9800',  // Orange
    [LogLevel.ERROR]: '#F44336', // Red
    [LogLevel.FATAL]: '#9C27B0'  // Purple
  };
  
  // Category colors to distinguish different log categories
  private categoryColors = {
    [LogCategory.SYSTEM]: '#E91E63', // Pink
    [LogCategory.MAP]: '#00BCD4', // Cyan
    [LogCategory.GAME]: '#CDDC39', // Lime
    [LogCategory.NETWORK]: '#9E9E9E', // Grey
    [LogCategory.INPUT]: '#795548', // Brown
    [LogCategory.RENDERING]: '#607D8B', // Blue Grey
    [LogCategory.UI]: '#FFC107', // Amber
    [LogCategory.PERFORMANCE]: '#FF5722', // Deep Orange
    [LogCategory.DATABASE]: '#8BC34A', // Light Green
    [LogCategory.AUTH]: '#673AB7', // Deep Purple
    [LogCategory.PLAYER]: '#3F51B5', // Indigo
    [LogCategory.MONSTER]: '#4CAF50', // Green
    [LogCategory.DUNGEON]: '#2196F3', // Blue
    [LogCategory.ITEM]: '#FF9800', // Orange
    [LogCategory.EQUIPMENT]: '#F44336', // Red
    [LogCategory.CRAFTING]: '#9C27B0', // Purple
    [LogCategory.INVENTORY]: '#FF4081', // Pink A200
    [LogCategory.CHAT]: '#64FFDA', // Teal A200
  };
  
  constructor() {
    // Create main panel
    this.panel = new Panel({
      title: 'Debug Logger',
      width: '700px',
      height: '600px',
      draggable: true,
      closable: true,
      zIndex: 1000,
      onClose: () => {
        this.hide();
      }
    });
    
    // Create log container
    this.logContainer = document.createElement('div');
    this.logContainer.className = 'game-log-container';
    this.logContainer.style.height = '300px';
    this.logContainer.style.maxHeight = '300px';
    this.logContainer.style.overflowY = 'auto';
    this.logContainer.style.overflowX = 'hidden';
    this.logContainer.style.marginBottom = '10px';
    this.logContainer.style.fontFamily = 'monospace, Consolas, "Courier New", monospace';
    this.logContainer.style.fontSize = '13px';
    this.logContainer.style.padding = '8px';
    this.logContainer.style.backgroundColor = '#1e1e1e';
    this.logContainer.style.borderRadius = '4px';
    this.logContainer.style.border = '1px solid #333';
    
    // Add log container to panel
    this.panel.addContent(this.logContainer);
    
    // Create filter controls
    this.createFilterControls();
    
    // Create controls container for level and category toggles
    const controlsContainer = document.createElement('div');
    controlsContainer.style.display = 'flex';
    controlsContainer.style.gap = '20px';
    controlsContainer.style.margin = '10px 0';
    
    // Create level toggles container
    const levelContainer = document.createElement('div');
    levelContainer.style.flex = '1';
    controlsContainer.appendChild(levelContainer);
    
    // Create category toggles container
    const categoryContainer = document.createElement('div');
    categoryContainer.style.flex = '2';
    controlsContainer.appendChild(categoryContainer);
    
    // Add controls container to panel
    this.panel.addContent(controlsContainer);
    
    // Create level toggles
    this.createLevelToggles(levelContainer);
    
    // Create category toggles
    this.createCategoryToggles(categoryContainer);
    
    // Create action buttons (clear, etc.)
    this.createActionButtons();
    
    // Subscribe to logger
    this.unsubscribe = logger.subscribe(this.onNewLog.bind(this));
    
    // Initially hide the panel
    this.hide();
    
    // Load initial logs
    this.refreshLogs();
  }
  
  /**
   * Create search and filter controls
   */
  private createFilterControls(): void {
    const filterContainer = document.createElement('div');
    filterContainer.style.display = 'flex';
    filterContainer.style.alignItems = 'center';
    filterContainer.style.marginBottom = '10px';
    filterContainer.style.gap = '8px';
    
    // Create search icon
    const searchIcon = new Icon(Icon.Icons.SEARCH, {
      size: '20px',
      color: '#aaa'
    });
    filterContainer.appendChild(searchIcon.getElement());
    
    // Create filter input
    this.filterInput = document.createElement('input');
    this.filterInput.type = 'text';
    this.filterInput.placeholder = 'Filter logs...';
    this.filterInput.style.flex = '1';
    this.filterInput.style.padding = '8px 10px';
    this.filterInput.style.borderRadius = '4px';
    this.filterInput.style.border = '1px solid #333';
    this.filterInput.style.backgroundColor = '#2a2a2a';
    this.filterInput.style.color = '#f0f0f0';
    this.filterInput.style.fontSize = '13px';
    
    this.filterInput.addEventListener('input', () => {
      this.filterText = this.filterInput?.value || '';
      this.refreshLogs();
    });
    
    filterContainer.appendChild(this.filterInput);
    
    // Create autoscroll toggle
    this.autoscrollToggle = new Toggle({
      label: 'Auto-scroll',
      initialState: true,
      onChange: (checked: boolean) => {
        this.autoScroll = checked;
      }
    });
    
    filterContainer.appendChild(this.autoscrollToggle.getElement());
    
    // Add filter container to panel
    this.panel.addContent(filterContainer);
  }
  
  /**
   * Create log level toggle switches
   */
  private createLevelToggles(container: HTMLDivElement): void {
    // Create title
    const levelTitle = document.createElement('div');
    levelTitle.textContent = 'Log Levels:';
    levelTitle.style.marginBottom = '8px';
    levelTitle.style.fontWeight = 'bold';
    container.appendChild(levelTitle);
    
    // Create toggle container
    const toggleRow = document.createElement('div');
    toggleRow.style.display = 'flex';
    toggleRow.style.flexDirection = 'column';
    toggleRow.style.gap = '10px';
    container.appendChild(toggleRow);
    
    // Create a toggle for each log level
    const levels = Object.values(LogLevel);
    for (const level of levels) {
      // Apply color styling based on level
      const levelColor = this.levelColors[level] || '#f0f0f0';
      
      const toggle = new Toggle({
        label: level.charAt(0).toUpperCase() + level.slice(1),
        initialState: true,
        color: levelColor,
        onChange: (checked: boolean) => {
          // Determine the new minimum level
          if (checked) {
            // Add this level to enabled levels
            this.updateMinLogLevel();
          } else {
            // Remove this level from enabled levels
            this.updateMinLogLevel();
          }
        }
      });
      
      this.levelToggles.set(level, toggle);
      toggleRow.appendChild(toggle.getElement());
    }
  }
  
  /**
   * Update the minimum log level based on toggle states
   */
  private updateMinLogLevel(): void {
    const levels = Object.values(LogLevel);
    const enabledLevels = levels.filter(level => 
      this.levelToggles.get(level)?.isChecked()
    );
    
    // Find the lowest enabled level
    if (enabledLevels.length > 0) {
      // Sort by level index (debug is lowest, fatal is highest)
      const levelIndices = enabledLevels.map(level => levels.indexOf(level));
      const minLevelIndex = Math.min(...levelIndices);
      const minLevel = levels[minLevelIndex];
      
      // Update logger config
      logger.setConfig({ minLevel });
    }
    
    // Refresh logs to apply filter
    this.refreshLogs();
  }
  
  /**
   * Create category toggle switches
   */
  private createCategoryToggles(container: HTMLDivElement): void {
    // Create title
    const categoryTitle = document.createElement('div');
    categoryTitle.textContent = 'Categories:';
    categoryTitle.style.marginBottom = '8px';
    categoryTitle.style.fontWeight = 'bold';
    container.appendChild(categoryTitle);
    
    // Create toggle container with flexbox wrapping
    const toggleGrid = document.createElement('div');
    toggleGrid.style.display = 'grid';
    toggleGrid.style.gridTemplateColumns = 'repeat(3, 1fr)';
    toggleGrid.style.gap = '10px';
    container.appendChild(toggleGrid);
    
    // Create a toggle for each category
    const categories = Object.values(LogCategory);
    for (const category of categories) {
      // Add category color styling
      const categoryColor = this.categoryColors[category as LogCategory] || '#f0f0f0';
      
      const toggle = new Toggle({
        label: category,
        initialState: true,
        color: categoryColor,
        onChange: (checked: boolean) => {
          // Get current config
          const config = logger.getConfig();
          
          // Update enabled categories
          if (checked) {
            config.enabledCategories.add(category);
          } else {
            config.enabledCategories.delete(category);
          }
          
          // Update logger config
          logger.setConfig({ enabledCategories: config.enabledCategories });
          
          // Refresh logs to apply filter
          this.refreshLogs();
        }
      });
      
      this.toggles.set(category, toggle);
      toggleGrid.appendChild(toggle.getElement());
    }
  }
  
  /**
   * Create action buttons (clear logs, etc.)
   */
  private createActionButtons(): void {
    // Create footer
    const footer = this.panel.addFooter();
    
    // Create log count display
    const logCountElement = document.createElement('div');
    logCountElement.style.flex = '1';
    logCountElement.style.color = '#aaa';
    logCountElement.style.fontSize = '12px';
    logCountElement.textContent = '0 logs';
    footer.appendChild(logCountElement);
    
    // Update log count when logs change
    const updateLogCount = () => {
      logCountElement.textContent = `${this.logCount} logs`;
    };
    
    // Subscribe to log changes to update count
    logger.subscribe(() => {
      this.logCount = logger.getLogHistory().length;
      updateLogCount();
    });
    
    // Create clear button
    this.clearButton = new Button('Clear Logs', { 
      onClick: () => {
        logger.clearLogs();
        this.logContainer.innerHTML = '';
        this.logEntries.clear();
        this.logCount = 0;
        updateLogCount();
      }
    });
    
    footer.appendChild(this.clearButton.getElement());
  }
  
  /**
   * Handle new log messages
   */
  private onNewLog(message: LogMessage): void {
    if (this.visible) {
      this.addLogToDisplay(message);
      
      // Auto scroll to bottom if enabled
      if (this.autoScroll) {
        this.scrollToBottom();
      }
    }
  }
  
  /**
   * Add a single log message to the display
   */
  private addLogToDisplay(message: LogMessage): void {
    // Create a unique ID for this log message
    const logId = `log-${message.timestamp}`;
    
    // Skip if this log is already displayed
    if (this.logEntries.has(logId)) {
      return;
    }
    
    // Check if this log should be filtered out
    if (!this.shouldShowLog(message)) {
      return;
    }
    
    // Create log entry element
    const logEntry = document.createElement('div');
    logEntry.className = 'game-log-entry';
    logEntry.style.marginBottom = '4px';
    logEntry.style.paddingBottom = '4px';
    logEntry.style.borderBottom = '1px solid #333';
    
    // Format timestamp
    const timestamp = new Date(message.timestamp).toLocaleTimeString();
    
    // Create colored spans for different parts of the log
    const timestampSpan = document.createElement('span');
    timestampSpan.textContent = `[${timestamp}]`;
    timestampSpan.style.color = '#aaaaaa';
    
    const levelSpan = document.createElement('span');
    levelSpan.textContent = ` [${message.level}]`;
    levelSpan.style.color = this.levelColors[message.level] || '#f0f0f0';
    
    const categorySpan = document.createElement('span');
    categorySpan.textContent = ` [${message.category}]:`;
    categorySpan.style.color = this.categoryColors[message.category as LogCategory] || '#f0f0f0';
    
    const messageSpan = document.createElement('span');
    messageSpan.textContent = ` ${message.message}`;
    messageSpan.style.color = '#f0f0f0';
    
    // Add all spans to the log entry
    logEntry.appendChild(timestampSpan);
    logEntry.appendChild(levelSpan);
    logEntry.appendChild(categorySpan);
    logEntry.appendChild(messageSpan);
    
    // Add to the container
    this.logContainer.appendChild(logEntry);
    
    // Store reference to this log entry
    this.logEntries.set(logId, logEntry);
  }
  
  /**
   * Determine if a log should be displayed based on current filters
   */
  private shouldShowLog(message: LogMessage): boolean {
    // Check if level is enabled
    const levelToggle = this.levelToggles.get(message.level);
    if (!levelToggle || !levelToggle.isChecked()) {
      return false;
    }
    
    // Check if category is enabled
    const categoryToggle = this.toggles.get(message.category);
    if (!categoryToggle || !categoryToggle.isChecked()) {
      return false;
    }
    
    // Check text filter
    if (this.filterText && !this.matchesFilter(message)) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Check if a log message matches the current text filter
   */
  private matchesFilter(message: LogMessage): boolean {
    if (!this.filterText) {
      return true;
    }
    
    const filterLower = this.filterText.toLowerCase();
    const textToSearch = [
      message.message,
      message.category,
      message.level,
      message.source
    ].join(' ').toLowerCase();
    
    return textToSearch.includes(filterLower);
  }
  
  /**
   * Refresh all displayed logs
   */
  private refreshLogs(): void {
    // Clear current logs
    this.logContainer.innerHTML = '';
    this.logEntries.clear();
    
    // Get all logs from logger
    const logs = logger.getLogHistory();
    
    // Add logs that match current filters
    for (const log of logs) {
      this.addLogToDisplay(log);
    }
    
    // Update log count
    this.logCount = logs.length;
    
    // Auto scroll if enabled
    if (this.autoScroll) {
      this.scrollToBottom();
    }
  }
  
  /**
   * Scroll to the bottom of the log container
   */
  private scrollToBottom(): void {
    this.logContainer.scrollTop = this.logContainer.scrollHeight;
  }
  
  /**
   * Show the logger panel
   */
  public show(): void {
    this.panel.show();
    this.visible = true;
    this.refreshLogs();
  }
  
  /**
   * Hide the logger panel
   */
  public hide(): void {
    this.panel.hide();
    this.visible = false;
  }
  
  /**
   * Toggle panel visibility
   */
  public toggle(): void {
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
  }
  
  /**
   * Clean up resources
   */
  public destroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    
    this.panel.destroy();
    
    // Clean up toggles
    for (const toggle of this.toggles.values()) {
      toggle.destroy();
    }
    this.toggles.clear();
    
    for (const toggle of this.levelToggles.values()) {
      toggle.destroy();
    }
    this.levelToggles.clear();
    
    // Clean up buttons
    if (this.clearButton) {
      this.clearButton.destroy();
    }
    
    if (this.autoscrollToggle) {
      this.autoscrollToggle.destroy();
    }
  }
} 