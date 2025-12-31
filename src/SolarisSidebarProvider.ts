import * as vscode from "vscode";
import { FileSystemCrawler } from "./FileSystemCrawler";

export class SolarisSidebarProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = "solaris-sidebar";

    constructor(private readonly _extensionUri: vscode.Uri) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        console.log(">> Solaris << Resolving WebviewView");
        webviewView.webview.options = {
            // Allow scripts in the webview
            enableScripts: true,
            localResourceRoots: [this._extensionUri],
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Initialize Crawler (Wait for Webview to be Ready)
        console.log(
            ">> Solaris << Initializing Crawler. Waiting for 'onReady' signal..."
        );
        // Removed direct call to this._updateWebview(webviewView.webview);

        // Message Listener
        webviewView.webview.onDidReceiveMessage(
            async (data: { type: string; value: any }) => {
                switch (data.type) {
                    case "onReady": {
                        console.log(
                            ">> Solaris << Webview is Ready. Starting update..."
                        );
                        this._updateWebview(webviewView.webview);
                        break;
                    }
                    case "onInfo": {
                        if (!data.value) {
                            return;
                        }
                        console.log(
                            `>> Solaris << Info Received: ${data.value}`
                        );
                        vscode.window.showInformationMessage(data.value);
                        break;
                    }
                    case "onError": {
                        if (!data.value) {
                            return;
                        }
                        console.error(
                            `>> Solaris << Error Received: ${data.value}`
                        );
                        vscode.window.showErrorMessage(data.value);
                        break;
                    }
                    case "onOpenFile": {
                        if (!data.value) {
                            return;
                        }
                        console.log(
                            `>> Solaris << Opening File: ${data.value}`
                        );
                        vscode.commands.executeCommand(
                            "vscode.open",
                            vscode.Uri.file(data.value)
                        );
                        break;
                    }
                    case "deleteFile": {
                        const filePath = data.value;
                        if (!filePath) return;
                        vscode.window
                            .showWarningMessage(
                                `Are you sure you want to delete '${filePath}'?`,
                                { modal: true },
                                "Delete"
                            )
                            .then(async (selection) => {
                                if (selection === "Delete") {
                                    try {
                                        await vscode.workspace.fs.delete(
                                            vscode.Uri.file(filePath),
                                            { recursive: true, useTrash: true }
                                        );
                                        this._updateWebview(
                                            webviewView.webview
                                        );
                                    } catch (e) {
                                        vscode.window.showErrorMessage(
                                            "Failed to delete file: " + e
                                        );
                                    }
                                }
                            });
                        break;
                    }
                    case "renameFile": {
                        const filePath = data.value;
                        if (!filePath) return;
                        const uri = vscode.Uri.file(filePath);
                        const oldName = uri.path.split("/").pop();
                        vscode.window
                            .showInputBox({
                                prompt: "Enter new name",
                                value: oldName,
                            })
                            .then(async (newName) => {
                                if (!newName || newName === oldName) return;
                                const newPath = vscode.Uri.file(
                                    filePath.substring(
                                        0,
                                        filePath.lastIndexOf("/") + 1
                                    ) + newName
                                );
                                try {
                                    await vscode.workspace.fs.rename(
                                        uri,
                                        newPath
                                    );
                                    this._updateWebview(webviewView.webview);
                                } catch (e) {
                                    vscode.window.showErrorMessage(
                                        "Failed to rename file: " + e
                                    );
                                }
                            });
                        break;
                    }
                    case "createFile": {
                        const folderPath = data.value; // Parent folder
                        if (!folderPath) return;
                        vscode.window
                            .showInputBox({
                                prompt: "Enter new file name",
                            })
                            .then(async (fileName) => {
                                if (!fileName) return;
                                const newUri = vscode.Uri.file(
                                    folderPath + "/" + fileName
                                );
                                try {
                                    await vscode.workspace.fs.writeFile(
                                        newUri,
                                        new Uint8Array()
                                    );
                                    this._updateWebview(webviewView.webview);
                                } catch (e) {
                                    vscode.window.showErrorMessage(
                                        "Failed to create file: " + e
                                    );
                                }
                            });
                        break;
                    }
                    case "createFolder": {
                        const folderPath = data.value; // Parent folder
                        if (!folderPath) return;
                        vscode.window
                            .showInputBox({
                                prompt: "Enter new folder name",
                            })
                            .then(async (folderName) => {
                                if (!folderName) return;
                                const newUri = vscode.Uri.file(
                                    folderPath + "/" + folderName
                                );
                                try {
                                    await vscode.workspace.fs.createDirectory(
                                        newUri
                                    );
                                    this._updateWebview(webviewView.webview);
                                } catch (e) {
                                    vscode.window.showErrorMessage(
                                        "Failed to create folder: " + e
                                    );
                                }
                            });
                        break;
                    }
                    case "moveFile": {
                        const { source, destination } = data.value;
                        if (!source || !destination) return;
                        try {
                            const sourceUri = vscode.Uri.file(source);
                            // Destination is the target folder. We need to append the filename.
                            const fileName = source.split(/[/\\]/).pop();
                            // Ensure destination ends with slash if it doesn't (though Uri.file handles paths well, string concat needs care)
                            // Actually, let's treat 'destination' as the PARENT folder to move INTO.
                            const destUri = vscode.Uri.file(
                                destination + "/" + fileName
                            );

                            await vscode.workspace.fs.rename(
                                sourceUri,
                                destUri
                            );
                            this._updateWebview(webviewView.webview);
                        } catch (e) {
                            vscode.window.showErrorMessage(
                                "Failed to move file: " + e
                            );
                        }
                        break;
                    }
                }
            }
        );
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        console.log(">> Solaris << Generating HTML for Webview");
        // Get the local path to main script run in the webview, then convert it to a uri we can use in the webview.
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, "media", "main.js")
        );
        const d3Uri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, "media", "d3.js")
        );
        const styleResetUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, "media", "reset.css")
        );
        const styleVSCodeUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, "media", "vscode.css")
        );
        const styleMainUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, "media", "main.css")
        );

        // Use a nonce to only allow a specific script to be run.
        const nonce = getNonce();

        return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<!--
					Use a content security policy to only allow loading images from https or from our extension directory,
					and only allow scripts that have a specific nonce.
				-->
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<link href="${styleResetUri}" rel="stylesheet">
				<link href="${styleVSCodeUri}" rel="stylesheet">
				<link href="${styleMainUri}" rel="stylesheet">
				<title>Solaris</title>
			</head>
			<body>
                <div id="loading">Initializing Star System...</div>
                <canvas id="universe"></canvas>
                <script nonce="${nonce}" src="${d3Uri}"></script>
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
    }

    private async _updateWebview(webview: vscode.Webview) {
        console.log(">> Solaris << _updateWebview called");
        if (!vscode.workspace.workspaceFolders) {
            console.log(
                ">> Solaris << No workspace folders found. Skipping update."
            );
            return;
        }

        try {
            console.log(">> Solaris << Starting FileSystemCrawler crawl...");

            // Initialize ignore parser
            const ignore = require("ignore");
            const ig = ignore();
            const rootUri = vscode.workspace.workspaceFolders[0].uri;

            // Load .gitignore and .ignore if they exist
            try {
                const gitignoreUri = vscode.Uri.joinPath(rootUri, ".gitignore");
                const gitignoreData = await vscode.workspace.fs.readFile(
                    gitignoreUri
                );
                ig.add(gitignoreData.toString());
                console.log(">> Solaris << Loaded .gitignore");
            } catch (e) {
                // Ignore if file doesn't exist
            }

            try {
                const ignoreUri = vscode.Uri.joinPath(rootUri, ".ignore");
                const ignoreData = await vscode.workspace.fs.readFile(
                    ignoreUri
                );
                ig.add(ignoreData.toString());
                console.log(">> Solaris << Loaded .ignore");
            } catch (e) {
                // Ignore if file doesn't exist
            }

            // Always ignore .git
            ig.add(".git");

            const crawler = new FileSystemCrawler();
            const data = await crawler.crawl(rootUri, ig);
            console.log(
                `>> Solaris << Crawl complete. Root node: ${data.name}, Children: ${data.children?.length}`
            );

            console.log(">> Solaris << Posting 'update' message to webview...");
            const success = await webview.postMessage({
                type: "update",
                data: data,
            });
            console.log(`>> Solaris << Message posted. Success: ${success}`);
        } catch (error) {
            console.error(
                ">> Solaris << Error during crawl or message post:",
                error
            );
            vscode.window.showErrorMessage(
                "Solaris Initialization Failed: " + error
            );
        }
    }
}

function getNonce() {
    let text = "";
    const possible =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
