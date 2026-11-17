import { spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readdir, lstat, readFile, writeFile } from "node:fs/promises";
import { resolve, join, relative } from "node:path";
import { pathToFileURL } from "node:url";

async function inventory(
  root: string,
  directory = root,
): Promise<{ path: string; bytes: number; sha256: string }[]> {
  const result = [];
  for (const name of (await readdir(directory)).sort()) {
    const file = join(directory, name),
      stat = await lstat(file);
    if (stat.isSymbolicLink()) throw new Error("备份不接受符号链接。");
    if (stat.isDirectory()) result.push(...(await inventory(root, file)));
    else if (stat.isFile()) {
      const path = relative(root, file).replaceAll("\\", "/");
      if (path === "manifest.json") continue;
      const hash = createHash("sha256");
      for await (const chunk of createReadStream(file)) hash.update(chunk);
      result.push({ path, bytes: stat.size, sha256: hash.digest("hex") });
    } else throw new Error("备份包含不支持的文件类型。");
  }
  return result.sort((a, b) => a.path.localeCompare(b.path));
}

export async function verifyBundle(directory: string) {
  const root = resolve(directory);
  if (
    !(await lstat(root)).isDirectory() ||
    (await lstat(root)).isSymbolicLink()
  )
    throw new Error("备份目录无效。");
  const manifestFile = join(root, "manifest.json");
  if ((await lstat(manifestFile)).isSymbolicLink())
    throw new Error("清单不能是链接。");
  const manifest = JSON.parse(await readFile(manifestFile, "utf8"));
  const files = await inventory(root);
  if (
    manifest.version !== 1 ||
    !files.some((f) => f.path === "database.dump") ||
    JSON.stringify(manifest.files) !== JSON.stringify(files)
  )
    throw new Error("备份完整性校验失败：文件缺失、增加或内容改变。");
  return files;
}

export async function backupBundle(options: {
  dbContainer: string;
  apiContainer: string;
  user: string;
  database: string;
  destination: string;
}) {
  if (
    ![options.dbContainer, options.apiContainer].every((id) =>
      /^[a-f0-9]{64}$/.test(id),
    )
  )
    throw new Error("请使用完整的64位容器ID。");
  if (
    ![options.user, options.database].every((value) =>
      /^[A-Za-z_][A-Za-z0-9_-]{0,62}$/.test(value),
    )
  )
    throw new Error("数据库用户名或库名格式不受支持。");
  function docker(args: string[]) {
    const result = spawnSync("docker", args, {
      encoding: "utf8",
      windowsHide: true,
      timeout: 600000,
    });
    if (result.status !== 0)
      throw new Error("备份 Docker 步骤失败，未生成完成清单。");
    return result.stdout.trim();
  }
  const state = () =>
    docker(["inspect", "--format", "{{.State.Status}}", options.apiContainer]);
  if (state() !== "exited")
    throw new Error("请先停止所有应用写入；指定的 API 容器必须已停止。");
  const directory = resolve(options.destination);
  await mkdir(directory); // Refuse existing destinations; never overwrite a backup.
  const remote = `/tmp/zhixue-backup-${randomBytes(12).toString("hex")}.dump`;
  try {
    docker([
      "exec",
      options.dbContainer,
      "pg_dump",
      "-U",
      options.user,
      "-d",
      options.database,
      "-Fc",
      "--no-owner",
      "--no-acl",
      "-f",
      remote,
    ]);
    docker([
      "cp",
      `${options.dbContainer}:${remote}`,
      join(directory, "database.dump"),
    ]);
    docker([
      "cp",
      `${options.apiContainer}:/app/.local-media`,
      join(directory, "media"),
    ]);
    if (state() !== "exited")
      throw new Error("备份期间 API 状态改变，拒绝完成备份。");
    const files = await inventory(directory);
    await writeFile(
      join(directory, "manifest.json"),
      JSON.stringify(
        { version: 1, createdAt: new Date().toISOString(), files },
        null,
        2,
      ),
      { flag: "wx" },
    );
    await verifyBundle(directory);
    return directory;
  } finally {
    docker(["exec", options.dbContainer, "rm", "-f", remote]);
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const [command, ...args] = process.argv.slice(2);
  try {
    if (command === "verify" && args.length === 1) {
      const files = await verifyBundle(args[0]);
      console.log(`备份校验通过：${files.length} 个文件。`);
    } else if (command === "create" && args.length === 5) {
      const [dbContainer, apiContainer, user, database, destination] = args;
      console.log(
        "备份完成：" +
          (await backupBundle({
            dbContainer,
            apiContainer,
            user,
            database,
            destination,
          })),
      );
    } else
      throw new Error(
        "用法：backup:bundle -- create <数据库容器ID> <已停止API容器ID> <数据库用户> <库名> <新目录>；或 verify <目录>",
      );
  } catch (error) {
    console.error(error instanceof Error ? error.message : "备份失败。");
    process.exitCode = 1;
  }
}
