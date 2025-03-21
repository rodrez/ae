import Phaser from 'phaser';
import { logger, LogLevel, LogCategory } from '../../utils/logger';
import type { LogMessage } from '../../../../shared/types';

/**
 * UI component for displaying and filtering logs
 */
export class LoggerPanel extends Phaser.GameObjects.Container {
  private static readonly PANEL_WIDTH = 500;
  private static readonly PANEL_HEIGHT = 400;
  private static readonly PADDING = 10;
  private static readonly LINE_HEIGHT = 20;
  private static readonly MAX_VISIBLE_LOGS = 15;

  private background: Phaser.GameObjects.Rectangle;
  private titleText: Phaser.GameObjects.Text;
  private logTexts: Phaser.GameObjects.Text[] = [];
  private scrollBar: Phaser.GameObjects.Rectangle;
  private scrollThumb: Phaser.GameObjects.Rectangle;
  private categoryFilters: Map<string, { button: Phaser.GameObjects.Rectangle, text: Phaser.GameObjects.Text, enabled: boolean }> = new Map();
  private levelFilters: Map<LogLevel, { button: Phaser.GameObjects.Rectangle, text: Phaser.GameObjects.Text, enabled: boolean }> = new Map();
  private clearButton: Phaser.GameObjects.Rectangle;
  private clearText: Phaser.GameObjects.Text;
  private closeButton: Phaser.GameObjects.Rectangle;
  private closeText: Phaser.GameObjects.Text;
  
  private logs: LogMessage[] = [];
  private scrollPosition = 0;
  private isDragging = false;
  private isVisible = false;
  private unsubscribe: (() => void) | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    
    // Create container for all elements
    this.setupBackground();
    this.setupTitle();
    this.setupLogDisplay();
    this.setupScrollBar();
    this.setupCategoryFilters();
    this.setupLevelFilters();
    this.setupButtons();
    
    // Add to scene
    scene.add.existing(this);
    
    // Hide initially
    this.setVisible(false);
    
    // Subscribe to logger
    this.unsubscribe = logger.subscribe(this.onNewLog.bind(this));
    
    // Add interactivity
    this.setupInteractivity();
    
    // Load initial logs
    this.refreshLogs();
  }

  /**
   * Set up the panel background
   */
  private setupBackground(): void {
    this.background = this.scene.add.rectangle(
      0,
      0,
      LoggerPanel.PANEL_WIDTH,
      LoggerPanel.PANEL_HEIGHT,
      0x000000,
      0.8
    );
    this.background.setOrigin(0);
    this.background.setStrokeStyle(2, 0x444444);
    this.add(this.background);
  }

  /**
   * Set up the panel title
   */
  private setupTitle(): void {
    this.titleText = this.scene.add.text(
      LoggerPanel.PANEL_WIDTH / 2,
      LoggerPanel.PADDING,
      'Debug Logger',
      { 
        fontFamily: 'Arial', 
        fontSize: '18px',
        color: '#FFFFFF'
      }
    );
    this.titleText.setOrigin(0.5, 0);
    this.add(this.titleText);
  }

  /**
   * Set up the log display area
   */
  private setupLogDisplay(): void {
    const startY = 40;
    
    for (let i = 0; i < LoggerPanel.MAX_VISIBLE_LOGS; i++) {
      const logText = this.scene.add.text(
        LoggerPanel.PADDING,
        startY + (i * LoggerPanel.LINE_HEIGHT),
        '',
        { 
          fontFamily: 'monospace', 
          fontSize: '12px',
          color: '#FFFFFF',
          wordWrap: { width: LoggerPanel.PANEL_WIDTH - 40 }
        }
      );
      logText.setOrigin(0);
      this.add(logText);
      this.logTexts.push(logText);
    }
  }

  /**
   * Set up the scrollbar
   */
  private setupScrollBar(): void {
    const scrollBarX = LoggerPanel.PANEL_WIDTH - 20;
    const scrollBarY = 40;
    const scrollBarHeight = LoggerPanel.MAX_VISIBLE_LOGS * LoggerPanel.LINE_HEIGHT;

    // Scrollbar background
    this.scrollBar = this.scene.add.rectangle(
      scrollBarX,
      scrollBarY,
      10,
      scrollBarHeight,
      0x444444
    );
    this.scrollBar.setOrigin(0);
    this.add(this.scrollBar);

    // Scrollbar thumb
    this.scrollThumb = this.scene.add.rectangle(
      scrollBarX,
      scrollBarY,
      10,
      50,
      0x888888
    );
    this.scrollThumb.setOrigin(0);
    this.add(this.scrollThumb);
  }

  /**
   * Set up category filter buttons
   */
  private setupCategoryFilters(): void {
    const startY = 40 + (LoggerPanel.MAX_VISIBLE_LOGS * LoggerPanel.LINE_HEIGHT) + LoggerPanel.PADDING;
    const startX = LoggerPanel.PADDING;
    const buttonWidth = 80;
    const buttonHeight = 24;
    const padding = 5;
    
    // Title for categories
    const categoriesTitle = this.scene.add.text(
      startX,
      startY,
      'Categories:',
      { 
        fontFamily: 'Arial', 
        fontSize: '14px',
        color: '#FFFFFF'
      }
    );
    categoriesTitle.setOrigin(0);
    this.add(categoriesTitle);
    
    let x = startX;
    let y = startY + 24;
    let columnIndex = 0;
    
    // Create a filter button for each category
    const categories = Object.values(LogCategory);
    
    for (let i = 0; i < categories.length; i++) {
      const category = categories[i];
      if (columnIndex > 4) {
        columnIndex = 0;
        x = startX;
        y += buttonHeight + padding;
      } else if (i > 0) {
        x += buttonWidth + padding;
      }
      
      const button = this.scene.add.rectangle(
        x,
        y,
        buttonWidth,
        buttonHeight,
        0x007700
      );
      button.setOrigin(0);
      button.setInteractive({ useHandCursor: true });
      
      const text = this.scene.add.text(
        x + buttonWidth / 2,
        y + buttonHeight / 2,
        category,
        { 
          fontFamily: 'Arial', 
          fontSize: '12px',
          color: '#FFFFFF'
        }
      );
      text.setOrigin(0.5);
      
      this.categoryFilters.set(category, {
        button,
        text,
        enabled: true
      });
      
      this.add(button);
      this.add(text);
      
      columnIndex++;
    }
  }

  /**
   * Set up log level filter buttons
   */
  private setupLevelFilters(): void {
    const buttonY = 40 + (LoggerPanel.MAX_VISIBLE_LOGS * LoggerPanel.LINE_HEIGHT) + 100;
    const startX = LoggerPanel.PADDING;
    const buttonWidth = 80;
    const buttonHeight = 24;
    const padding = 5;
    
    // Title for levels
    const levelsTitle = this.scene.add.text(
      startX,
      buttonY - 24,
      'Log Levels:',
      { 
        fontFamily: 'Arial', 
        fontSize: '14px',
        color: '#FFFFFF'
      }
    );
    levelsTitle.setOrigin(0);
    this.add(levelsTitle);
    
    // Create color mapping for log levels
    const levelColors = {
      [LogLevel.DEBUG]: 0x007700,
      [LogLevel.INFO]: 0x0077FF,
      [LogLevel.WARN]: 0xFF7700,
      [LogLevel.ERROR]: 0xFF0000,
      [LogLevel.FATAL]: 0xFF00FF
    };
    
    // Create a filter button for each log level
    let x = startX;
    const levels = Object.values(LogLevel);
    
    for (let i = 0; i < levels.length; i++) {
      const level = levels[i];
      if (i > 0) {
        x += buttonWidth + padding;
      }
      
      const button = this.scene.add.rectangle(
        x,
        buttonY,
        buttonWidth,
        buttonHeight,
        levelColors[level] || 0x444444
      );
      button.setOrigin(0);
      button.setInteractive({ useHandCursor: true });
      
      const text = this.scene.add.text(
        x + buttonWidth / 2,
        buttonY + buttonHeight / 2,
        level,
        { 
          fontFamily: 'Arial', 
          fontSize: '12px',
          color: '#FFFFFF'
        }
      );
      text.setOrigin(0.5);
      
      this.levelFilters.set(level, {
        button,
        text,
        enabled: true
      });
      
      this.add(button);
      this.add(text);
    }
  }

  /**
   * Set up action buttons (clear, close)
   */
  private setupButtons(): void {
    const buttonY = LoggerPanel.PANEL_HEIGHT - 40;
    const buttonWidth = 100;
    const buttonHeight = 30;
    
    // Clear button
    this.clearButton = this.scene.add.rectangle(
      LoggerPanel.PADDING,
      buttonY,
      buttonWidth,
      buttonHeight,
      0x444444
    );
    this.clearButton.setOrigin(0);
    this.clearButton.setInteractive({ useHandCursor: true });
    
    this.clearText = this.scene.add.text(
      LoggerPanel.PADDING + buttonWidth / 2,
      buttonY + buttonHeight / 2,
      'Clear Logs',
      { 
        fontFamily: 'Arial', 
        fontSize: '14px',
        color: '#FFFFFF'
      }
    );
    this.clearText.setOrigin(0.5);
    
    // Close button
    this.closeButton = this.scene.add.rectangle(
      LoggerPanel.PANEL_WIDTH - LoggerPanel.PADDING - buttonWidth,
      buttonY,
      buttonWidth,
      buttonHeight,
      0x884444
    );
    this.closeButton.setOrigin(0);
    this.closeButton.setInteractive({ useHandCursor: true });
    
    this.closeText = this.scene.add.text(
      LoggerPanel.PANEL_WIDTH - LoggerPanel.PADDING - buttonWidth / 2,
      buttonY + buttonHeight / 2,
      'Close',
      { 
        fontFamily: 'Arial', 
        fontSize: '14px',
        color: '#FFFFFF'
      }
    );
    this.closeText.setOrigin(0.5);
    
    this.add(this.clearButton);
    this.add(this.clearText);
    this.add(this.closeButton);
    this.add(this.closeText);
  }

  /**
   * Set up interactivity for the UI components
   */
  private setupInteractivity(): void {
    // Scrollbar interactions
    this.scrollThumb.setInteractive({ draggable: true, useHandCursor: true });
    
    this.scrollThumb.on('drag', (pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
      const scrollBarBounds = this.scrollBar.getBounds();
      const thumbBounds = this.scrollThumb.getBounds();
      
      const minY = scrollBarBounds.y;
      const maxY = scrollBarBounds.y + scrollBarBounds.height - thumbBounds.height;
      
      let newY = Phaser.Math.Clamp(dragY, minY, maxY);
      this.scrollThumb.y = newY;
      
      // Calculate scroll position based on thumb position
      const scrollRange = this.logs.length - LoggerPanel.MAX_VISIBLE_LOGS;
      if (scrollRange > 0) {
        const scrollRatio = (newY - minY) / (maxY - minY);
        this.scrollPosition = Math.floor(scrollRatio * scrollRange);
        this.updateLogDisplay();
      }
    });
    
    // Category filter button interactions
    for (const [category, filter] of this.categoryFilters.entries()) {
      filter.button.on('pointerdown', () => {
        filter.enabled = !filter.enabled;
        filter.button.fillColor = filter.enabled ? 0x007700 : 0x770000;
        
        // Update enabled categories in logger
        const config = logger.getConfig();
        if (filter.enabled) {
          config.enabledCategories.add(category);
        } else {
          config.enabledCategories.delete(category);
        }
        logger.setConfig({ enabledCategories: config.enabledCategories });
        
        this.refreshLogs();
      });
    }
    
    // Level filter button interactions
    for (const [level, filter] of this.levelFilters.entries()) {
      filter.button.on('pointerdown', () => {
        filter.enabled = !filter.enabled;
        
        // Determine the new minimum level by finding the lowest enabled level
        const levels = Object.values(LogLevel);
        let newMinLevel = LogLevel.FATAL; // Highest level by default
        
        for (const [l, f] of this.levelFilters.entries()) {
          if (f.enabled && levels.indexOf(l) < levels.indexOf(newMinLevel)) {
            newMinLevel = l;
          }
        }
        
        // Disable all levels below the currently selected one
        for (const [l, f] of this.levelFilters.entries()) {
          const levelIndex = levels.indexOf(l);
          const minLevelIndex = levels.indexOf(newMinLevel);
          
          if (levelIndex < minLevelIndex) {
            f.enabled = false;
            f.button.fillAlpha = 0.3;
          } else {
            f.button.fillAlpha = f.enabled ? 1.0 : 0.3;
          }
        }
        
        // Update minimum level in logger
        logger.setConfig({ minLevel: newMinLevel });
        
        this.refreshLogs();
      });
    }
    
    // Clear button interaction
    this.clearButton.on('pointerdown', () => {
      logger.clearLogs();
      this.logs = [];
      this.scrollPosition = 0;
      this.updateScrollBar();
      this.updateLogDisplay();
    });
    
    // Close button interaction
    this.closeButton.on('pointerdown', () => {
      this.hide();
    });
    
    // Mouse wheel for scrolling
    this.scene.input.on('wheel', (pointer: Phaser.Input.Pointer, gameObjects: Phaser.GameObjects.GameObject[], deltaX: number, deltaY: number) => {
      if (this.isVisible && this.background.getBounds().contains(pointer.x, pointer.y)) {
        const scrollAmount = deltaY > 0 ? 1 : -1;
        this.scrollPosition = Phaser.Math.Clamp(
          this.scrollPosition + scrollAmount,
          0,
          Math.max(0, this.logs.length - LoggerPanel.MAX_VISIBLE_LOGS)
        );
        this.updateScrollBar();
        this.updateLogDisplay();
      }
    });
  }

  /**
   * Show the logger panel
   */
  public show(): void {
    this.setVisible(true);
    this.isVisible = true;
    this.refreshLogs();
  }

  /**
   * Hide the logger panel
   */
  public hide(): void {
    this.setVisible(false);
    this.isVisible = false;
  }

  /**
   * Toggle the visibility of the logger panel
   */
  public toggle(): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Handle new log messages from the logger
   */
  private onNewLog(message: LogMessage): void {
    if (this.isVisible) {
      this.refreshLogs();
    }
  }

  /**
   * Refresh the entire log display
   */
  private refreshLogs(): void {
    this.logs = logger.getLogHistory();
    this.updateScrollBar();
    this.updateLogDisplay();
  }

  /**
   * Update the scrollbar position and size based on log count
   */
  private updateScrollBar(): void {
    const scrollBarBounds = this.scrollBar.getBounds();
    
    if (this.logs.length <= LoggerPanel.MAX_VISIBLE_LOGS) {
      // No scrolling needed
      this.scrollPosition = 0;
      this.scrollThumb.displayHeight = scrollBarBounds.height;
      this.scrollThumb.y = scrollBarBounds.y;
      this.scrollThumb.visible = false;
    } else {
      // Calculate thumb size and position
      const ratio = LoggerPanel.MAX_VISIBLE_LOGS / this.logs.length;
      const thumbHeight = Math.max(20, ratio * scrollBarBounds.height);
      this.scrollThumb.displayHeight = thumbHeight;
      
      // Calculate position based on scroll position
      const scrollRange = this.logs.length - LoggerPanel.MAX_VISIBLE_LOGS;
      const scrollRatio = this.scrollPosition / scrollRange;
      this.scrollThumb.y = scrollBarBounds.y + scrollRatio * (scrollBarBounds.height - thumbHeight);
      this.scrollThumb.visible = true;
    }
  }

  /**
   * Update the log display based on current scroll position
   */
  private updateLogDisplay(): void {
    // Create color mapping for log levels
    const levelColors = {
      [LogLevel.DEBUG]: '#00FF00',
      [LogLevel.INFO]: '#00AAFF',
      [LogLevel.WARN]: '#FFAA00',
      [LogLevel.ERROR]: '#FF0000',
      [LogLevel.FATAL]: '#FF00FF'
    };
    
    // Clear all text lines
    for (const text of this.logTexts) {
      text.setText('');
    }
    
    // Get visible logs based on scroll position
    const visibleLogs = this.logs.slice(
      this.scrollPosition,
      this.scrollPosition + LoggerPanel.MAX_VISIBLE_LOGS
    );
    
    // Update text lines with log content
    for (let i = 0; i < visibleLogs.length; i++) {
      const log = visibleLogs[i];
      const logText = this.logTexts[i];
      const color = levelColors[log.level] || '#FFFFFF';
      
      // Format timestamp
      const timestamp = new Date(log.timestamp).toLocaleTimeString();
      
      // Generate colored text
      logText.setText(`[${timestamp}] [${log.level}] [${log.category}]: ${log.message}`);
      logText.setColor(color);
    }
  }

  /**
   * Clean up resources when the panel is destroyed
   */
  public destroy(fromScene?: boolean): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    
    super.destroy(fromScene);
  }
} 