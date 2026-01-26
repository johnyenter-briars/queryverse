export type Connection = ClientCredentialsConnection | AuthorizationCodeConnection

export type ConnectionMethod = 'ClientCredentials' | 'AuthorizationCode'

export type ClientCredentialsConnection = {
    method: "ClientCredentials";
    id: string | null;
    name: string;
    clientId: string;
    clientSecret: string;
    tenantId: string;
    scope: string;
    dataverseUrl: string;
    generatedOn: string;
}

export type AuthorizationCodeConnection = {
    method: "AuthorizationCode";
    id: string | null;
    name: string;
    clientId: string;
    clientSecret: string;
    tenantId: string;
    scope: string;
    accessToken: string;
    refreshToken: string;
    expiresAt: string; 
    dataverseUrl: string;
    generatedOn: string;
}
