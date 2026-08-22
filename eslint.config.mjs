import js from "@eslint/js";
import globals from "globals";
import pluginVue from "eslint-plugin-vue";
import tseslint from "typescript-eslint";
import vueParser from "vue-eslint-parser";

export default [
  { ignores: ["**/dist/**", "**/node_modules/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs["flat/recommended"],
  {
    files: ["**/*.vue"],
    languageOptions: { parser: vueParser, parserOptions: { parser: tseslint.parser, extraFileExtensions: [".vue"] }, globals: { ...globals.browser, ...globals.node } },
    rules: { "@typescript-eslint/no-explicit-any": "error", "vue/multi-word-component-names": "off", "vue/max-attributes-per-line": "off", "vue/singleline-html-element-content-newline": "off", "vue/html-self-closing": "off" }
  },
  {
    files: ["**/*.ts"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: { "@typescript-eslint/no-explicit-any": "error" }
  },
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: { globals: { ...globals.node } }
  }
];
