import * as vscode from "vscode";

export interface SolarSystemNode {
    name: string;
    type: "star" | "planet";
    path: string;
    size: number; // Mass
    lastModified: number; // For orbit radius calculation
    children?: SolarSystemNode[];
    // Visualization properties
    color?: string;
    orbitRadius?: number;
}

export class FileSystemCrawler {
    /**
     * Maps a directory to a SolarSystemNode
     * @param uri The URI of the directory to crawl
     * @returns A promise resolving to the root node of the system
     */
    public async crawl(uri: vscode.Uri, ignore: any): Promise<SolarSystemNode> {
        const stat = await vscode.workspace.fs.stat(uri);
        const name = uri.path.split("/").pop() || "Root";

        const root: SolarSystemNode = {
            name: name,
            type: "star",
            path: uri.fsPath,
            size: 1000, // Fixed size for Stars (Folders)
            lastModified: stat.mtime,
            children: [],
        };

        return this._crawlRecursive(uri, root, ignore);
    }

    private async _crawlRecursive(
        uri: vscode.Uri,
        parent: SolarSystemNode,
        ignore: any
    ): Promise<SolarSystemNode> {
        try {
            const children = await vscode.workspace.fs.readDirectory(uri);

            for (const [name, type] of children) {
                const childUri = vscode.Uri.joinPath(uri, name);

                // Use workspace.asRelativePath to get a path suitable for the ignore package
                const relativePath = vscode.workspace.asRelativePath(childUri);

                // Check if ignored
                if (ignore && ignore.ignores(relativePath)) {
                    continue;
                }

                if (type === vscode.FileType.Directory) {
                    // Recursively crawl subdirectories (Stars)
                    // Note: You might want to limit depth here for performance later (LOD)
                    const subStar: SolarSystemNode = {
                        name: name,
                        type: "star",
                        path: childUri.fsPath,
                        size: 500, // Smaller stars
                        lastModified: Date.now(), // Directories don't always have useful mtime, strictly speaking
                        children: [],
                    };

                    // We recursively map the folder, but for the visualization tree,
                    // we might want to flatten it or keep it nested depending on D3 needs.
                    // For now, let's keep it nested.
                    // For now, let's keep it nested.
                    const populatedStar = await this._crawlRecursive(
                        childUri,
                        subStar,
                        ignore
                    );
                    parent.children?.push(populatedStar);
                } else if (type === vscode.FileType.File) {
                    // Create Planets
                    const stat = await vscode.workspace.fs.stat(childUri);
                    const mass = Math.log(stat.size + 1) * 10; // Log scale for size

                    const planet: SolarSystemNode = {
                        name: name,
                        type: "planet",
                        path: childUri.fsPath,
                        size: Math.max(mass, 5), // Min size 5
                        lastModified: stat.mtime,
                        // Orbit radius will be calculated by the renderer,
                        // but we can pre-calculate a "Recency Score" here if needed.
                    };

                    parent.children?.push(planet);
                }
            }
        } catch (error) {
            console.error(`Error crawling ${uri.fsPath}:`, error);
        }

        return parent;
    }
}
