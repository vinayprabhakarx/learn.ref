# /Learn.ref

A lightning-fast, zero-dependency web app designed as a modular learning hub. Originally built as a "DSA Reference", the application is now decoupled and capable of hosting an infinite number of subjects (like Data Structures, Kubernetes, Web Development, etc.) without cluttering the frontend logic.

Built with pure HTML, CSS, and Vanilla JavaScript, ensuring maximum performance and minimum overhead.

## Features

- **Modular Architecture:** Add entirely new subjects with ease. The architecture supports distinct layouts (Grid view vs. List view) configured seamlessly via JSON.
- **Instant Search & Filtering:** Filter topics by category or search in real-time.
- **Complexity at a Glance:** The DSA engine shows the exact Time & Space complexities for core operations.
- **Practice Integration:** Click any use case or practice button to instantly search for related problems on platforms like LeetCode.

## Project Structure

```text
├── index.html                  # Landing page (Learn App Hub)
├── dsa.html                    # Unified engine for Data Structures & Algorithms
├── script.js                   # Logic for the DSA engine
├── dsa-data-structures.json    # JSON content for Data Structures (Grid layout)
├── dsa-algorithms.json         # JSON content for Algorithms (List layout)
├── styles.css                  # Global design tokens and component layouts
└── logo.svg                    # App Favicon
```

## How to Expand

This application supports two ways to add new content:

### 1. Add Content to an Existing Engine (e.g. DSA)

Create a new JSON file (e.g., `dsa-system-design.json`) and link to it on `index.html` using the existing engine: `dsa.html?id=dsa-system-design`.
The `dsa.html` engine will automatically parse the `layout` property in your JSON (`grid` or `list`) and render it appropriately.

### 2. Add an Entirely New Subject Engine (e.g. Kubernetes)

For entirely new subjects that don't fit the DSA layout paradigm, you can create a decoupled engine:

1. Create `k8s.html` with your custom layout.
2. Create `k8s-topics.json`.
3. Add a link to `index.html` pointing to `k8s.html?id=k8s-topics`.

## License

This project is licensed under the [MIT License](LICENSE). Feel free to fork, modify, and use this for your own studying or interview prep!
