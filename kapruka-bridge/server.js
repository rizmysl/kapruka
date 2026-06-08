require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');

// 1. Swap SSE for the new Streamable HTTP Transport
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');

const app = express();
app.use(express.json());
app.use(cors());

let mcpClient = null;

async function connectToKapruka() {
    try {
        console.log('Attempting to connect to Kapruka MCP via Streamable HTTP...');
        
        // 2. Initialize the Streamable HTTP transport
        const mcpUrl = process.env.MCP_SERVER_URL || 'https://mcp.kapruka.com/mcp';
        const transport = new StreamableHTTPClientTransport(
            new URL(mcpUrl)
        );
        
        mcpClient = new Client(
            { name: 'kapruka-hackathon-bridge', version: '1.0.0' }, 
            { capabilities: {} }
        );
        
        await mcpClient.connect(transport);
        console.log('✅ Successfully connected to Kapruka MCP stream!');
    } catch (error) {
        console.error('❌ Failed to connect to Kapruka:', error.message);
        setTimeout(connectToKapruka, 5000);
    }
}

// The endpoint Laravel will call
app.post('/call-tool', async (req, res) => {
    if (!mcpClient) {
        return res.status(503).json({ error: 'MCP Client is not connected yet.' });
    }

    try {
        const { toolName, args } = req.body;
        console.log(`[Executing Tool]: ${toolName}`, args);
        
        const result = await mcpClient.callTool({ 
            name: toolName, 
            arguments: args || {} 
        });
        
        res.json(result);
    } catch (error) {
        console.error(`[Tool Error] ${req.body.toolName}:`, error.message);
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, async () => {
    console.log(`🚀 Bridge running on http://localhost:${PORT}`);
    await connectToKapruka();
});