// The module 'vscode' contains the VS Code extensibility API
import * as vscode from 'vscode';
import { BASE_PROMPT, VULNERABILITIES_PROMPT, OVERSIGHTS_PROMPT } from './prompts';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "code-tutor" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('code-tutor.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from code-tutor!');
	});

	context.subscriptions.push(disposable);

	// Register the "Test with JK-Testing" context menu command
	const jkTestingCommand = vscode.commands.registerCommand('code-tutor.testWithJK', () => {
		const editor = vscode.window.activeTextEditor;
		if (editor) {
			const selection = editor.selection;
			const selectedText = editor.document.getText(selection);
			// TODO: wire selectedText into your LLM/testing logic
			vscode.window.showInformationMessage('JK-Testing triggered!');
		}
	});

	context.subscriptions.push(jkTestingCommand);
	console.log('Congratulations, your extension "jk-test" is now active!');
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

// create participant
const base = vscode.chat.createChatParticipant('jk-test.jk-agent', base_handler);

// TODO add an icon

// This method is called when your extension is deactivated
export function deactivate() {}