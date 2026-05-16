import next from "eslint-config-next/core-web-vitals";

const config = [
  { ignores: [".next/**", "node_modules/**", "public/sw.js"] },
  ...next,
  {
    rules: {
      "react/no-unescaped-entities": "off",
      "@next/next/no-img-element": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
];

export default config;
