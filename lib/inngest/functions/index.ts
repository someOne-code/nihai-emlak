import { chatwootProvisionWorkflow } from "./chatwoot-provision";
import { paymentCallbackWorkflow } from "./payment-callback";

export const inngestFunctions = [paymentCallbackWorkflow, chatwootProvisionWorkflow];
