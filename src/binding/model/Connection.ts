export interface Connection {
    id: string | null,
    name: string,
    method: ConnectionMethod,
}

export enum ConnectionMethod {
    ClientSecret = "ClientSecret",
}
