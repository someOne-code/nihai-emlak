// Phase D: Admin Communication controller — composes client + view model.

import {
  AdminCommunicationsClientError,
  loadAdminCommunicationsOverview,
  retryAdminCommunicationsConversation,
  type AdminCommunicationsClientOptions,
} from "./communications-client.ts";
import {
  buildCommunicationsViewModel,
  type CommunicationsViewModel,
} from "./communications-view-model.ts";

export type CommunicationsLoaderDependencies = AdminCommunicationsClientOptions;

export type CommunicationsLoadResult =
  | { ok: true; viewModel: CommunicationsViewModel }
  | { ok: false; error: string; status: number };

export async function loadCommunicationsModel(
  options: CommunicationsLoaderDependencies = {},
): Promise<CommunicationsLoadResult> {
  try {
    const overview = await loadAdminCommunicationsOverview(options);
    return {
      ok: true,
      viewModel: buildCommunicationsViewModel({
        conversations: overview.conversations,
        chatwootWebBaseUrl: overview.chatwoot?.web_base_url,
        chatwootAccountId: overview.chatwoot?.account_id,
      }),
    };
  } catch (error) {
    if (error instanceof AdminCommunicationsClientError) {
      return { ok: false, error: error.message, status: error.status };
    }
    return { ok: false, error: "Yükleme başarısız", status: 0 };
  }
}

export type CommunicationsRetryResult =
  | { ok: true }
  | { ok: false; error: string; status: number };

export async function retryCommunicationsMapping(
  conversationId: string,
  options: CommunicationsLoaderDependencies = {},
): Promise<CommunicationsRetryResult> {
  try {
    await retryAdminCommunicationsConversation(conversationId, options);
    return { ok: true };
  } catch (error) {
    if (error instanceof AdminCommunicationsClientError) {
      return { ok: false, error: error.message, status: error.status };
    }
    return { ok: false, error: "Yeniden deneme başarısız", status: 0 };
  }
}
