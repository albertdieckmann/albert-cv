import nextConfig from "eslint-config-next";

export default [
  ...nextConfig,
  {
    rules: {
      // Codebase uses setState-in-effect intentionally for state sync patterns (e.g. form fields
      // mirroring server state, UI init from localStorage). Too many false positives to disable
      // per-line across 5 files — disabled globally instead.
      "react-hooks/set-state-in-effect": "off",
    },
  },
];
