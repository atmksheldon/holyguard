/**
 * Dev-only logger utility.
 * All logging is suppressed in production builds.
 * __DEV__ is a built-in React Native global that is true in development.
 */
export const logger = {
  log: (...args: any[]) => {
    if (__DEV__) console.log(...args);
  },
  error: (...args: any[]) => {
    if (__DEV__) console.error(...args);
  },
  warn: (...args: any[]) => {
    if (__DEV__) console.warn(...args);
  },
};
