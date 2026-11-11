declare module "*.md" {
  const text: string;
  export default text;
}

declare module "*.md?raw" {
  const text: string;
  export default text;
}
