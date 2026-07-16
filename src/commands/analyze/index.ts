/**
 * `structure analyze <path...>` — vision command.
 *
 * Sends one or more local images to a vision-capable Anthropic model
 * (default: Opus 4.7) and prints the analysis. Useful for screenshots,
 * UI mockups, document understanding.
 */

import { Command } from 'commander';
import * as fs from 'fs/promises';
import * as path from 'path';
import { completeWithImages, type ImageInput } from '../../anthropic/client.js';

const MIME_BY_EXT: Record<string, ImageInput['mediaType']> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

async function loadImage(filePath: string): Promise<ImageInput> {
  const ext = path.extname(filePath).toLowerCase();
  const mediaType = MIME_BY_EXT[ext];
  if (!mediaType) {
    throw new Error(`Unsupported image extension: ${ext} (${filePath})`);
  }
  const buf = await fs.readFile(filePath);
  return { data: buf.toString('base64'), mediaType };
}

export function analyzeCommands(program: Command): void {
  program
    .command('analyze <files...>')
    .description('Analyze one or more local images using a vision-capable Claude model')
    .option('-p, --prompt <text>', 'Analysis prompt', 'Describe what you see. Note layout, components, and any text.')
    .option('-m, --model <id>', 'Model id or tier (default: advanced → claude-opus-4-7)', 'advanced')
    .option('--max-tokens <n>', 'Max output tokens', (v) => parseInt(v, 10), 4096)
    .option('--json', 'Output as JSON (text + usage + cost)')
    .action(
      async (
        files: string[],
        options: { prompt: string; model: string; maxTokens: number; json?: boolean }
      ) => {
        try {
          const images = await Promise.all(files.map(loadImage));
          const result = await completeWithImages({
            modelTierOrId: options.model,
            system: 'You are a precise visual analysis assistant.',
            userText: options.prompt,
            images,
            maxTokens: options.maxTokens,
            source: 'analyze-cmd',
          });
          if (options.json) {
            console.log(JSON.stringify(result, null, 2));
          } else {
            console.log(result.text);
            console.error(
              `\n[${result.model}] in=${result.usage.inputTokens} out=${result.usage.outputTokens} cost=$${result.costUsd.toFixed(4)}`
            );
          }
        } catch (err) {
          console.error('analyze failed:', (err as Error).message);
          process.exitCode = 1;
        }
      }
    );
}
