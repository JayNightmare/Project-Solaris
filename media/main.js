// @ts-check

// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.

/** @type {any} */
// @ts-ignore
const d3 = window.d3;

(function () {
    console.log(">> Solaris << Webview Main script started.");

    // @ts-ignore
    const vscode = acquireVsCodeApi();

    // Signal to the extension that the webview is ready to receive messages
    vscode.postMessage({ type: "onReady" });

    /** @type {HTMLCanvasElement | null} */
    const canvas = /** @type {HTMLCanvasElement} */ (
        document.getElementById("universe")
    );
    if (!canvas) {
        console.error(">> Solaris << Canvas element not found in DOM.");
        return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
        console.error(">> Solaris << Canvas 2D context failed to initialize.");
        return;
    }

    let width = window.innerWidth;
    let height = window.innerHeight;
    let transform = d3.zoomIdentity;

    if (!d3) {
        console.error(
            ">> Solaris << D3 Global Object is missing! D3 script failed to load."
        );
        vscode.postMessage({
            type: "onError",
            value: "D3 failed to load in Webview.",
        });
    } else {
        console.log(">> Solaris << D3 Global Object found.");
    }

    // Resize handling
    window.addEventListener("resize", () => {
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;
        if (simulation) {
            simulation.restart();
        }
    });
    canvas.width = width;
    canvas.height = height;

    // --- ZOOM BEHAVIOR ---
    const zoom = d3
        .zoom()
        .scaleExtent([0.1, 4]) // Limit zoom
        .on("zoom", (/** @type {any} */ event) => {
            transform = event.transform;
            ticked(); // Re-render on zoom

            // Reset focus if zoomed out too far
            if (transform.k <= 0.15) {
                // Threshold slightly above min to allow "snap"
                // Ideally we animate this, but for now just let the user know/feel it?
                // Actually, let's just use it as a trigger if we moved AWAY.
            }
        });

    // Apply zoom to canvas
    d3.select(canvas).call(zoom);

    /** @type {any} */
    let simulation;
    /** @type {any[]} */
    let nodes = [];
    /** @type {any[]} */
    let links = [];
    /** @type {any} */
    let rootNode = null;
    /** @type {any[]} */
    let starfield = []; // Background stars

    // Universe Dimensions
    const universeR = 2500; // Fixed radius for the "Safe Zone"
    const centerX = 0; // The universe is centered at 0,0 in the simulation space
    const centerY = 0;

    // Generate static starfield WITHIN the Deep Space Boundary
    for (let i = 0; i < 500; i++) {
        starfield.push({
            x: centerX + (Math.random() * universeR * 2 - universeR),
            y: centerY + (Math.random() * universeR * 2 - universeR),
            size: Math.random() * 2,
            opacity: Math.random(),
        });
    }

    // --- UI CONTROLS ---
    // Speed Slider
    const controls = document.createElement("div");
    controls.className = "controls";
    // Using string concat for readability
    controls.innerHTML = `
        <label for="speed-slider">Warp Speed</label>
        <input type="range" id="speed-slider" min="0" max="5" step="0.1" value="1">
    `;
    document.body.appendChild(controls);

    let speedMultiplier = 1;
    const speedSlider = document.getElementById("speed-slider");
    if (speedSlider) {
        speedSlider.addEventListener("input", (e) => {
            // @ts-ignore
            speedMultiplier = parseFloat(e.target.value);
        });
    }

    // Handle messages from the extension
    window.addEventListener("message", (event) => {
        const message = event.data;
        console.log(
            `>> Solaris << Webview received message type: ${message.type}`
        );
        switch (message.type) {
            case "update": {
                const data = message.data;
                console.log(
                    ">> Solaris << Initializing system with data payload..."
                );
                initializeSystem(data);
                break;
            }
        }
    });

    /**
     * Flattens the hierarchical data into nodes and links for D3
     * @param {any} root
     */
    function flatten(root) {
        /** @type {any[]} */
        const nodes = [];
        /** @type {any[]} */
        const links = [];

        /**
         * @param {any} node
         * @param {any} parent
         */
        function recurse(node, parent) {
            nodes.push(node);
            if (parent) {
                links.push({ source: parent, target: node });
            }
            if (node.children) {
                node.children.forEach((/** @type {any} */ child) =>
                    recurse(child, node)
                );
            }
        }
        recurse(root, null);
        return { nodes, links };
    }

    /**
     * @param {any} data
     */
    function initializeSystem(data) {
        const loading = document.getElementById("loading");
        if (loading) {
            loading.style.opacity = "0";
            setTimeout(() => {
                if (loading) {
                    loading.style.display = "none";
                }
            }, 500);
        }
        rootNode = data;

        const graph = flatten(data);
        nodes = graph.nodes;
        links = graph.links;

        const now = Date.now();
        const maxAge = 1000 * 60 * 60 * 24 * 365; // 1 year

        nodes.forEach((/** @type {any} */ node) => {
            if (node.type === "star") {
                node.radius = 25;
                node.color = "#f39c12"; // Sun Yellow/Orange
                node.tRadius = 0;
                node.glow = "#e67e22";
            } else {
                const age = Math.min(now - node.lastModified, maxAge);
                const t = age / maxAge;
                node.tRadius = 60 + t * 400; // Expanded orbits
                node.radius = Math.max(4, Math.min(node.size, 12));
                // Color ramp from Blue (New) to Purple (Old)
                node.color = d3.interpolateCool(t);
                node.angle = Math.random() * Math.PI * 2;
            }
        });

        startSimulation();
    }

    // --- PHYSICS ENGINE ---

    // --- ORBITAL ENGINE ---

    function startSimulation() {
        if (!d3) {
            return;
        }
        if (simulation) {
            simulation.stop();
        }

        // 1. Setup Hierarchy & Orbits
        setupOrbits(rootNode);

        // 2. Start Animation Loop
        simulation = d3.timer((/** @type {number} */ elapsed) => {
            const dt = elapsed - lastTime;
            lastTime = elapsed;

            // Accumulate orbit time based on speed multiplier
            orbitTime += dt * speedMultiplier;

            updateOrbits(rootNode, dt, orbitTime); // Pass dt if we need smooth movement, or orbitTime for absolute position
            ticked();
        });
    }

    // Separate Time tracking for variable speed
    let orbitTime = 0;
    let lastTime = 0;

    /**
     * Recursive function to setup initial orbit properties
     * @param {any} node
     * @param {number} depth
     */
    function setupOrbits(node, depth = 0) {
        node.depth = depth;

        // Root Node configuration (Galactic Center)
        if (depth === 0) {
            node.x = 0;
            node.y = 0;
            node.radius = 40; // Supermassive Black Hole / Center
            node.color = "#000";
            node.glow = "#ed1c24"; // Red Accretion Disk
            node.orbitRadius = 0;
            node.angle = 0;
            node.speed = 0;

            // Name Override: Ensure it shows workspace name clearly
            // The crawler sends the leaf name, but lets make sure.
            // (No change needed if crawler is correct, but visualization might want valid label)
        }

        if (node.children && node.children.length > 0) {
            // Count children to determine orbit spacing
            const count = node.children.length;

            // Base radius for this node's children layer
            // If deeper, orbits can be tighter? Or wider?
            // Let's make top level wide.
            let baseOrbitConfig = {
                startRadius: 100, // Distance from parent center
                spacing: 50,
            };

            // Adjust based on node type/depth
            if (depth === 0) {
                baseOrbitConfig.startRadius = 200;
                baseOrbitConfig.spacing = 150; // Give stars room
            } else if (node.type === "star") {
                baseOrbitConfig.startRadius = 120;
                baseOrbitConfig.spacing = 40;
            }

            // Distribute children in orbits
            // Simple approach: Place them all on Rings based on their index?
            // Or one ring per depth?
            // User wants "orbiting objects", implies moving.
            // Let's create varying orbit radii so they don't collide too much.

            node.children.forEach(
                (/** @type {any} */ child, /** @type {number} */ i) => {
                    // Distribute angle evenly initially to avoid clumping
                    child.angle = (i / count) * Math.PI * 2;

                    // Variable Radius to add "Natural" feel
                    // Cycle through a few "tracks"
                    const track = i % 3;
                    child.orbitRadius =
                        baseOrbitConfig.startRadius +
                        i * (baseOrbitConfig.spacing / 2) +
                        Math.random() * 20;

                    // Random Speed (some go cw, some ccw)
                    // Deeper nodes orbit faster? Kepler says inner is faster.
                    // Let's stick to "Visual" physics.
                    const speedBase = 0.0005;
                    const direction = Math.random() > 0.5 ? 1 : -1;
                    child.speed =
                        (speedBase + Math.random() * 0.001) * direction;

                    // Visual Properties
                    if (child.type === "star") {
                        child.radius = 20 - depth * 2; // get smaller as we go deep
                        if (child.radius < 10) {
                            child.radius = 10;
                        }
                        child.color = "#f39c12";
                        child.glow = "#e67e22";
                    } else {
                        // Planet
                        child.radius = Math.max(4, Math.min(child.size, 10));
                        child.color = d3.interpolatePlasma(Math.random());
                    }

                    // Recursively setup children
                    setupOrbits(child, depth + 1);
                }
            );
        }
    }

    /**
     * @param {any} node
     * @param {number} dt
     * @param {number} simTime
     */
    function updateOrbits(node, dt, simTime) {
        if (!node) {
            return;
        }

        if (node.children) {
            node.children.forEach((/** @type {any} */ child) => {
                // Update Angle
                // Use simTime for absolute position calculation based on start
                // Or accumulate manually. Since we are passing simTime which increments by dt*speed,
                // we can just recalculate orbit position.
                // Angle = InitialAngle + (Speed * SimTime)
                child.currentAngle = child.angle + child.speed * simTime;

                // Calculate Position relative to Parent
                child.x =
                    node.x + Math.cos(child.currentAngle) * child.orbitRadius;
                child.y =
                    node.y + Math.sin(child.currentAngle) * child.orbitRadius;

                updateOrbits(child, dt, simTime);
            });
        }
    }

    function ticked() {
        if (!ctx) {
            return;
        }

        ctx.save();
        ctx.clearRect(0, 0, width, height);
        ctx.translate(transform.x, transform.y);
        ctx.scale(transform.k, transform.k);

        // Draw Background Stars
        ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
        starfield.forEach((star) => {
            ctx.globalAlpha = star.opacity;
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.size / transform.k, 0, 2 * Math.PI);
            ctx.fill();
        });
        ctx.globalAlpha = 1;

        // Draw Deep Space Warning (Same as before)
        const simCenterX = width / 2; // Actually we are centered at 0,0 in world space
        // wait, we forceCenter'd before. Now our root is at 0,0.
        // So the universe boundary should be around 0,0.
        // In previous implementation, D3 force center pushed to width/2, height/2.
        // We need to decide: Is Root at World (0,0)? Yes.
        // But `zoom` needs to center it. `d3.zoomIdentity` starts at 0,0 top-left?
        // Usually we want initial transform to center (0,0) in the middle of the screen.
        // We can do that by initializing `transform` or simply applying an offset in `ticked` before transform?
        // Better: Initialize zoom transform to center the view.
        // For now, let's assume user pans. Or we can hard simulate `translate(width/2, height/2)` in our logic.
        // Actually, typical D3 Zoom with center (0,0) world needs:
        // ctx.translate(width/2, height/2); ctx.transform(transform...);
        // Let's adjust the Ticked translation:

        const outputX = transform.x + width / 2;
        const outputY = transform.y + height / 2;

        // Reset transform for drawing to get clean slate? No, stick to accumulated transform.
        // Let's just shift the "Camera" to center 0,0.

        ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset to identity
        ctx.clearRect(0, 0, width, height);
        ctx.translate(outputX, outputY); // Move 0,0 to center of screen + pan
        ctx.scale(transform.k, transform.k);

        // Now 0,0 is center of screen.

        // Draw Orbits (Optional Visual Aid)
        // Need to traverse to draw orbits.
        drawOrbits(rootNode);

        // Draw Links?
        // With orbits, links are less necessary visual metaphors, but helpful for tracing.
        // Links should go Parent (0,0) -> Child.
        // Hierarchy is implicitly shown by Orbit Center.
        // Let's draw faint lines.
        drawLinks(rootNode);

        // Draw Nodes
        drawNodes(rootNode);

        // Draw Deep Space Boundary around 0,0
        ctx.strokeStyle = "rgba(255, 0, 0, 0.6)";
        ctx.lineWidth = 2 / transform.k;
        ctx.setLineDash([20, 10]);
        ctx.strokeRect(-universeR, -universeR, universeR * 2, universeR * 2);
        ctx.setLineDash([]); // Reset

        // Labels
        ctx.fillStyle = "rgba(255, 0, 0, 0.8)";
        ctx.font = `bold ${24 / transform.k}px "Courier New", monospace`;
        ctx.textAlign = "center";
        ctx.fillText(
            ">> WARNING: DEEP SPACE <<",
            0,
            -universeR - 30 / transform.k
        );

        ctx.restore();
    }

    /**
     * @param {any} node
     */
    function drawOrbits(node) {
        if (!node || !ctx) {
            return;
        }
        if (node.children) {
            ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
            ctx.lineWidth = 1 / transform.k;

            node.children.forEach((/** @type {any} */ child) => {
                ctx.beginPath();
                ctx.arc(node.x, node.y, child.orbitRadius, 0, Math.PI * 2);
                ctx.stroke();
                drawOrbits(child);
            });
        }
    }

    /**
     * @param {any} node
     */
    function drawLinks(node) {
        if (!node || !ctx) {
            return;
        }
        if (node.children) {
            ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
            ctx.lineWidth = 1 / transform.k;
            node.children.forEach((/** @type {any} */ child) => {
                ctx.beginPath();
                ctx.moveTo(node.x, node.y);
                ctx.lineTo(child.x, child.y);
                ctx.stroke();
                drawLinks(child);
            });
        }
    }

    /**
     * @param {any} node
     */
    function drawNodes(node) {
        if (!node || !ctx) {
            return;
        }

        // Draw Self
        ctx.beginPath();
        // Root Node Special Logic?
        if (node.depth === 0) {
            // Galactic Center - Invisible or Glowy
            ctx.fillStyle = "#000";
            ctx.arc(node.x, node.y, node.radius, 0, 2 * Math.PI);
            ctx.fill();
            // Accretion Disk Ring
            ctx.strokeStyle = node.glow;
            ctx.lineWidth = 2 / transform.k;
            ctx.stroke();
        } else {
            ctx.arc(node.x, node.y, node.radius, 0, 2 * Math.PI);

            if (node.type === "star") {
                ctx.shadowBlur = 20;
                ctx.shadowColor = node.glow;
                ctx.fillStyle = node.color;
            } else {
                ctx.shadowBlur = 0;
                const grad = ctx.createRadialGradient(
                    node.x,
                    node.y,
                    node.radius * 0.2,
                    node.x,
                    node.y,
                    node.radius
                );
                grad.addColorStop(0, "#fff"); // Highlight
                grad.addColorStop(0.5, node.color);
                grad.addColorStop(1, "#000"); // Shadow side
                ctx.fillStyle = grad;
            }
            ctx.fill();
            ctx.shadowBlur = 0;

            // Text Label
            if (node.type === "star" || transform.k > 1.5) {
                ctx.fillStyle = "#fff";
                ctx.font = `${12 / transform.k}px Arial`;
                ctx.fillText(node.name, node.x + node.radius + 5, node.y + 4);
            }
        }

        // Draw Children
        if (node.children) {
            node.children.forEach((/** @type {any} */ child) =>
                drawNodes(child)
            );
        }
    }

    // Interaction Overhaul for Recursive Structure
    // Since 'nodes' array is gone, we need to flatten for hit testing OR traverse.
    // Flattening for hit test is easier.
    /**
     * @param {any} node
     * @param {any[]} [list]
     */
    function getAllNodes(node, list = []) {
        if (node) {
            list.push(node);
            if (node.children) {
                node.children.forEach((/** @type {any} */ c) =>
                    getAllNodes(c, list)
                );
            }
        }
        return list;
    }

    const tooltip = document.createElement("div");
    tooltip.className = "tooltip";
    document.body.appendChild(tooltip);

    // Mouse Move needs to account for Transform
    canvas.addEventListener("mousemove", (e) => {
        // Adjust for centered origin
        const cx = width / 2;
        const cy = height / 2;

        const x = (e.clientX - cx - transform.x) / transform.k;
        const y = (e.clientY - cy - transform.y) / transform.k;

        const allNodes = getAllNodes(rootNode);
        const hoveredNode = allNodes.find((node) => {
            const dx = node.x - x;
            const dy = node.y - y;
            return Math.sqrt(dx * dx + dy * dy) < node.radius + 3;
        });

        if (hoveredNode) {
            tooltip.style.display = "block";
            tooltip.style.left = e.clientX + 10 + "px"; // Tooltip follows screen mouse
            tooltip.style.top = e.clientY + 10 + "px";
            tooltip.innerHTML = `
                <strong>${hoveredNode.name}</strong><br>
                Type: ${hoveredNode.type}<br>
                Size: ${
                    hoveredNode.type === "planet"
                        ? Math.round(Math.exp(hoveredNode.size / 10)) + "B"
                        : (hoveredNode.children
                              ? hoveredNode.children.length
                              : 0) + " planets"
                }
            `;
            canvas.style.cursor = "pointer";
        } else {
            tooltip.style.display = "none";
            canvas.style.cursor = "move"; // Default to move for pan
        }
    });

    canvas.addEventListener("click", (e) => {
        const cx = width / 2;
        const cy = height / 2;
        const x = (e.clientX - cx - transform.x) / transform.k;
        const y = (e.clientY - cy - transform.y) / transform.k;

        const allNodes = getAllNodes(rootNode);
        const clickedNode = allNodes.find((node) => {
            const dx = node.x - x;
            const dy = node.y - y;
            return Math.sqrt(dx * dx + dy * dy) < node.radius + 5;
        });

        if (clickedNode) {
            if (clickedNode.type === "planet") {
                vscode.postMessage({
                    type: "onOpenFile",
                    value: clickedNode.path,
                });
            } else {
                // Is a Star (Folder) -> Fly To Logic
                flyTo(clickedNode);
            }
        }
    });

    /**
     * @param {any} node
     */
    function flyTo(node) {
        // Calculate offsets to center the node
        // We want: transform.k * node.x + transform.x = width/2
        // So: transform.x = width/2 - transform.k * node.x

        const targetScale = 1.5; // Zoom in level
        const duration = 1500;

        // Use d3 transition on the canvas selection to drive the zoom transform
        d3.select(canvas).transition().duration(duration).call(
            zoom.transform,
            d3.zoomIdentity.scale(targetScale).translate(-node.x, -node.y) // Move node to center
        );
    }

    // --- Context Menu ---
    /** @type {{action: string, sourcePath: string} | null} */
    let clipboard = null;
    const contextMenu = document.createElement("div");
    contextMenu.className = "context-menu";
    document.body.appendChild(contextMenu);

    document.addEventListener("click", () => {
        contextMenu.style.display = "none";
    });

    canvas.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        const cx = width / 2;
        const cy = height / 2;
        const x = (e.clientX - cx - transform.x) / transform.k;
        const y = (e.clientY - cy - transform.y) / transform.k;

        const allNodes = getAllNodes(rootNode);
        const clickedNode = allNodes.find((node) => {
            const dx = node.x - x;
            const dy = node.y - y;
            return Math.sqrt(dx * dx + dy * dy) < node.radius + 5;
        });

        showContextMenu(e.clientX, e.clientY, clickedNode);
    });

    /**
     * @param {number} x
     * @param {number} y
     * @param {any} node
     */
    function showContextMenu(x, y, node) {
        contextMenu.style.display = "block";
        contextMenu.style.left = x + "px";
        contextMenu.style.top = y + "px";
        contextMenu.innerHTML = "";

        /**
         * @param {string} label
         * @param {() => void} onClick
         * @param {boolean} [disabled]
         */
        const addItem = (label, onClick, disabled = false) => {
            const item = document.createElement("div");
            item.className =
                "context-menu-item" + (disabled ? " disabled" : "");
            item.innerText = label;
            if (!disabled) {
                item.onclick = onClick;
            }
            contextMenu.appendChild(item);
        };

        const addSeparator = () => {
            const sep = document.createElement("div");
            sep.className = "context-menu-separator";
            contextMenu.appendChild(sep);
        };

        // If clicked background, offer creating in Root (if available)
        if (!node) {
            if (rootNode) {
                addItem("New File (Root)", () => {
                    vscode.postMessage({
                        type: "createFile",
                        value: rootNode.path,
                    });
                });
                addItem("New Folder (Root)", () => {
                    vscode.postMessage({
                        type: "createFolder",
                        value: rootNode.path,
                    });
                });
                if (clipboard && clipboard.action === "move") {
                    const sourcePath = clipboard.sourcePath;
                    addSeparator();
                    addItem(
                        `Paste '${sourcePath.split(/[/\\]/).pop()}' in Root`,
                        () => {
                            vscode.postMessage({
                                type: "moveFile",
                                value: {
                                    source: sourcePath,
                                    destination: rootNode.path,
                                },
                            });
                            clipboard = null;
                        }
                    );
                }
            } else {
                contextMenu.style.display = "none";
            }
            return;
        }

        const isFolder =
            node.type === "star" ||
            node === rootNode ||
            (node.children && node.children.length >= 0);

        // Folder Actions
        if (isFolder) {
            addItem("New File", () => {
                vscode.postMessage({ type: "createFile", value: node.path });
            });
            addItem("New Folder", () => {
                vscode.postMessage({ type: "createFolder", value: node.path });
            });
            addSeparator();
            if (clipboard && clipboard.action === "move") {
                const sourcePath = clipboard.sourcePath;
                addItem(`Paste '${sourcePath.split(/[/\\]/).pop()}'`, () => {
                    vscode.postMessage({
                        type: "moveFile",
                        value: {
                            source: sourcePath,
                            destination: node.path,
                        },
                    });
                    clipboard = null;
                });
                addSeparator();
            }
        }

        // Item Actions (Rename, Delete, Cut)
        if (node !== rootNode) {
            addItem("Rename", () => {
                vscode.postMessage({ type: "renameFile", value: node.path });
            });
            addItem("Cut", () => {
                clipboard = { action: "move", sourcePath: node.path };
            });
            addSeparator();
            addItem("Delete", () => {
                vscode.postMessage({ type: "deleteFile", value: node.path });
            });
        }
    }
})();
