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
                if (loading) loading.style.display = "none";
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

    function startSimulation() {
        if (!d3) return;
        if (simulation) simulation.stop();

        // Custom Force: Orbital Hold
        /** @type {(alpha: number) => void} */
        const forceOrbit = (alpha) => {
            links.forEach((/** @type {any} */ link) => {
                const source = link.source;
                const target = link.target;
                if (target.type === "planet") {
                    const dx = target.x - source.x;
                    const dy = target.y - source.y;
                    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                    const angle = Math.atan2(dy, dx);
                    const diff = dist - target.tRadius;
                    const k = alpha * 0.5;
                    target.x -= Math.cos(angle) * diff * k;
                    target.y -= Math.sin(angle) * diff * k;
                }
            });
        };

        simulation = d3
            .forceSimulation(nodes)
            .force(
                "link",
                d3
                    .forceLink(links)
                    .id((/** @type {any} */ d) => d.path)
                    .strength(0)
            )
            .force("charge", d3.forceManyBody().strength(-30))
            .force("center", d3.forceCenter(width / 2, height / 2))
            .force("orbit", forceOrbit)
            .on("tick", ticked);
    }

    function ticked() {
        if (!ctx) return;

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

        // Draw Deep Space Warning Boundary
        // Simulation centers at (width/2, height/2) so we need to account for that effectively becoming (0,0) in our logic if we forced center,
        // BUT d3 forceCenter pushes nodes to (width/2, height/2).
        // Let's adjust: The universe box should be centered at width/2, height/2.
        const simCenterX = width / 2;
        const simCenterY = height / 2;

        const bX = simCenterX - universeR;
        const bY = simCenterY - universeR;
        const bS = universeR * 2;

        ctx.strokeStyle = "rgba(255, 0, 0, 0.6)"; // Red
        ctx.lineWidth = 2 / transform.k;
        ctx.setLineDash([20, 10]);
        ctx.strokeRect(bX, bY, bS, bS);
        ctx.setLineDash([]); // Reset

        // Verify font size scales inverse to zoom so it stays readable
        ctx.fillStyle = "rgba(255, 0, 0, 0.8)";
        ctx.font = `bold ${24 / transform.k}px "Courier New", monospace`;
        ctx.textAlign = "center";

        // Label Offset
        const labelOff = 30 / transform.k;

        // Top Label
        ctx.fillText(">> WARNING: DEEP SPACE <<", simCenterX, bY - labelOff);
        // Bottom Label
        ctx.fillText(
            ">> WARNING: DEEP SPACE <<",
            simCenterX,
            bY + bS + labelOff * 2
        );

        // Draw Links
        ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
        ctx.beginPath();
        links.forEach((/** @type {any} */ d) => {
            ctx.moveTo(d.source.x, d.source.y);
            ctx.lineTo(d.target.x, d.target.y);
        });
        ctx.stroke();

        // Draw Nodes
        nodes.forEach((/** @type {any} */ d) => {
            ctx.beginPath();
            ctx.arc(d.x, d.y, d.radius, 0, 2 * Math.PI);

            if (d.type === "star") {
                // Glow effect for Stars
                ctx.shadowBlur = 20;
                ctx.shadowColor = d.glow;
                ctx.fillStyle = d.color;
            } else {
                // Planet Gradient
                ctx.shadowBlur = 0;
                const grad = ctx.createRadialGradient(
                    d.x,
                    d.y,
                    d.radius * 0.2,
                    d.x,
                    d.y,
                    d.radius
                );
                grad.addColorStop(0, "#fff"); // Highlight
                grad.addColorStop(0.5, d.color);
                grad.addColorStop(1, "#000"); // Shadow side
                ctx.fillStyle = grad;
            }

            ctx.fill();
            ctx.shadowBlur = 0; // Reset

            // Text Label
            if (
                d.type === "star" ||
                (transform.k > 1.5 && d.type === "planet")
            ) {
                ctx.fillStyle = "#fff";
                ctx.font = `${12 / transform.k}px Arial`; // Scale text inverse to zoom
                ctx.fillText(d.name, d.x + d.radius + 5, d.y + 4);
            }
        });

        ctx.restore();
    }

    // Interaction

    const tooltip = document.createElement("div");
    tooltip.className = "tooltip";
    document.body.appendChild(tooltip);

    // Mouse Move needs to account for Transform
    canvas.addEventListener("mousemove", (e) => {
        // Invert transform to find graph coordinates
        const x = (e.clientX - transform.x) / transform.k;
        const y = (e.clientY - transform.y) / transform.k;

        const hoveredNode = nodes.find((node) => {
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
        // Prevent click if we were dragging (simple check: zoom event usually captures click, but let's be safe)
        // For d3 zoom to work nicely with click, we usually check if dx/dy was small

        const x = (e.clientX - transform.x) / transform.k;
        const y = (e.clientY - transform.y) / transform.k;

        const clickedNode = nodes.find((node) => {
            const dx = node.x - x;
            const dy = node.y - y;
            return Math.sqrt(dx * dx + dy * dy) < node.radius + 5;
        });

        if (clickedNode && clickedNode.type === "planet") {
            vscode.postMessage({
                type: "onOpenFile",
                value: clickedNode.path,
            });
        }
    });
})();
