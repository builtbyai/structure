import { SkillRegistry } from './index.js';
import { spawn } from 'child_process';
import { buildProviderCliArgs, getProvider, type ProviderConfig, type ProviderName } from '../config/providers.js';
import { OllamaMCP } from '../mcp/ollama.js';
import { complete as anthropicComplete } from '../anthropic/client.js';

export interface SkillRunOptions {
  config?: Record<string, unknown>;
}

interface ProviderOverrides {
  apiBase?: string;
  defaultModel?: string;
  models?: Record<string, string>;
}

type ProviderModelKey = keyof ProviderConfig['models'];

const BACKEND_PLANNER_SYSTEM_PROMPT = `You are a backend planner agent.

Operate in a slow-crawl style:
- think methodically before proposing implementation
- break work into phases: plan, dependencies, interfaces, data model, API surface, risks, rollout
- prefer explicit assumptions over vague recommendations
- optimize for backend architecture, service boundaries, storage design, queues, jobs, APIs, auth, observability, and deployment planning
- call out unclear requirements and missing constraints
- favor concrete deliverables such as endpoint lists, schema proposals, sequence diagrams in text, migration plans, and task breakdowns
- do not pad the answer with generic advice

When asked to produce a plan:
- start with a short problem framing
- list assumptions
- propose a backend design
- define data flow
- define API/contracts
- identify failure modes and operational risks
- end with an implementation sequence

If the user asks for code, still preserve the planner mindset and explain the backend shape first unless they explicitly want only code.`;

function parseAgentArgs(args: string[]): {
  list: boolean;
  raw: boolean;
  model?: string;
  system?: string;
  prompt: string;
} {
  let list = false;
  let raw = false;
  let model: string | undefined;
  let system: string | undefined;
  const promptParts: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--list') {
      list = true;
      continue;
    }

    if (arg === '--raw') {
      raw = true;
      continue;
    }

    if (arg === '--model') {
      model = args[i + 1];
      i++;
      continue;
    }

    if (arg.startsWith('--model=')) {
      model = arg.slice('--model='.length);
      continue;
    }

    if (arg === '--system') {
      system = args[i + 1];
      i++;
      continue;
    }

    if (arg.startsWith('--system=')) {
      system = arg.slice('--system='.length);
      continue;
    }

    promptParts.push(arg);
  }

  return {
    list,
    raw,
    model,
    system,
    prompt: promptParts.join(' ').trim(),
  };
}

function selectPreferredModel(models: string[]): string | undefined {
  const priorities = ['qwen', 'llama', 'mistral', 'codellama'];

  for (const priority of priorities) {
    const match = models.find((model) => model.toLowerCase().includes(priority));
    if (match) {
      return match;
    }
  }

  return models[0];
}

async function fetchAgentTags(baseUrl: string): Promise<any> {
  const response = await fetch(`${baseUrl}/api/tags`);
  if (!response.ok) {
    throw new Error(`AGENT endpoint returned HTTP ${response.status} for /api/tags`);
  }
  return response.json();
}

async function runAgentSkill(args: string[], options: SkillRunOptions = {}): Promise<string> {
  const parsed = parseAgentArgs(args);
  const configServers = options.config?.mcpServers as Record<string, { url?: string }> | undefined;
  const providerConfig = options.config?.providerConfig as Record<string, ProviderOverrides> | undefined;
  const baseUrl =
    providerConfig?.ollama?.apiBase ||
    configServers?.AGENT?.url ||
    configServers?.ollama?.url ||
    'http://localhost:11434';

  let tags: any;
  try {
    tags = await fetchAgentTags(baseUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`AGENT endpoint is unreachable at ${baseUrl}: ${message}`);
  }

  const models = Array.isArray(tags?.models)
    ? tags.models
        .map((model: any) => model?.name)
        .filter((name: unknown): name is string => typeof name === 'string' && name.length > 0)
    : [];

  if (parsed.list) {
    if (models.length === 0) {
      return 'No models available on AGENT.';
    }

    return models.join('\n');
  }

  if (models.length === 0) {
    throw new Error('No models available on AGENT.');
  }

  if (!parsed.prompt) {
    throw new Error('No prompt provided. Usage: /agent <prompt> or /agent --list');
  }

  const resolvedModel = parsed.model || selectPreferredModel(models);
  if (!resolvedModel) {
    throw new Error('Could not resolve a model from AGENT.');
  }

  const effectiveSystemPrompt = parsed.system || BACKEND_PLANNER_SYSTEM_PROMPT;
  const messages: Array<{ role: 'system' | 'user'; content: string }> = [
    {
      role: 'system',
      content: effectiveSystemPrompt,
    },
    {
      role: 'user',
      content: `Follow these instructions exactly:\n${effectiveSystemPrompt}\n\nUser request:\n${parsed.prompt}`,
    },
  ];

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: resolvedModel,
      stream: false,
      messages,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AGENT chat failed with HTTP ${response.status}: ${errorText}`);
  }

  const data: any = await response.json();
  if (parsed.raw) {
    return JSON.stringify(data, null, 2);
  }

  const content = data?.message?.content;
  if (typeof content === 'string' && content.length > 0) {
    return content;
  }

  return JSON.stringify(data, null, 2);
}

function resolveActiveProvider(config?: Record<string, unknown>): ProviderConfig {
  const providerName = ((config?.provider as ProviderName | undefined) || 'anthropic');
  const providerConfig = config?.providerConfig as Record<string, ProviderOverrides> | undefined;
  const overrides = providerConfig?.[providerName];

  return getProvider(providerName, overrides as Partial<ProviderConfig> | undefined);
}

async function runCliProvider(
  provider: ProviderConfig,
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const prompt = `${systemPrompt}\n\n---\n\nUser request:\n${userPrompt}`;
  const invocation = buildProviderCliArgs(provider, model, prompt, { print: true });

  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';

    const child = spawn(invocation.command, invocation.args, {
      cwd: process.cwd(),
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });

    child.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim());
        return;
      }

      reject(new Error(stderr.trim() || `${provider.name} exited with code ${code ?? 1}`));
    });
  });
}

async function executeSkillWithProvider(
  skillPrompt: string,
  args: string[],
  options: SkillRunOptions = {}
): Promise<string> {
  const provider = resolveActiveProvider(options.config);
  const configuredModel = (options.config?.model as string | undefined) || 'standard';
  const model =
    configuredModel in provider.models
      ? provider.models[configuredModel as ProviderModelKey]
      : configuredModel;
  const userPrompt = args.join(' ').trim();

  if (!userPrompt) {
    return skillPrompt;
  }

  const systemPrompt = [
    'You are executing a STRUCTURE CLI skill.',
    'Follow the skill instructions exactly.',
    'If the skill describes a workflow, carry out that workflow in your response.',
    'Be concrete, truthful, and avoid inventing unavailable observations.',
    '',
    'Skill instructions:',
    skillPrompt,
  ].join('\n');

  if (provider.name === 'ollama') {
    const providerConfig = options.config?.providerConfig as Record<string, ProviderOverrides> | undefined;
    const client = new OllamaMCP(provider.apiBase, providerConfig?.ollama?.defaultModel || model);
    const response = await client.chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      model
    );
    return response.message.content;
  }

  // Direct Anthropic API path — uses prompt caching + writes to usage ledger.
  // Opt-in: requires ANTHROPIC_API_KEY. Falls back to CLI spawn if absent.
  if (provider.name === 'anthropic' && process.env.ANTHROPIC_API_KEY) {
    // Split the system prompt into a stable harness preamble (cached) and the
    // skill body (also cached, separately). Both are stable across user turns.
    const harnessPreamble = [
      'You are executing a STRUCTURE CLI skill.',
      'Follow the skill instructions exactly.',
      'If the skill describes a workflow, carry out that workflow in your response.',
      'Be concrete, truthful, and avoid inventing unavailable observations.',
    ].join('\n');
    const result = await anthropicComplete({
      modelTierOrId: model,
      system: harnessPreamble,
      skillBlock: skillPrompt,
      user: userPrompt,
      source: 'skill-runner',
    });
    return result.text;
  }

  return runCliProvider(provider, model, systemPrompt, userPrompt);
}

export async function executeSkill(
  registry: SkillRegistry,
  name: string,
  args: string[] = [],
  options: SkillRunOptions = {}
): Promise<string> {
  const skill = registry.get(name);
  if (!skill) {
    throw new Error(`Skill not found: ${name}`);
  }

  if (name === 'agent') {
    return runAgentSkill(args, options);
  }

  const resolvedSkillPrompt = await registry.invoke(name, args);
  if (skill.disableModelInvocation) {
    return resolvedSkillPrompt;
  }

  return executeSkillWithProvider(resolvedSkillPrompt, args, options);
}
