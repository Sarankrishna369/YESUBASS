import { Client, Collection, GatewayIntentBits } from 'discord.js';
import { LavalinkManager } from '../player/LavalinkManager';
import { YesubassPlayer } from '../player/PlayerManager';
import { config } from '../config/config';
import { startApiServer } from './server';
import fs from 'fs';
import path from 'path';

import { logger } from './logger';

import { Mutex } from './Mutex';
import { CooldownManager } from './CooldownManager';

export class YesubassClient extends Client {
    public commands: Collection<string, any> = new Collection();
    public buttons: Collection<string, any> = new Collection();
    public lavalink!: LavalinkManager;
    public players: Collection<string, YesubassPlayer> = new Collection();
    public joinLocks = new Map<string, Mutex>();
    public cooldowns = new CooldownManager();

    constructor() {
        super({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildVoiceStates,
                GatewayIntentBits.GuildMessages,
            ],
        });
    }

    public async start() {
        console.log(`\x1b[36m
 __  __           _         _             
 \\ \\/ /___  __  _| |__  ___| |__   __ _   
  \\  // _ \\/ / / / '_ \\/ _ \\ '_ \\ / _\` |  
  /  \\  __/ (_/ /| |_) |  __/ |_) | (_| |  
 /_/\\_\\___|\\__,_||_.__/ \\___|_.__/ \\__,_|  
                                          
 YESUBASS V2 - Production Ready
\x1b[0m`);

        logger.info('Starting YESUBASS V2 Boot Sequence...');
        
        // Start API Server
        startApiServer(this);

        // Init Lavalink (Shoukaku)
        this.lavalink = new LavalinkManager(this);

        // Load Handlers
        logger.info('Loading modules (Events, Commands, Buttons, Plugins)...');
        await this.loadEvents();
        await this.loadCommands();
        await this.loadButtons();
        await this.loadPlugins();
        
        logger.info(`Successfully loaded ${this.eventsCount} events, ${this.commands.size} commands, and ${this.buttons.size} buttons.`);

        // Login
        logger.info('Connecting to Discord Gateway...');
        await this.login(config.bot.token);
    }

    private async loadPlugins() {
        const pluginsPath = path.join(__dirname, '..', 'plugins');
        if (!fs.existsSync(pluginsPath)) {
            fs.mkdirSync(pluginsPath, { recursive: true });
        }
        const files = fs.readdirSync(pluginsPath).filter(f => f.endsWith('.ts') || f.endsWith('.js'));
        for (const file of files) {
            const pluginPath = path.join(pluginsPath, file);
            const plugin = require(pluginPath).default;
            if (typeof plugin === 'function') {
                plugin(this);
                logger.info(`Loaded plugin: ${file}`);
            }
        }
    }

    public eventsCount: number = 0;

    private async loadEvents() {
        const eventsPath = path.join(__dirname, '..', 'events');
        if (fs.existsSync(eventsPath)) {
            const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'));
            for (const file of eventFiles) {
                const eventPath = path.join(eventsPath, file);
                const event = require(eventPath).default;
                if (event.once) {
                    this.once(event.name, (...args) => event.execute(...args, this));
                } else {
                    this.on(event.name, (...args) => event.execute(...args, this));
                }
                this.eventsCount++;
            }
        }
    }

    private async loadCommands() {
        const commandsPath = path.join(__dirname, '..', 'commands');
        if (fs.existsSync(commandsPath)) {
            const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'));
            for (const file of commandFiles) {
                const cmdPath = path.join(commandsPath, file);
                const command = require(cmdPath).default;
                this.commands.set(command.data.name, command);
            }
        }
    }

    private async loadButtons() {
        const buttonsPath = path.join(__dirname, '..', 'buttons');
        if (fs.existsSync(buttonsPath)) {
            const buttonFiles = fs.readdirSync(buttonsPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'));
            for (const file of buttonFiles) {
                const btnPath = path.join(buttonsPath, file);
                const button = require(btnPath).default;
                this.buttons.set(button.customId, button);
            }
        }
    }
}
