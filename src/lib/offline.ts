export const isLocalNavigation = (href: string, current: string): boolean => {
  try {
    const base = new URL(current);
    const target = new URL(href, base);
    return target.origin === base.origin && target.pathname === base.pathname &&
      (target.protocol === "https:" || target.protocol === "http:");
  } catch {
    return false;
  }
};
