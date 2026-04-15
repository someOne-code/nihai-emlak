import { inngest } from "@/lib/inngest/client";

export const paymentCallbackWorkflow = inngest.createFunction(
  {
    id: "payment-callback-workflow",
    triggers: [{ event: "payment/callback.received" }],
  },
  async ({ event, step }) => {
    const persisted = await step.run("persist-payment-callback", async () => {
      return {
        receivedAt: new Date().toISOString(),
        provider: event.data.provider,
        verified: event.data.verified,
      };
    });

    return {
      ok: true,
      persisted,
    };
  },
);
