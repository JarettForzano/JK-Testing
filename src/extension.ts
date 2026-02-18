// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
const BASE_PROMPT =
  'You are a helpful code tutor. Your job is to teach the user with simple descriptions and sample code of the concept. Respond with a guided overview of the concept in a series of messages. Do not give the user the answer directly, but guide them to find the answer themselves. If the user asks a non-programming question, politely decline to respond.';

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
const over_site_handler: vscode.ChatRequestHandler = async (
  request: vscode.ChatRequest,
  context: vscode.ChatContext,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken
  
) => {
  // initialize the prompt
  let prompt = BASE_PROMPT;

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
const vunabilites_handler: vscode.ChatRequestHandler = async (
  request: vscode.ChatRequest,
  context: vscode.ChatContext,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken
  
) => {
  // initialize the prompt
  let prompt = BASE_PROMPT;

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
const base = vscode.chat.createChatParticipant('chat-tutorial.code-tutor', base_handler);
const vunabilites = vscode.chat.createChatParticipant('chat-tutorial.code-tutor2', vunabilites_handler);
const over_site = vscode.chat.createChatParticipant('chat-tutorial.code-tutor3', over_site_handler);
// add icon to participant

// This method is called when your extension is deactivated
export function deactivate() {}