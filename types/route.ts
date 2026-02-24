export interface ParamsContext<TParams extends object> {
  params: Promise<TParams>
}
