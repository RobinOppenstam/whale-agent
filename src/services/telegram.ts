import TelegramBot from 'node-telegram-bot-api';

export class TelegramService {
  private bot: TelegramBot;
  private chatId: string;
  
  constructor(botToken: string, chatId: string) {
    this.bot = new TelegramBot(botToken, { polling: false });
    this.chatId = chatId;
  }
  
  /**
   * Send report to personal chat
   */
  async sendReport(reportText: string, tokenSymbol: string): Promise<void> {
    try {
      // Convert markdown to Telegram HTML format
      const htmlReport = this.markdownToTelegramHtml(reportText);

      // Telegram has a 4096 character limit per message
      // Split long reports into multiple messages
      const chunks = this.splitMessage(htmlReport, 4000);

      for (let i = 0; i < chunks.length; i++) {
        await this.bot.sendMessage(
          this.chatId,
          chunks[i],
          {
            parse_mode: 'HTML',
            disable_web_page_preview: true
          }
        );

        // Small delay between messages to avoid rate limits
        if (i < chunks.length - 1) {
          await this.delay(500);
        }
      }

      console.log(`✅ Report sent to Telegram for ${tokenSymbol}`);
    } catch (error) {
      console.error('Error sending Telegram message:', error);
      throw error;
    }
  }

  /**
   * Convert markdown to Telegram HTML format
   */
  private markdownToTelegramHtml(markdown: string): string {
    let html = markdown;

    // Convert headers
    html = html.replace(/^### (.+)$/gm, '<b>$1</b>');
    html = html.replace(/^## (.+)$/gm, '\n<b><u>$1</u></b>');
    html = html.replace(/^# (.+)$/gm, '\n<b><u>🐋 $1</u></b>');

    // Convert bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');

    // Convert code/monospace
    html = html.replace(/`(.+?)`/g, '<code>$1</code>');

    // Convert horizontal rules to visual separator
    html = html.replace(/^---$/gm, '━━━━━━━━━━━━━━━━━━━━━━━');
    html = html.replace(/^=+$/gm, '━━━━━━━━━━━━━━━━━━━━━━━');

    // Escape HTML special characters that aren't part of our tags
    html = html.replace(/&(?!(amp|lt|gt|quot|#\d+);)/g, '&amp;');
    html = html.replace(/<(?!\/?[biu]>|\/?(code|pre)>)/g, '&lt;');
    html = html.replace(/(?<!<\/[biu])>(?!<)/g, '&gt;');

    return html;
  }
  
  /**
   * Send alert/notification
   */
  async sendAlert(message: string): Promise<void> {
    try {
      await this.bot.sendMessage(this.chatId, `🚨 <b>ALERT</b>\n\n${message}`, {
        parse_mode: 'HTML'
      });
    } catch (error) {
      console.error('Error sending Telegram alert:', error);
    }
  }
  
  /**
   * Send simple text message
   */
  async sendMessage(text: string): Promise<void> {
    try {
      await this.bot.sendMessage(this.chatId, text);
    } catch (error) {
      console.error('Error sending Telegram message:', error);
    }
  }
  
  /**
   * Test connection
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.bot.sendMessage(
        this.chatId,
        '✅ Whale Agent connected successfully!'
      );
      return true;
    } catch (error) {
      console.error('Telegram connection test failed:', error);
      return false;
    }
  }
  
  /**
   * Split message into chunks that fit Telegram's limit
   */
  private splitMessage(text: string, maxLength: number): string[] {
    const chunks: string[] = [];
    const lines = text.split('\n');
    let currentChunk = '';
    
    for (const line of lines) {
      if ((currentChunk + line + '\n').length > maxLength) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }
        
        // If a single line is too long, split it
        if (line.length > maxLength) {
          const words = line.split(' ');
          for (const word of words) {
            if ((currentChunk + word + ' ').length > maxLength) {
              chunks.push(currentChunk.trim());
              currentChunk = word + ' ';
            } else {
              currentChunk += word + ' ';
            }
          }
        } else {
          currentChunk = line + '\n';
        }
      } else {
        currentChunk += line + '\n';
      }
    }
    
    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
