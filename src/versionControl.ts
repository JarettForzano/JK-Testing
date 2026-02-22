// The module 'vscode' contains the VS Code extensibility API
import * as vscode from 'vscode';
import { GitExtension, Repository } from './git';
import * as path from 'path';

export function trackCommits() {
    const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git')?.exports;
    const git = gitExtension?.getAPI(1);

    if (!git) return;

    // setup listening for a new repository that is opened by VSCode
    const setupRepo = (repo: Repository) => {
        let prevHead = repo.state.HEAD;
        let initialized = false;

        repo.state.onDidChange(async () => {
            if (!initialized) {
                // First change means the repo state has fully loaded
                prevHead = repo.state.HEAD;
                initialized = true;
                return;
            }

            const currentHead = repo.state.HEAD;

            // New commit was added
            if (currentHead?.commit !== prevHead?.commit && currentHead?.name === prevHead?.name) {
                vscode.window.showInformationMessage("A commit was added!");
                if (prevHead?.commit && currentHead?.commit) {
                    let changes = '';
                    let diff = await repo.diffBetween(prevHead.commit, currentHead.commit);
                    let folderPath = vscode.workspace.workspaceFolders?.[0]?.uri.path;
                    for (let change of diff) {
                        let filepath = change.uri.path;
                        if (!folderPath) {
                            folderPath = path.dirname(filepath);
                        }
                        filepath = path.relative(folderPath, filepath);
                        let contents = await repo.show(currentHead.commit, filepath);
                        changes += "File: " + filepath + "\nContents: " + contents;
                    }

                    vscode.commands.executeCommand("workbench.action.chat.open", "@JKAgent /all " + "Perform your tasks on the following fies that were updated:\n" + changes);
                    
                }
                
            }

            prevHead = currentHead;
        });
    };

    if (git.repositories[0]) setupRepo(git.repositories[0]);

    // Setup a new repo for listening when it is opened
    git.onDidOpenRepository(setupRepo);
}