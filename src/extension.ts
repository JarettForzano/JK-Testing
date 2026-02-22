// The module 'vscode' contains the VS Code extensibility API
import * as vscode from 'vscode';
import { BASE_PROMPT, VULNERABILITIES_PROMPT, OVERSIGHTS_PROMPT, ALL } from './prompts';
import { trackCommits } from './versionControl';

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

  // selects the first model in the models copilot includes since "auto" throws an error. Can add more filters if desired.
  const models = await vscode.lm.selectChatModels({
        vendor: 'copilot'
    });

  const model = models[0];

  // initialize the prompt
  let prompt = BASE_PROMPT;

  if (request.command === 'vulnerabilities') {
	  prompt = VULNERABILITIES_PROMPT; 
  } else if (request.command === "oversights") {
	  prompt = OVERSIGHTS_PROMPT;
  } else if (request.command === "all") {
    prompt = ALL;
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
  const chatResponse = await model.sendRequest(messages, {}, token);

  // stream the response
  for await (const fragment of chatResponse.text) {
    stream.markdown(fragment);
  }
  

  return;
};

// create participant

// This method is called when your extension is deactivated
export function deactivate() {}
