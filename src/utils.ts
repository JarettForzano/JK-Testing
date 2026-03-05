import * as vscode from 'vscode';

export function getTools(): vscode.LanguageModelChatTool[] {
    const tools: vscode.LanguageModelChatTool[] =  vscode.lm.tools
    .filter((tool) => {
        const name = tool.name.toLowerCase();
        return (name.includes("codebase") || name.includes("file") 
                || name.includes("edit") || name.includes("run")
                || name.includes("copilot")) && 
                tool.inputSchema
    })
    .map((tool) => {
        return {name: tool.name, description: tool.description, inputSchema: tool.inputSchema};
    })

    return tools;
}