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

        // Initialize Crawler
        console.log(
            ">> Solaris << Initializing Crawler from resolveWebviewView"
        );
        this._updateWebview(webviewView.webview);

        // Message Listener
        webviewView.webview.onDidReceiveMessage(
            (data: { type: string; value: any }) => {
                switch (data.type) {
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
            const crawler = new FileSystemCrawler();
            const rootUri = vscode.workspace.workspaceFolders[0].uri;
            const data = await crawler.crawl(rootUri);
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
