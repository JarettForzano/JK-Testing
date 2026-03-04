import * as vscode from 'vscode';

export function getTools(): vscode.LanguageModelChatTool[] {
    const tools: vscode.LanguageModelChatTool[] =  vscode.lm.tools
    .filter((tool) => {
        const name = tool.name.toLowerCase();
        return name.includes("codebase") || name.includes("file")
    })
    .map((tool) => {
        return {name: tool.name, description: tool.description, inputSchema: tool.inputSchema};
    })

    return tools;
}