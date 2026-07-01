import expoConfig from "eslint-config-expo/flat.js";

export default [
  ...expoConfig,
  {
    ignores: ["dist/**", ".expo/**", "node_modules/**"],
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
];
