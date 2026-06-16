// jsdom does not ship CSS.escape — polyfill it.
if (!globalThis.CSS) {
  // @ts-expect-error minimal polyfill
  globalThis.CSS = {}
}
if (!CSS.escape) {
  CSS.escape = (value: string) => {
    return value.replaceAll(
      /[^\w-]/g,
      c => `\\${c.charCodeAt(0).toString(16).padStart(6, '0')} `,
    )
  }
}
