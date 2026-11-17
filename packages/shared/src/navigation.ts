// 只允许站内链接；不把后续内容配置中的外部地址传给 Router。
export function isInternalHref(href: string): boolean {
  let decoded = href;
  try {
    for (let i = 0; i < 2; i++) decoded = decodeURIComponent(decoded);
  } catch {
    return false;
  }
  if (
    decoded.includes("\\") ||
    Array.from(decoded).some(
      (char) => char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127,
    )
  )
    return false;
  return (
    decoded.startsWith("#") ||
    (decoded.startsWith("/") && !decoded.startsWith("//"))
  );
}
