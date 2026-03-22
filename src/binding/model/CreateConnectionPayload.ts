export type CreateConnectionPayload =
    | ClientCredentialsCreatePayload
    | DeviceCodeCreatePayload;

export interface ClientCredentialsCreatePayload {
    id?: string | null;
    method: "ClientCredentials";
    name: string;
    parentFolderId?: string | null;
    clientId: string;
    clientSecret: string;
    tenantId: string;
    dataverseUrl: string;
    tokenCacheStorePath?: string | null;
}

export interface DeviceCodeCreatePayload {
    id?: string | null;
    method: "DeviceCode";
    name: string;
    parentFolderId?: string | null;
    clientId: string;
    tenantId: string;
    dataverseUrl: string;
    tokenCacheStorePath?: string | null;
}
