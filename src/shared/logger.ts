/* oxlint-disable no-console */
export const warn = (...args: unknown[]): void => {
  console.warn(...args);
};

export const error = (...args: unknown[]): void => {
  console.error(...args);
};
