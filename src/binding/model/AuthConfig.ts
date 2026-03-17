export type AuthConfig = ClientCredentialsAuthConfig | DeviceCodeAuthConfig;

export type ClientCredentialsAuthConfig = {
    method: "ClientCredentials";
    clientId: string;
    clientSecret: string;
    tenantId: string;
    dataverseUrl: string;
    tokenCacheStorePath?: string | null;
};

export type DeviceCodeAuthConfig = {
    method: "DeviceCode";
    clientId: string;
    tenantId: string;
    dataverseUrl: string;
    tokenCacheStorePath?: string | null;
};
