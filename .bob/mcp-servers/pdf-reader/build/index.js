#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PDFParse } from 'pdf-parse';
const server = new McpServer({ name: 'pdf-reader', version: '0.1.0' });
server.registerTool('read_pdf', {
    description: 'Read a PDF file and return its text content. ' +
        'Path may be absolute or relative to the workspace root.',
    inputSchema: z.object({
        path: z.string().describe('Path to the PDF file'),
    }),
}, async ({ path: filePath }) => {
    const abs = resolve(filePath);
    let buf;
    try {
        buf = await readFile(abs);
    }
    catch (err) {
        return {
            content: [{ type: 'text', text: `Could not read file: ${abs}\n${String(err)}` }],
            isError: true,
        };
    }
    let result;
    try {
        result = await new PDFParse({ data: buf }).getText();
    }
    catch (err) {
        return {
            content: [{ type: 'text', text: `PDF parse failed: ${String(err)}` }],
            isError: true,
        };
    }
    const text = result.text.trim();
    return {
        content: [
            {
                type: 'text',
                text: text.length > 0 ? text : '(No text content extracted from this PDF)',
            },
        ],
    };
});
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('pdf-reader MCP server running on stdio');
}
main().catch((err) => {
    console.error('Fatal:', err);
    process.exit(1);
});
