// The module 'vscode' contains the VS Code extensibility API
import * as vscode from 'vscode';
import { Branch, GitExtension, Repository } from './git';
import * as path from 'path';

/**
 * Set up a listener that will track when a new commit is added and ask the user if they
 * want the JKAgent to check their work. 
 * @returns void
 */
export function trackCommits(context: vscode.ExtensionContext) {
    const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git')?.exports;
    const git = gitExtension?.getAPI(1);
    context.globalState.update("ALWAYS", false);
    context.globalState.update("NEVER", false);

    // Failure to get the git api
    if (!git) {return;}

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

            // Helper function to run a full QA check with updated files as context
            const checkAll = async (prevCommit: string | undefined, currentCommit: string | undefined) => {
                if (prevCommit && currentCommit) {
                    let changes = '';
                    let diff = await repo.diffBetween(prevCommit, currentCommit);

                    // Gather file names and content to add as context for the agent
                    for (let change of diff) {
                        let filepath = change.uri.path;
                        changes += "- " + filepath;
                    }

                    vscode.commands.executeCommand("workbench.action.chat.open", "@JKAgent /all Perform your tasks on the following fies:\n" + changes);  
                }
            };

            // New commit was added
            if (currentHead?.commit !== prevHead?.commit && currentHead?.name === prevHead?.name) {
                const prevHeadCommitCopy = prevHead?.commit;
                const currentHeadCommitCopy = currentHead?.commit;

                // Run full check if "Always" was already selected
                if (context.globalState.get("ALWAYS") === true) {
                    await checkAll(prevHeadCommitCopy, currentHeadCommitCopy);
                    // Show options as long as "Never" wasn't selected
                } else if (context.globalState.get("NEVER") === false) {
                    let options = vscode.window.showInformationMessage("A new commit was detected. Run a QA check on all changes now?", "Yes", "Always", "No", "Never");
                    await options.then(async (value) => {
                        // Run /all command with the agent if the user chooses
                        if (value === "Yes") {
                            await checkAll(prevHeadCommitCopy, currentHeadCommitCopy);
                        } else if (value === "Always") {
                                context.globalState.update("ALWAYS", true);
                                context.globalState.update("NEVER", false);
                                await checkAll(prevHeadCommitCopy, currentHeadCommitCopy);
                        } else if (value === "Never") {
                            context.globalState.update("NEVER", true);
                            context.globalState.update("ALWAYS", false);
                        }
                    });
                }
            }

            prevHead = currentHead;
        });
    };

    if (git.repositories[0]) {setupRepo(git.repositories[0]);}

    // Setup a new repo for listening when it is opened
    git.onDidOpenRepository(setupRepo);
}