// The module 'vscode' contains the VS Code extensibility API
import * as vscode from 'vscode';
import { BASE_PROMPT, VULNERABILITIES_PROMPT, OVERSIGHTS_PROMPT, ALL, FIND_REFERENCES, REFACTOR_TEST, GENERATE_DATA, RUN_TESTS } from './prompts';
import { trackCommits } from './versionControl';
import { handleTestOption, getTools } from './utils';
import * as chatUtils from '@vscode/chat-extension-utils';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "jk-test" is now active!');

  trackCommits(context);

  const base = vscode.chat.createChatParticipant('jk-test.jk-agent', base_handler);
  base.iconPath = vscode.Uri.file(
    context.asAbsolutePath('media/icon.png')
  );

  // Helper to open chat with selected code, optionally pre-filled with a slash command
  const openJKChat = (command?: string) => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    if (editor.selection.isEmpty) {
      vscode.window.showWarningMessage('No text selected. Please select some code first.');
      return;
    }

    const commandPrefix = command ? `/${command} ` : '';

    // Open the chat panel with #selection as a context chip rather than inlining the code
    vscode.commands.executeCommand('workbench.action.chat.open', {
      query: `@JKAgent ${commandPrefix}`,
      isPartialQuery: true
    });
  };

  const jkTestingCommand = vscode.commands.registerCommand('jk-test.testWithJK', () => openJKChat());
  const jkVulnerabilitiesCommand = vscode.commands.registerCommand('jk-test.testWithJKVulnerabilities', () => openJKChat('vulnerabilities'));
  const jkOversightsCommand = vscode.commands.registerCommand('jk-test.testWithJKOversights', () => openJKChat('oversights'));
  const jkTestDataCommand = vscode.commands.registerCommand('jk-test.testWithJKTestData', () => openJKChat('testdata'));

  context.subscriptions.push(jkTestingCommand, jkVulnerabilitiesCommand, jkOversightsCommand, jkTestDataCommand);
}

// define a chat handler
export const base_handler: vscode.ChatRequestHandler = async (
  request: vscode.ChatRequest,
  context: vscode.ChatContext,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken
  
) => {

  // Use model the user has selected
  let model = request.model;

  if (request.model.id === "auto") {
    // Use gpt-4.1 as a default if auto is still selected
    const models = await vscode.lm.selectChatModels({
          vendor: 'copilot',
          id: 'gpt-4.1'
      });

    model = models[0];
  }
  const tools = getTools();

  // initialize the prompt
  let prompt = BASE_PROMPT;

  if (request.command === 'test') {
    // Exit for the turn once we generate and run the tests
    await handleTestOption(request, stream, model, token, getTools());
    return;
  } else if (request.command === 'vulnerabilities') {
	  prompt = VULNERABILITIES_PROMPT;
  } else if (request.command === "oversights") {
	  prompt = OVERSIGHTS_PROMPT;
  } else if (request.command === "all") {
    prompt = ALL;
  } else if (request.command === "testdata") {
    // Initiate the test data workflow

    // Gather context about the tests
    await sendRequest(request, context, stream, token, BASE_PROMPT + " " + FIND_REFERENCES, model, tools);

    // Refactor the tests to parameterize if needed
    await sendRequest(request, context, stream, token, REFACTOR_TEST, model, tools);

    let confirmRefactor = vscode.window.showInformationMessage("Review the AI code changes.", "Continue", "Cancel");
    await confirmRefactor.then(async (value) => {
        if (value === "Cancel") {
          return;
        }
    });

    // Attempt to run the tests and fix any bugs in them
    await sendRequest(request, context, stream, token, RUN_TESTS, model, tools);

    let confirmFix = vscode.window.showInformationMessage("Review the AI code changes.", "Continue", "Cancel");
    await confirmFix.then(async (value) => {
        if (value === "Cancel") {
          return;
        }
    });

    // Generate more test data
    await sendRequest(request, context, stream, token, GENERATE_DATA, model, tools);

    return;
  }

  const libResult = chatUtils.sendChatParticipantRequest(
        request,
        context,
        {
            prompt: prompt,
            responseStreamOptions: {
                stream,
                references: true,
                responseText: true
            },
            tools: tools,
            model: model
        },
        token);

  return await libResult.result;
};

async function sendRequest (
  request: vscode.ChatRequest,
  context: vscode.ChatContext,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken,
  prompt: string,
  model: vscode.LanguageModelChat,
  tools: vscode.LanguageModelChatTool[]
) {

  const result = chatUtils.sendChatParticipantRequest(
        request,
        context,
        {
            prompt: prompt,
            responseStreamOptions: {
                stream,
                references: true,
                responseText: true
            },
            tools: tools,
            model: model
        },
        token);

  return await result.result;
}

// This method is called when your extension is deactivated
export function deactivate() {}