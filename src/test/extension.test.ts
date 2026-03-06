import * as assert from 'assert';
import * as vscode from 'vscode';
import { base_handler } from '../extension.js';
import * as utils from '../utils.js';

suite('Default Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Base test', () => {
		assert.strictEqual(-1, [1, 2, 3].indexOf(5));
		assert.strictEqual(-1, [1, 2, 3].indexOf(0));
	});
});

suite('Chat Tests', () => {

	test('responds with a message', async () => {
		const messages: string[] = [];

		// Stubs
		const originalSelectChatModels = vscode.lm.selectChatModels;
		(vscode.lm as any).selectChatModels = async () => [
			{
				sendRequest: async () => ({
					text: (async function* () { yield 'Response'; })()
				})
			}
		];

		const originalGetTools = utils.getTools;
		(utils as any).getTools = () => mockTools;

		const mockContext = {
			history: ["Message a1", "Message 2"] as any
		};

		const mockRequest = {
			prompt: 'Can you take a look at my code?',
			command: undefined,
			model: {
				sendRequest: async () => ({
					text: (async function* () { yield 'Response'; })()
				})
			}
		} as any;

		const mockStream = {
			markdown: (text: string) => messages.push(text)
		} as any;

		const mockToken = new vscode.CancellationTokenSource().token;

		await base_handler(
			mockRequest,
			mockContext,
			mockStream,
			mockToken
		);

		// Restore original
    	(vscode.lm as any).selectChatModels = originalSelectChatModels;
		(utils as any).getTools = originalGetTools;

		assert.ok(messages.length > 0, 'Messages exist inside of the history');
	});

});

const mockTools: readonly vscode.LanguageModelChatTool[] = [
		// Should be included — name contains "codebase"
		{ name: 'codebase_search', description: 'Search the codebase', inputSchema: { type: 'object', properties: { query: { type: 'string' } } }},
		{ name: 'codebaseIndex', description: 'Index the codebase', inputSchema: {} },
		// Should be included — name contains "file"
		{ name: 'read_file', description: 'Read a file', inputSchema: { type: 'object', properties: { path: { type: 'string' } } } },
		{ name: 'FileReader', description: 'Opens and reads a file', inputSchema: {}},
		// Should be excluded — name does not contain "codebase" or "file"
		{ name: 'get_weather', description: 'Get current weather', inputSchema: {} },
		{ name: 'run_terminal', description: 'Run a terminal command', inputSchema: {}},
	];