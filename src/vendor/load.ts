export const loadVendor = async <T>(specifier: string): Promise<T> =>
  import(specifier) as Promise<T>;
