<div align="center">

<img src="resources/sun-icon.png" alt="Project Solaris" width="128">

# Project Solaris

</div>

**Project Solaris** reimagines your file explorer as an interactive, physics-based star system. Transform your boring file lists into a deep space exploration experience right inside VS Code.

## Features

### The Solar System View

Navigate your current workspace as a gravitational system.

-   **Stars (Folders)**: Massive, glowing suns that anchor the system.
-   **Planets (Files)**: Orbiting bodies that drift around their parent folders.
-   **Physics-Based Layout**:
    -   **Mass**: Larger files appear as larger bodies.
    -   **Orbit**: Recently modified files orbit closer to the star (inner heat zone), while older files drift to the cold outer edges.

### Interactive Exploration

-   **Pan & Zoom**: Use your mouse wheel to zoom (0.1x to 4x) and click-drag to pan across the cosmos.
-   **Click to Open**: Click on any planet to instantly open the file in your editor.
-   **Smart Tooltips**: Hover over any celestial body to see its name, type, and size.

### Deep Space Warning

Don't stray too far! The simulation is constrained by a **Deep Space Boundary**. Venturing to the edge reveals the warning systems, keeping your file system contained within observable space.

## Extension Settings

This extension currently offers a plug-and-play experience with zero configuration needed.

## Known Issues

-   Very large node_modules galaxies may cause high GPU usage (but look spectacular).
-   "Black hole" files (0 bytes) are rendered as tiny asteroids.

---

**Enjoy the view!**
