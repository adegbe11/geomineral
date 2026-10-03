import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import type { Analysis } from "../types";

export async function exportReport(_analysis: Analysis, html: string) {
  if (!(await Sharing.isAvailableAsync())) {
    await Print.printAsync({ html });
    return;
  }
  const file = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(file.uri, {
    mimeType: "application/pdf",
    UTI: "com.adobe.pdf",
    dialogTitle: "Export report",
  });
}
