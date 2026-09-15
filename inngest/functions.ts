import { inngest } from "./client";

export const helloWorld = inngest.createFunction(
  { id: "hello-world", trigger: { event: "test/hello" } },
  async ({ event, step }) => {
    return { message: `Hello, ${event.data.name}!` };
  }
);