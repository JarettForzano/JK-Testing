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

	// Register the "Test with JK-Testing" context menu command
	const jkTestingCommand = vscode.commands.registerCommand('jk-test.testWithJK', () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			return;
		}

		const selection = editor.selection;
		const selectedText = editor.document.getText(selection);

		if (!selectedText) {
			vscode.window.showWarningMessage('No text selected. Please select some code first.');
			return;
		}

		// Open the chat panel and pre-fill it with the agent mention and selected code
		vscode.commands.executeCommand('workbench.action.chat.open', {
			query: `@JKAgent\n\`\`\`\n${selectedText}\n\`\`\``,
			isPartialQuery: true  // keeps the query editable before sending, so user can add a command like /vulnerabilities
		});
	});

	context.subscriptions.push(jkTestingCommand);
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

  // TODO add previous message context according to tutorial
  
  // initialize the messages array with the prompt
  const messages = [vscode.LanguageModelChatMessage.User(prompt)];
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