import { fileURLToPath } from "node:url";
import { config } from "dotenv";
config({
  path: fileURLToPath(new URL("../../../.env", import.meta.url)),
  quiet: true,
});
export function getPort() {
  const port = Number(process.env.API_PORT ?? 4000);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("API_PORT 必须为有效端口。");
  return port;
}
