export function pdfPageHref(pathname, currentQuery, page) {
  const params = new URLSearchParams(currentQuery);
  params.set("page", String(page));
  return `${pathname}?${params.toString()}`;
}
