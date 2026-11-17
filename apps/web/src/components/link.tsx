import { forwardRef } from "react";
import { Link as RouterLink, type LinkProps } from "react-router-dom";
import { isInternalHref } from "@zhixue/shared";
// 页面间导航交给 Router；页内锚点使用浏览器原生滚动。
const Link = forwardRef<
  HTMLAnchorElement,
  Omit<LinkProps, "to"> & { href: string }
>(function Link({ href, ...props }, ref) {
  if (!isInternalHref(href))
    return (
      <a
        {...props}
        ref={ref}
        aria-disabled="true"
        onClick={(event) => event.preventDefault()}
      />
    );
  if (href.startsWith("#")) return <a href={href} ref={ref} {...props} />;
  return <RouterLink to={href} ref={ref} {...props} />;
});
export default Link;
