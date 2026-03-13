import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';
import { execFile } from 'child_process';
import { TEST_PROMPT } from './prompts';

export function getTools(): vscode.LanguageModelChatTool[] {
    const tools: vscode.LanguageModelChatTool[] =  vscode.lm.tools
    .filter((tool) => {
        const name = tool.name.toLowerCase();
        return (name.includes("codebase") || name.includes("file") 
                || name.includes("edit") || name.includes("run")
                || name.includes("copilot")) && 
                tool.inputSchema;
    })
    .map((tool) => {
        return {name: tool.name, description: tool.description, inputSchema: tool.inputSchema};
    });

    return tools;
}

async function analyzeTestResults(
  generatedCode: string,
  testOutput: string,
  stream: vscode.ChatResponseStream,
  model: vscode.LanguageModelChat,
  token: vscode.CancellationToken
): Promise<void> {
  stream.progress('Analyzing results...');
  
  const analyzePrompt =  `You are a QA engineer. Analyze the following pytest results and provide a brief summary:\n` +
      `- Which tests passed and which failed\n` +
      `- For failures, explain the likely root cause\n` +
      `- Suggest fixes for the code under test\n\n` +
      `**Generated test code:**\n\`\`\`python\n${generatedCode}\n\`\`\`\n\n` +
      `**Test output:**\n\`\`\`\n${testOutput}\n\`\`\``;

  // Prompt the model with the latest test results and get an analysis
  const messages = [vscode.LanguageModelChatMessage.User(analyzePrompt)];
  const response = await model.sendRequest(messages, {}, token);

  // Show header once first token arrives so progress spinner stays visible
  let firstChunk = true;
  for await (const fragment of response.text) {
    if (firstChunk) {
      stream.markdown('\n**Analysis:**\n');
      firstChunk = false;
    }
    stream.markdown(fragment);
  }
}

async function sendWithTools(
  messages: vscode.LanguageModelChatMessage[],
  model: vscode.LanguageModelChat,
  tools: vscode.LanguageModelChatTool[],
  token: vscode.CancellationToken,
  opts: { onToolCall?: () => void; maxRounds?: number; toolInvocationToken?: vscode.ChatParticipantToolToken } = {}
): Promise<string> {
  // Max amount of tool calls is 5
  const maxRounds = opts.maxRounds ?? 5;

  // Sends a request with tools, handling the tool-calling loop until the model returns text
  for (let round = 0; round < maxRounds; round++) {
    const response = await model.sendRequest(messages, { tools }, token);
    const { text, toolCalls } = await collectResponse(response);

    if (toolCalls.length === 0) { return text; }

    opts.onToolCall?.();
    messages.push(vscode.LanguageModelChatMessage.Assistant(toolCalls));
    await executeToolCalls(toolCalls, messages, token, opts.toolInvocationToken);
  }

  return '';
}

async function collectResponse(
  response: vscode.LanguageModelChatResponse
): Promise<{ text: string; toolCalls: vscode.LanguageModelToolCallPart[] }> {
  let text = '';
  const toolCalls: vscode.LanguageModelToolCallPart[] = [];

  // Collects text and tool calls from a model response stream
  for await (const part of response.stream) {
    if (part instanceof vscode.LanguageModelTextPart) {
      text += part.value;
    } else if (part instanceof vscode.LanguageModelToolCallPart) {
      toolCalls.push(part);
    }
  }

  return { text, toolCalls };
}

async function executeToolCalls(
  toolCalls: vscode.LanguageModelToolCallPart[],
  messages: vscode.LanguageModelChatMessage[],
  token: vscode.CancellationToken,
  toolInvocationToken: vscode.ChatParticipantToolToken | undefined
): Promise<void> {
  // Executes tool calls and appends the results to the message history
  for (const toolCall of toolCalls) {
    const result = await vscode.lm.invokeTool(toolCall.name, { input: toolCall.input, toolInvocationToken }, token);
    messages.push(vscode.LanguageModelChatMessage.User([
      new vscode.LanguageModelToolResultPart(toolCall.callId, result.content as any)
    ]));
  }
}

export async function handleTestOption(
  request: vscode.ChatRequest,
  stream: vscode.ChatResponseStream,
  model: vscode.LanguageModelChat,
  token: vscode.CancellationToken,
  tools: vscode.LanguageModelChatTool[]
): Promise<void> {
  // Initiate a new message array
  const messages: vscode.LanguageModelChatMessage[] = [vscode.LanguageModelChatMessage.User(TEST_PROMPT)];

  // Add all of the references the user passed into the context window
  messages.push(...await resolveReferences(request.references ?? []));

  // If there is a prompt we add that at the end, after the context is provided
  if (request.prompt) {
    messages.push(vscode.LanguageModelChatMessage.User(request.prompt));
  }

  // Notification to the user that we have started generating the tests
  stream.progress('Generating pytest tests...');

  // Let the model search/read files if no code was attached, then generate tests
  const rawCode = await sendWithTools(messages, model, tools, token, {
    onToolCall: () => stream.progress('Searching codebase...'),
    toolInvocationToken: request.toolInvocationToken
  });

  // Check if the model actually generated test code or just responded conversationally
  const generatedCode = stripCodeFences(rawCode);
  if (!generatedCode.includes('def test_')) {
    stream.markdown(rawCode);
    return;
  }

  // Stream the generated tests to the user
  stream.markdown('**Generated tests:**\n```python\n' + generatedCode + '\n```\n\n');

  // Start setting up the test environment
  stream.progress('Setting up test environment...');

  // Try to setup the environment, streaming the error to the user if we encounter an issue
  try {
    // Create the test .venv file
    const { python, cleanup } = await createTestVenv();
    try {
      // Run the code generated by the model (create the pytest in here too)
      stream.progress('Running tests...');
      const result = await runPytest(python, generatedCode);
      
      // Take the stdout and stderr and create the test result response
      const output = (result.stdout + '\n' + result.stderr).trim();
      const passed = result.exitCode === 0;

      // Return the test results
      stream.markdown(`**Test results** (${passed ? 'PASSED' : 'FAILED'}):\n\`\`\`\n${output}\n\`\`\`\n`);

      // Ask the model to analyze the results
      await analyzeTestResults(generatedCode, output, stream, model, token);
    } finally {
      // Removes all of the temp code that was generated to run the tests
      await cleanup();
    }
  } catch (err: any) {
    // If an exception is raised we show that to the user
    stream.markdown(`**Execution error:**\n\`\`\`\n${err.message ?? err}\n\`\`\`\n`);
  }
  return;
}

export async function getPythonPath(): Promise<string> {
  try {
    // Fetch the users python extension to find out where the active .venv is
    const pyExtension = vscode.extensions.getExtension('ms-python.python');

    // Check for the .venv path through the native python extension works
    if (pyExtension) {
      // Activate the extension if its not on
      if (!pyExtension.isActive) { await pyExtension.activate(); }

      // Find the active env
      const details = pyExtension.exports?.settings?.getExecutionDetails?.(
        vscode.workspace.workspaceFolders?.[0]?.uri
      );

      // Return the path to the environment
      if (details?.execCommand?.[0]) { return details.execCommand[0]; }
    }
  } catch (e) {
    console.log('[jk-test] failed to get python path from ms-python:', e);
  }

  // Defacto base env that is associated with the users computer (we assume)
  return 'python3';
}

export function stripCodeFences(raw: string): string {
  return raw.trim().replace(/^```(?:python)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
}

function execPromise(
  cmd: string,
  args: string[],
  opts: { timeout?: number } = {}
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  // Runs a command in the environment and return the stdout, stderr, and exitCode
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: opts.timeout }, (error, stdout, stderr) => {
      if (error && !('code' in error)) {
        reject(error);
        return;
      }

      resolve({
        stdout: stdout ?? '',
        stderr: stderr ?? '',
        exitCode: (error as any)?.code ?? 0,
      });
    });
  });
}

// creates a temp venv with pytest installed, returns the venv python path and a cleanup function
export async function createTestVenv(): Promise<{ python: string; cleanup: () => Promise<void> }> {
  // Create a virtual environment directory where we create the environment to run the pytests in
  const venvDir = path.join(os.tmpdir(), `jk_test_venv_${Date.now()}`);

  // Create the python environment
  const venvResult = await execPromise('python3', ['-m', 'venv', venvDir], { timeout: 30_000 });

  // Propagate to the user if an error condition occurs
  if (venvResult.exitCode !== 0) {
    throw new Error(`Failed to create venv: ${venvResult.stderr}`);
  }

  // Install pytest into the virtual environment
  const python = path.join(venvDir, 'bin', 'python');
  const installResult = await execPromise(python, ['-m', 'pip', 'install', 'pytest'], { timeout: 60_000 });

  if (installResult.exitCode !== 0) {
    throw new Error(`Failed to install pytest in venv: ${installResult.stderr}`);
  }

  // Return the python environment and the method to clean up the environment
  return {
    python,
    cleanup: async () => { await fs.rm(venvDir, { recursive: true, force: true }).catch(() => {}); },
  };
}

export async function runPytest(
  pythonPath: string,
  code: string,
  timeoutMs = 30_000
): Promise<{ stdout: string; stderr: string; exitCode: number }> {

  // Create a temporary file to hold the test code
  const tmpFile = path.join(os.tmpdir(), `jk_test_${Date.now()}.py`);
  await fs.writeFile(tmpFile, code, 'utf-8');

  // Execute the python code inside of the environment, cleaning up when its finished running
  try {
    return await execPromise(
      pythonPath,
      ['-m', 'pytest', tmpFile, '-v', '--tb=short', '--no-header'],
      { timeout: timeoutMs }
    );
  } finally {
    await fs.unlink(tmpFile).catch(() => {});
  }
}


async function readFileRef(val: any): Promise<string> {

  // Read the file reference and return the text to the model
  const uri = val instanceof vscode.Uri ? val : vscode.Uri.parse(val.toString());
  const doc = await vscode.workspace.openTextDocument(uri);

  return `File: ${uri.fsPath}\n\`\`\`\n${doc.getText()}\n\`\`\``;
}

async function readLocationRef(val: any): Promise<string> {
  // Read the location reference and return the text to the model (user provided)
  const uri = val.uri instanceof vscode.Uri ? val.uri : vscode.Uri.parse(val.uri.toString());
  const doc = await vscode.workspace.openTextDocument(uri);

  // If the user provides the range we read the characters
  if (val.range) {
    const range = new vscode.Range(
      val.range.start.line, val.range.start.character,
      val.range.end.line, val.range.end.character
    );

    // Return the user provided code
    return `Code from ${uri.fsPath}:\n\`\`\`\n${doc.getText(range)}\n\`\`\``;
  }

  // If we have no range we can just return the whole file
  return `File: ${uri.fsPath}\n\`\`\`\n${doc.getText()}\n\`\`\``;
}

export async function resolveReferences(
  refs: readonly vscode.ChatPromptReference[]
): Promise<vscode.LanguageModelChatMessage[]> {
  // Create a in memory reference of all the context references provided by the user
  const messages: vscode.LanguageModelChatMessage[] = [];

  for (const ref of refs) {
    const val = ref.value;
    try {
      let content: string | undefined;
      if (val instanceof vscode.Uri) {
        content = await readFileRef(val);
      } else if (val instanceof vscode.Location) {
        content = await readLocationRef(val);
      } else if (typeof val === 'object' && val !== null && 'uri' in val) {
        content = await readLocationRef(val);
      } else if (typeof val === 'object' && val !== null && 'scheme' in val) {
        content = await readFileRef(val);
      } else if (typeof val === 'string') {
        content = val;
      }

      // If its a parsable reference we add it to the new messages array
      if (content) {
        messages.push(vscode.LanguageModelChatMessage.User(content));
      }
    } catch (e) {
      console.log(`[jk-test] failed to read ref ${ref.id}:`, e);
    }
  }

  // Return all the parsed references to the model
  return messages;
}
