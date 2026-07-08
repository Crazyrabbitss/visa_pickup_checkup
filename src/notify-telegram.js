import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const statePath = path.join(root, "artifacts", "latest-state.json");

function shouldNotify(state) {
  return state.status === "appointment-available" || state.status === "error";
}

function buildMessage(state) {
  if (state.status === "appointment-available") {
    return [
      "Passport pickup appointment may be available.",
      `Checked at: ${state.checkedAt}`,
      `Matched: ${(state.availableMatches ?? []).join(", ") || "appointment-available"}`,
      "Book here: https://schedule.gtspremium.com/"
    ].join("\n");
  }

  return [
    "Passport pickup tracker check failed.",
    `Checked at: ${state.checkedAt}`,
    `Status: ${state.status}`,
    `Error: ${state.error ?? "unknown"}`
  ].join("\n");
}

async function main() {
  const state = JSON.parse(await fs.readFile(statePath, "utf8"));

  if (!shouldNotify(state)) {
    console.log(`No notification for status: ${state.status}`);
    return;
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.log("Notification skipped because TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is missing.");
    console.log(buildMessage(state));
    return;
  }

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: buildMessage(state),
      disable_web_page_preview: true
    })
  });

  if (!response.ok) {
    throw new Error(`Telegram notification failed: ${response.status} ${await response.text()}`);
  }

  console.log("Telegram notification sent.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
