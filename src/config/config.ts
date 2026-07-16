import dotenv from 'dotenv';
dotenv.config();

const requiredEnvVars = ['TOKEN', 'CLIENT_ID', 'LAVALINK_HOST', 'LAVALINK_PASSWORD'];
const missingEnvVars = requiredEnvVars.filter(key => !process.env[key]);

if (missingEnvVars.length > 0) {
    console.error(`\x1b[31m[CRITICAL ERROR] Missing required environment variables: ${missingEnvVars.join(', ')}\x1b[0m`);
    console.error(`\x1b[31mPlease check your .env file before starting the bot.\x1b[0m`);
    process.exit(1);
}

export const config = {
    bot: {
        token: process.env.TOKEN!,
        clientId: process.env.CLIENT_ID!,
    },
    lavalink: [
        {
            name: 'Node 1',
            url: process.env.LAVALINK_HOST!,
            auth: process.env.LAVALINK_PASSWORD!,
            secure: process.env.LAVALINK_SECURE === 'true',
        }
    ],
    port: parseInt(process.env.PORT || '3000', 10)
};
