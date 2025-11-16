export interface QVRequest<T> {
    value: T,
    requestType: RequestType,
}

export enum RequestType {
    Create = "Create"
}