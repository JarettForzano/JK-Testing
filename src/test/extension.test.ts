import * as assert from 'assert';
import * as vscode from 'vscode';
import { base_handler } from '../extension.js';

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

		console.log(messages);

		await base_handler(
			mockRequest,
			mockContext,
			mockStream,
			mockToken
		);

		console.log(messages);

		assert.ok(messages.length > 0, 'Messages exist inside of the history');
	});

});