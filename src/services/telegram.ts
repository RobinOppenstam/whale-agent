import TelegramBot from 'node-telegram-bot-api';

export interface TelegramCommandHandler {
  analyzeToken(tokenSymbolOrAddress: string): Promise<any>;
  getStatus(): any;
  getPortfolio(): Promise<any>;
  triggerAnalysis(): Promise<any>;
  addToken(address: string, symbol: string): any;
  removeToken(symbolOrAddress: string): any;
}

export class TelegramService {
  private bot: TelegramBot;
  private chatId: string;
  private commandHandler?: TelegramCommandHandler;

  constructor(botToken: string, chatId: string) {
    this.bot = new TelegramBot(botToken, { polling: true });
    this.chatId = chatId;
  }

  /**
   * Initialize bot commands and set up command handler
   */
  async initialize(handler: TelegramCommandHandler): Promise<void> {
    this.commandHandler = handler;

    // Set bot commands for Telegram UI
    await this.bot.setMyCommands([
      { command: 'start', description: 'Start the bot and see welcome message' },
      { command: 'help', description: 'Show available commands' },
      { command: 'status', description: 'Get current status of tracked tokens' },
      { command: 'portfolio', description: 'Get portfolio dashboard for all tokens' },
      { command: 'analyze', description: 'Analyze a specific token (e.g., /analyze WIRE)' },
      { command: 'trigger', description: 'Trigger immediate analysis for all tokens' },
      { command: 'add', description: 'Add a token to track (e.g., /add 0x123... SYMBOL)' },
      { command: 'remove', description: 'Remove a token from tracking (e.g., /remove WIRE)' }
    ]);

    // Set up message handlers
    this.setupCommandHandlers();

    console.log('✅ Telegram bot commands initialized');
  }

  /**
   * Set up command handlers
   */
  private setupCommandHandlers(): void {
    // /start command
    this.bot.onText(/\/start/, async (msg) => {
      if (msg.chat.id.toString() !== this.chatId) return;

      const welcomeMessage = `
🐋 <b>Whale Agent - G.A.M.E Protocol</b>

Welcome! I'm your AI whale tracking agent for Base network tokens.

<b>Available Commands:</b>
/status - View tracked tokens and next run time
/portfolio - Get portfolio dashboard for all tokens
/analyze SYMBOL - Analyze a specific token
/trigger - Run analysis for all tokens now
/add ADDRESS SYMBOL - Track a new token
/remove SYMBOL - Stop tracking a token
/help - Show this help message

<b>Features:</b>
📊 Real-time price & volume tracking
🐋 Top 50 holder concentration analysis
💸 Whale transaction monitoring
⚠️ Risk assessment & signals
📈 Accumulation/distribution detection

Reports are sent automatically every 6 hours!
`;
      await this.bot.sendMessage(msg.chat.id, welcomeMessage, { parse_mode: 'HTML' });
    });

    // /help command
    this.bot.onText(/\/help/, async (msg) => {
      if (msg.chat.id.toString() !== this.chatId) return;

      const helpMessage = `
<b>🤖 Whale Agent Commands</b>

<b>Queries:</b>
/status - Show agent status and tracked tokens
/portfolio - Get multi-token dashboard with opportunities & risks
/analyze &lt;token&gt; - Get detailed analysis for a token
  Example: <code>/analyze WIRE</code>

<b>Actions:</b>
/trigger - Manually trigger analysis for all tokens
/add &lt;address&gt; &lt;symbol&gt; - Add new token to track
  Example: <code>/add 0x123...abc TOKEN</code>
/remove &lt;token&gt; - Remove token from tracking
  Example: <code>/remove WIRE</code>

<b>Data Sources:</b>
• Blockscout - Holder data & whale transactions
• DexScreener - Price, volume & trading metrics

<b>Schedule:</b>
Automatic analysis runs every 6 hours at :00
`;
      await this.bot.sendMessage(msg.chat.id, helpMessage, { parse_mode: 'HTML' });
    });

    // /status command
    this.bot.onText(/\/status/, async (msg) => {
      if (msg.chat.id.toString() !== this.chatId) return;

      try {
        if (!this.commandHandler) {
          await this.bot.sendMessage(msg.chat.id, '❌ Command handler not initialized');
          return;
        }

        const status = this.commandHandler.getStatus();
        const statusMessage = `
<b>🤖 Whale Agent Status</b>

<b>Status:</b> ${status.active ? '✅ Active' : '⏸️ Inactive'}
<b>Next Run:</b> ${status.nextScheduledRun}
<b>Schedule:</b> ${status.schedule}

<b>Tracked Tokens:</b>
${status.trackedTokens.map((t: any) => `• ${t.symbol} - <code>${t.address.substring(0, 10)}...</code>`).join('\n')}
`;
        await this.bot.sendMessage(msg.chat.id, statusMessage, { parse_mode: 'HTML' });
      } catch (error: any) {
        await this.bot.sendMessage(msg.chat.id, `❌ Error: ${error.message}`);
      }
    });

    // /portfolio command
    this.bot.onText(/\/portfolio/, async (msg) => {
      if (msg.chat.id.toString() !== this.chatId) return;

      try {
        if (!this.commandHandler) {
          await this.bot.sendMessage(msg.chat.id, '❌ Command handler not initialized');
          return;
        }

        await this.bot.sendMessage(msg.chat.id, '📊 Generating portfolio dashboard... This may take a few minutes.');

        const result = await this.commandHandler.getPortfolio();

        if (result.error) {
          await this.bot.sendMessage(msg.chat.id, `❌ ${result.error}`);
        } else {
          // Send the portfolio dashboard
          await this.sendReport(result.markdown, 'Portfolio');
          await this.bot.sendMessage(
            msg.chat.id,
            `✅ Portfolio dashboard generated successfully!\nAnalyzed ${result.tokensAnalyzed}/${result.totalTokens} tokens`
          );
        }
      } catch (error: any) {
        await this.bot.sendMessage(msg.chat.id, `❌ Error: ${error.message}`);
      }
    });

    // /analyze command
    this.bot.onText(/\/analyze(?:\s+(\S+))?/, async (msg, match) => {
      if (msg.chat.id.toString() !== this.chatId) return;

      const tokenSymbol = match?.[1];
      if (!tokenSymbol) {
        await this.bot.sendMessage(
          msg.chat.id,
          '❌ Please provide a token symbol or address\nExample: <code>/analyze WIRE</code>',
          { parse_mode: 'HTML' }
        );
        return;
      }

      try {
        if (!this.commandHandler) {
          await this.bot.sendMessage(msg.chat.id, '❌ Command handler not initialized');
          return;
        }

        await this.bot.sendMessage(msg.chat.id, `🔍 Analyzing ${tokenSymbol}... This may take a minute.`);

        const result = await this.commandHandler.analyzeToken(tokenSymbol);

        if (result.error) {
          await this.bot.sendMessage(msg.chat.id, `❌ ${result.error}\n\nTracked tokens: ${result.trackedTokens?.join(', ')}`);
        } else {
          // Send the markdown report
          await this.sendReport(result.markdown, result.token);
        }
      } catch (error: any) {
        await this.bot.sendMessage(msg.chat.id, `❌ Error: ${error.message}`);
      }
    });

    // /trigger command
    this.bot.onText(/\/trigger/, async (msg) => {
      if (msg.chat.id.toString() !== this.chatId) return;

      try {
        if (!this.commandHandler) {
          await this.bot.sendMessage(msg.chat.id, '❌ Command handler not initialized');
          return;
        }

        await this.bot.sendMessage(msg.chat.id, '⚡ Triggering analysis for all tracked tokens...');

        const result = await this.commandHandler.triggerAnalysis();

        await this.bot.sendMessage(
          msg.chat.id,
          `✅ ${result.message}\n\nTokens: ${result.tokens.join(', ')}`
        );
      } catch (error: any) {
        await this.bot.sendMessage(msg.chat.id, `❌ Error: ${error.message}`);
      }
    });

    // /add command
    this.bot.onText(/\/add(?:\s+(\S+))?(?:\s+(\S+))?/, async (msg, match) => {
      if (msg.chat.id.toString() !== this.chatId) return;

      const address = match?.[1];
      const symbol = match?.[2];

      if (!address || !symbol) {
        await this.bot.sendMessage(
          msg.chat.id,
          '❌ Please provide both address and symbol\nExample: <code>/add 0x123...abc TOKEN</code>',
          { parse_mode: 'HTML' }
        );
        return;
      }

      try {
        if (!this.commandHandler) {
          await this.bot.sendMessage(msg.chat.id, '❌ Command handler not initialized');
          return;
        }

        const result = this.commandHandler.addToken(address, symbol);

        await this.bot.sendMessage(
          msg.chat.id,
          `✅ ${result.message}\n\nTracked tokens: ${result.trackedTokens.join(', ')}`
        );
      } catch (error: any) {
        await this.bot.sendMessage(msg.chat.id, `❌ Error: ${error.message}`);
      }
    });

    // /remove command
    this.bot.onText(/\/remove(?:\s+(\S+))?/, async (msg, match) => {
      if (msg.chat.id.toString() !== this.chatId) return;

      const symbolOrAddress = match?.[1];

      if (!symbolOrAddress) {
        await this.bot.sendMessage(
          msg.chat.id,
          '❌ Please provide a token symbol or address\nExample: <code>/remove WIRE</code>',
          { parse_mode: 'HTML' }
        );
        return;
      }

      try {
        if (!this.commandHandler) {
          await this.bot.sendMessage(msg.chat.id, '❌ Command handler not initialized');
          return;
        }

        const result = this.commandHandler.removeToken(symbolOrAddress);

        await this.bot.sendMessage(
          msg.chat.id,
          `✅ ${result.message}\n\nTracked tokens: ${result.trackedTokens.join(', ')}`
        );
      } catch (error: any) {
        await this.bot.sendMessage(msg.chat.id, `❌ Error: ${error.message}`);
      }
    });

    // Handle polling errors
    this.bot.on('polling_error', (error) => {
      console.error('Telegram polling error:', error);
    });
  }

  /**
   * Stop the bot polling
   */
  stopPolling(): void {
    this.bot.stopPolling();
    console.log('🛑 Telegram bot polling stopped');
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
    // Step 1: Escape HTML special characters first (before creating HTML tags)
    let html = markdown
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Step 2: Convert markdown to HTML (these will use the escaped text)
    // Convert headers (working with escaped content)
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
