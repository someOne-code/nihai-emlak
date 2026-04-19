import type { IsbankHostedCheckoutPayload } from "./checkout-init";

export type CheckoutInitSuccessResponse = {
  success: true;
  data: {
    isbank: IsbankHostedCheckoutPayload;
    payment: {
      amount: number;
      currency: string;
      id: string;
      orderId: string;
      providerRef: string;
      status: "pending";
    };
  };
};

type BuildCheckoutInitSuccessResponseInput = {
  amount: number;
  currency: string;
  isbankPayload: IsbankHostedCheckoutPayload;
  orderId: string;
  paymentId: string;
  providerRef: string;
};

export function buildCheckoutInitSuccessResponse(
  input: BuildCheckoutInitSuccessResponseInput,
): CheckoutInitSuccessResponse {
  if (input.providerRef !== input.paymentId) {
    throw new Error("providerRef must equal paymentId for checkout init");
  }

  if (input.isbankPayload.oid !== input.paymentId) {
    throw new Error("isbank oid must equal paymentId for checkout init");
  }

  return {
    success: true,
    data: {
      isbank: input.isbankPayload,
      payment: {
        amount: input.amount,
        currency: input.currency,
        id: input.paymentId,
        orderId: input.orderId,
        providerRef: input.providerRef,
        status: "pending",
      },
    },
  };
}
