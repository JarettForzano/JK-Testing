// The module 'vscode' contains the VS Code extensibility API
import * as vscode from 'vscode';
import { BASE_PROMPT, VULNERABILITIES_PROMPT, OVERSIGHTS_PROMPT } from './prompts';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "jk-test" is now active!');

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

	context.subscriptions.push(jkTestingCommand, jkVulnerabilitiesCommand, jkOversightsCommand);
}

// define a chat handler
const base_handler: vscode.ChatRequestHandler = async (
  request: vscode.ChatRequest,
  context: vscode.ChatContext,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken
) => {
  // initialize the prompt
  let prompt = BASE_PROMPT;

  if (request.command === 'vulnerabilities') {
    prompt = prompt + "\n\n" + VULNERABILITIES_PROMPT;
  } else if (request.command === "oversights") {
    prompt = prompt + "\n\n" + OVERSIGHTS_PROMPT;
  }

  // initialize the messages array with the prompt
  const messages = [vscode.LanguageModelChatMessage.User(prompt)];

  // extract content from any context references (e.g. #selection, #file chips)
  for (const ref of request.references) {
    if (ref.value instanceof vscode.Location) {
      const doc = await vscode.workspace.openTextDocument(ref.value.uri);
      const text = doc.getText(ref.value.range);
      messages.push(vscode.LanguageModelChatMessage.User(
        `Context (${ref.id}):\n\`\`\`\n${text}\n\`\`\``
      ));
    } else if (typeof ref.value === 'string') {
      messages.push(vscode.LanguageModelChatMessage.User(
        `Context (${ref.id}):\n${ref.value}`
      ));
    }
  }

  // add previous assistant messages for conversation history
  const previousMessages = context.history.filter(
    h => h instanceof vscode.ChatResponseTurn
  );
  previousMessages.forEach(m => {
    let fullMessage = '';
    m.response.forEach(r => {
      const mdPart = r as vscode.ChatResponseMarkdownPart;
      fullMessage += mdPart.value.value;
    });
    messages.push(vscode.LanguageModelChatMessage.Assistant(fullMessage));
  });

  // add in the user's message
  messages.push(vscode.LanguageModelChatMessage.User(request.prompt));

  // send the request
  const chatResponse = await request.model.sendRequest(messages, {}, token);

  // stream the response
  for await (const fragment of chatResponse.text) {
    stream.markdown(fragment);
  }

  return;
};

// This method is called when your extension is deactivated
export function deactivate() {}