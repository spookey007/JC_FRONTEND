// Chat Sound Notification Service
// Handles audio notifications for chat messages - separate from global audio system

export interface ChatNotificationData {
  messageId: string;
  channelId: string;
  authorId: string;
  authorName: string;
  content: string;
  timestamp: string;
}

class NotificationService {
  private static instance: NotificationService;
  private messageSound: HTMLAudioElement | null = null;
  private lastNotificationTime: number = 0;
  private notificationCooldown: number = 1000; // 1 second cooldown between sounds
  private chatSoundsEnabled: boolean = true; // Independent chat sound toggle

  private constructor() {
    // Only initialize on client side
    if (typeof window !== 'undefined') {
      this.initializeAudio();
      this.loadSettings();
    }
  }

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  private async initializeAudio(): Promise<void> {
    // Only initialize on client side
    if (typeof window === 'undefined') {
      return;
    }

    try {
      // Load message sound
      this.messageSound = new Audio('/web_sounds/message_received.wav');
      this.messageSound.preload = 'auto';
      this.messageSound.volume = 0.7;
      
      console.log('🔊 [CHAT_SOUND] Audio initialized');
    } catch (error) {
      console.warn('🔊 [CHAT_SOUND] Audio initialization failed:', error);
    }
  }

  private loadSettings(): void {
    // Only load on client side
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const saved = localStorage.getItem('chatSoundsEnabled');
      if (saved !== null) {
        this.chatSoundsEnabled = JSON.parse(saved);
        console.log('🔊 [CHAT_SOUND] Loaded settings:', this.chatSoundsEnabled ? 'enabled' : 'disabled');
      }
    } catch (error) {
      console.warn('🔊 [CHAT_SOUND] Failed to load settings:', error);
    }
  }

  private saveSettings(): void {
    // Only save on client side
    if (typeof window === 'undefined') {
      return;
    }

    try {
      localStorage.setItem('chatSoundsEnabled', JSON.stringify(this.chatSoundsEnabled));
      console.log('🔊 [CHAT_SOUND] Settings saved:', this.chatSoundsEnabled ? 'enabled' : 'disabled');
    } catch (error) {
      console.warn('🔊 [CHAT_SOUND] Failed to save settings:', error);
    }
  }

  public setEnabled(enabled: boolean): void {
    this.chatSoundsEnabled = enabled;
    this.saveSettings();
    console.log('🔊 [CHAT_SOUND] Chat sounds', enabled ? 'enabled' : 'disabled');
  }

  public isEnabled(): boolean {
    return this.chatSoundsEnabled;
  }

  public async playMessageSound(): Promise<void> {
    // Only play on client side
    if (typeof window === 'undefined') {
      return;
    }

    if (!this.chatSoundsEnabled || !this.messageSound) return;

    // Check cooldown to prevent spam
    const now = Date.now();
    if (now - this.lastNotificationTime < this.notificationCooldown) {
      console.log('🔊 [CHAT_SOUND] Sound cooldown active, skipping');
      return;
    }

    try {
      // Reset audio to beginning and play
      this.messageSound.currentTime = 0;
      await this.messageSound.play();
      this.lastNotificationTime = now;
      console.log('🔊 [CHAT_SOUND] Message sound played');
    } catch (error) {
      console.warn('🔊 [CHAT_SOUND] Sound playback failed:', error);
    }
  }

  public async showChatNotification(data: ChatNotificationData): Promise<void> {
    // Only show on client side
    if (typeof window === 'undefined') {
      return;
    }

    if (!this.chatSoundsEnabled) return;

    // Play sound for new messages
    await this.playMessageSound();
  }
}

// Export singleton instance
export const notificationService = NotificationService.getInstance();

// React hook for easy integration
export const useNotifications = () => {
  return {
    showChatNotification: (data: ChatNotificationData) => notificationService.showChatNotification(data),
    playMessageSound: () => notificationService.playMessageSound(),
    setEnabled: (enabled: boolean) => notificationService.setEnabled(enabled),
    isEnabled: () => notificationService.isEnabled()
  };
};
