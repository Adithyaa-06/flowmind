import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function main() {
  const { askYesNo } = await import("./llm");

  const result1 = await askYesNo("Is the sky blue?");
  console.log("Sky blue question:", result1);

  const result2 = await askYesNo("Is the sky green?");
  console.log("Sky green question:", result2);
}

main();