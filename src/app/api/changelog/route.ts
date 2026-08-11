import { CHANGELOG } from "@/data/changelog";

/** お知らせ(CHANGELOG)をJSONで返す。外部ツール(クラブDiscord Botなど)からの定期取得用。 */
export function GET() {
  return Response.json(CHANGELOG);
}
