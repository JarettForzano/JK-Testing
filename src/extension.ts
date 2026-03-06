// The module 'vscode' contains the VS Code extensibility API
import * as vscode from 'vscode';
import { BASE_PROMPT, VULNERABILITIES_PROMPT, OVERSIGHTS_PROMPT, ALL } from './prompts';
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
}
// define a chat handler
export const base_handler: vscode.ChatRequestHandler = async (
  request: vscode.ChatRequest,
  context: vscode.ChatContext,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken
  
) => {

  // Use the model the user has selected
  const model = request.model;

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
  }

  const tools = getTools();

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

// This method is called when your extension is deactivated
export function deactivate() {}
