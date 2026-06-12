import nextConfig from "eslint-config-next";

export default [
  ...nextConfig,
  {
    rules: {
      // Codebase uses setState-in-effect intentionally for state sync patterns (e.g. form fields
      // mirroring server state, UI init from localStorage). Too many false positives to disable
      // per-line across 5 files — disabled globally instead.
      "react-hooks/set-state-in-effect": "off",

      // ── Feature isolation ────────────────────────────────────────────────────
      // fringe, roskilde, and madspild must not import from each other.
      // Only true shared infrastructure (src/components, src/lib) may be
      // imported across features.
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            {
              target: "./src/app/fringe",
              from: ["./src/app/roskilde", "./src/app/madspild"],
              message: "fringe must not import from roskilde or madspild.",
            },
            {
              target: "./src/app/roskilde",
              from: ["./src/app/fringe", "./src/app/madspild"],
              message: "roskilde must not import from fringe or madspild.",
            },
            {
              target: "./src/app/madspild",
              from: ["./src/app/fringe", "./src/app/roskilde"],
              message: "madspild must not import from fringe or roskilde.",
            },
          ],
        },
      ],
    },
  },
];
