export type AuthConfig = ClientCredentialsAuthConfig | DeviceCodeAuthConfig | InteractiveBrowserAuthConfig;

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

export type InteractiveBrowserAuthConfig = {
    method: "InteractiveBrowser";
    clientId: string;
    tenantId: string;
    dataverseUrl: string;
    tokenCacheStorePath?: string | null;
};
