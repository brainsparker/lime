import { openExternalUrlWithSystemBrowser } from "@/lib/api/externalUrl";

export const INPUT_CLASS_NAME =
  "w-full rounded-[16px] border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20";
export const TEXT_BUTTON_CLASS_NAME =
  "rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-ring hover:text-foreground";
export const ACTION_BUTTON_CLASS_NAME =
  "rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-muted-foreground transition hover:border-ring hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50";
export const PRIMARY_BUTTON_CLASS_NAME =
  "rounded-full border border-primary/20 bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50";

export const PEXELS_APPLY_URL = "https://www.pexels.com/api/new/";
export const PEXELS_DOC_URL = "https://www.pexels.com/api/";
export const PIXABAY_APPLY_URL = "https://pixabay.com/accounts/register/";
export const PIXABAY_DOC_URL = "https://pixabay.com/api/docs/";
export const TAVILY_APPLY_URL = "https://app.tavily.com/";
export const TAVILY_DOC_URL = "https://docs.tavily.com/";
export const MSE_DOC_URL = "https://docs.tavily.com/";
export const BING_SEARCH_APPLY_URL =
  "https://portal.azure.com/#create/Microsoft.CognitiveServicesBingSearch-v7";
export const BING_SEARCH_DOC_URL =
  "https://learn.microsoft.com/zh-cn/bing/search-apis/bing-web-search/overview";
export const GOOGLE_SEARCH_API_APPLY_URL =
  "https://console.cloud.google.com/apis/library/customsearch.googleapis.com";
export const GOOGLE_SEARCH_DOC_URL =
  "https://developers.google.com/custom-search/v1/overview";
export const GOOGLE_SEARCH_CSE_URL =
  "https://programmablesearchengine.google.com/";

export async function openExternalUrl(url: string) {
  try {
    await openExternalUrlWithSystemBrowser(url);
  } catch (error) {
    console.error("打开外部链接失败:", error);
  }
}
