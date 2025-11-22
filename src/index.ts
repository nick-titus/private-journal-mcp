#!/usr/bin/env node

// ABOUTME: Main entry point for the private journal MCP server
// ABOUTME: Handles command line arguments and starts the server

import { PrivateJournalServer } from './server.js';
import { resolveEntriesPath, detectProjectName } from './paths.js';

async function main(): Promise<void> {
  try {
    // Log environment info for debugging
    console.error('=== Private Journal MCP Server Debug Info ===');
    console.error(`Node.js version: ${process.version}`);
    console.error(`Platform: ${process.platform}`);
    console.error(`Architecture: ${process.arch}`);

    try {
      console.error(`Current working directory: ${process.cwd()}`);
    } catch (error) {
      console.error(`Failed to get current working directory: ${error}`);
    }

    console.error(`Environment variables:`);
    console.error(`  HOME: ${process.env.HOME || 'undefined'}`);
    console.error(`  USERPROFILE: ${process.env.USERPROFILE || 'undefined'}`);
    console.error(`  TEMP: ${process.env.TEMP || 'undefined'}`);
    console.error(`  TMP: ${process.env.TMP || 'undefined'}`);
    console.error(`  USER: ${process.env.USER || 'undefined'}`);
    console.error(`  USERNAME: ${process.env.USERNAME || 'undefined'}`);

    const entriesPath = resolveEntriesPath();
    const projectName = detectProjectName(process.cwd());
    console.error(`Centralized entries path: ${entriesPath}`);
    console.error(`Current project: ${projectName}`);
    console.error('===============================================');

    const server = new PrivateJournalServer();
    await server.run();
  } catch (error) {
    console.error('Failed to start private journal MCP server:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
